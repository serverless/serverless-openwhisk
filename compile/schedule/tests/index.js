'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileSchedules = require('../index');

describe('OpenWhiskCompileSchedules', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileSchedules;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileSchedules = new OpenWhiskCompileSchedules(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { log: () => {} };
    openwhiskCompileSchedules.setup()

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#processScheduleEvents()', () => {
    it('should update create schedule trigger and update manifest resources.', () => {
      const fnObj = { events: [{schedule: "cron(* * * * *)"}] }
      serverless.service.getFunction = () => fnObj
      openwhiskCompileSchedules.compileScheduleTrigger = () => ({name: 'serviceName_fnName_schedule_trigger', content: { a: 1 }})
      openwhiskCompileSchedules.processScheduleEvent("fnName", fnObj.events[0].schedule)
      expect(fnObj.events[1]).to.be.deep.equal({
        trigger: { name: 'serviceName_fnName_schedule_trigger', rule: 'serviceName_fnName_schedule_rule' }
      })

      expect(serverless.service.resources.triggers).to.be.deep.equal({serviceName_fnName_schedule_trigger: {a: 1}})
    })
  })

  describe('#processScheduleEvents()', () => {
    it('should call processEventSchedule for each schedule event.', () => {
      const service = openwhiskCompileSchedules.serverless.service;
      const fns = {
        first: {
          events: [{}, {schedule: "cron(* * * * *)"}, {trigger: true}]
        },
        second: {
          events: [{schedule: "cron(* * * * *)"}]
        },
        third: {}
      }

      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name];

      const spy = openwhiskCompileSchedules.processScheduleEvent = sinon.spy()
      openwhiskCompileSchedules.processScheduleEvents()
      expect(spy.calledTwice).to.be.equal(true)
      expect(spy.withArgs("first", "cron(* * * * *)").calledOnce).to.be.equal(true)
      expect(spy.withArgs("second", "cron(* * * * *)").calledOnce).to.be.equal(true)
    })
  })


  describe('#compileScheduleTrigger()', () => {
    it('should throw errors for incorrect rate definition.', () => {
      let name = 'my_fn'
      expect(() => openwhiskCompileSchedules.compileScheduleTrigger(name, 'ron(* * * * *)'))
        .to.throw(Error, /Schedule event rate property value is invalid/);
      expect(() => openwhiskCompileSchedules.compileScheduleTrigger(name, '* * * * *'))
        .to.throw(Error, /Schedule event rate property value is invalid/);
      expect(() => openwhiskCompileSchedules.compileScheduleTrigger(name, 'cron(* * * *)'))
        .to.throw(Error, /Schedule event rate property value is invalid/);
      expect(() => openwhiskCompileSchedules.compileScheduleTrigger(name, 'cron(* * * * * *)'))
        .to.throw(Error, /Schedule event rate property value is invalid/);
    })

    it('should return default trigger for simple schedule event.', () => {
      let name = 'my_fn', rate = 'cron(* * * * *)'
      const trigger = openwhiskCompileSchedules.compileScheduleTrigger(name, rate) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_${name}_schedule_trigger`,
        content: {
          feed: '/whisk.system/alarms/alarm',
          feed_parameters: {
            cron: '* * * * *',
            trigger_payload: "{}"
          }
        }
      })
    })

    it('should return trigger for object schedule event.', () => {
      const name = 'my_fn'
      const rate = {
        rate: 'cron(* * * * *)',
        trigger: 'trigger_name',
        max: 500,
        params: { hello: 'world' }
      }
      const trigger = openwhiskCompileSchedules.compileScheduleTrigger(name, rate) 
      expect(trigger).to.be.deep.equal({
        name: `trigger_name`,
        content: {
          feed: '/whisk.system/alarms/alarm',
          feed_parameters: {
            cron: '* * * * *',
            trigger_payload: JSON.stringify(rate.params),
            maxTriggers: 500
          }
        }
      })
    })
  })

    /*

  // should throw for incorrect format...
  describe('#getEventSchedules()', () => {
    it('should return all names for simple triggers registered on functions', () => {
      const service = openwhiskCompileSchedules.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({events: [{schedule: "cron(* * * * *)"}, {schedule: "cron(* * * * *)"}]})
      service.getFunction = handler;

      expect(openwhiskCompileSchedules.getEventSchedules()).to.deep.equal(["blah", "foo"])
    })

    /*
    it('should return all names for complex triggers registered on functions', () => {
      const service = openwhiskCompileSchedules.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({events: [{trigger: {name: "blah"}}, {trigger: {name: "foo"}}]})
      service.getFunction = handler;

      expect(openwhiskCompileSchedules.getEventSchedules()).to.deep.equal(["blah", "foo"])
    })
  })

    */
  /*
  describe('#mergeEventSchedules()', () => {
    it('should set up non-existant triggers', () => {
      openwhiskCompileSchedules.serverless.service.resources = {};

      const output = {first: {}, second: {}, third: {}};
      sandbox.stub(openwhiskCompileSchedules, 'getEventSchedules', () => ["first", "second", "third"]);
      openwhiskCompileSchedules.mergeEventSchedules();
      expect(openwhiskCompileSchedules.serverless.service.resources.triggers).to.deep.equal(output)
    });

    it('should ignore existing triggers', () => {
      const triggers = {first: 1, second: 2, third: 3};
      openwhiskCompileSchedules.serverless.service.resources = { triggers };

      sandbox.stub(openwhiskCompileSchedules, 'getEventSchedules', () => ["first", "second", "third"]);
      openwhiskCompileSchedules.mergeEventSchedules();
      expect(openwhiskCompileSchedules.serverless.service.resources.triggers).to.deep.equal(triggers)
    })

  })
  */

});
