'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileTriggers = require('../index');

describe('OpenWhiskCompileTriggers', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileTriggers;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileTriggers = new OpenWhiskCompileTriggers(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { consoleLog: () => {}, log: () => {} };
    openwhiskCompileTriggers.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getEventTriggers()', () => {
    it('should return all names for simple triggers registered on functions', () => {
      const service = openwhiskCompileTriggers.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({events: [{trigger: "blah"}, {trigger: "foo"}]})
      service.getFunction = handler;

      expect(openwhiskCompileTriggers.getEventTriggers()).to.deep.equal(["blah", "foo"])
    })

    it('should return all names for complex triggers registered on functions', () => {
      const service = openwhiskCompileTriggers.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({events: [{trigger: {name: "blah"}}, {trigger: {name: "foo"}}]})
      service.getFunction = handler;

      expect(openwhiskCompileTriggers.getEventTriggers()).to.deep.equal(["blah", "foo"])
    })
  })

  describe('#mergeEventTriggers()', () => {
    it('should set up non-existant triggers', () => {
      openwhiskCompileTriggers.serverless.service.resources = {};

      const output = {first: {}, second: {}, third: {}};
      sandbox.stub(openwhiskCompileTriggers, 'getEventTriggers', () => ["first", "second", "third"]);
      openwhiskCompileTriggers.mergeEventTriggers();
      expect(openwhiskCompileTriggers.serverless.service.resources.triggers).to.deep.equal(output)
    });

    it('should ignore existing triggers', () => {
      const triggers = {first: 1, second: 2, third: 3};
      openwhiskCompileTriggers.serverless.service.resources = { triggers };

      sandbox.stub(openwhiskCompileTriggers, 'getEventTriggers', () => ["first", "second", "third"]);
      openwhiskCompileTriggers.mergeEventTriggers();
      expect(openwhiskCompileTriggers.serverless.service.resources.triggers).to.deep.equal(triggers)
    })

  })

  describe('#compileTriggers()', () => {
    it('should throw an error if the resource section is not available', () => {
      openwhiskCompileTriggers.serverless.service.triggers = null;
      expect(() => openwhiskCompileTriggers.compileTriggers())
        .to.throw(Error, /Missing Triggers section/);
    });

    it('should return empty triggers if manifest has no triggers', () =>
      expect(openwhiskCompileTriggers.compileTriggers()).to.eventually.fulfilled
    );

    it('should call compileTrigger for each trigger definition', () => {
      const triggers = { a: {}, b: {}, c: {} };
      const stub = sinon.stub(openwhiskCompileTriggers, 'compileTrigger');
      openwhiskCompileTriggers.serverless.service.resources.triggers = triggers;
      openwhiskCompileTriggers.serverless.service.triggers = {};
      return expect(openwhiskCompileTriggers.compileTriggers().then(() => {
        expect(stub.calledThrice).to.be.equal(true);
        Object.keys(triggers).forEach(
          key => expect(stub.calledWith(key, triggers[key])).to.be.equal(true)
        );
      })).to.eventually.be.fulfilled;
    });

    it('should update trigger definitions from manifest values', () => {
      const trigger = { overwrite: true, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        triggerName: 'sample',
        overwrite: true,
        namespace: 'another_ns',
        parameters: [{ key: 'hello', value: 'world' }],
      };
      openwhiskCompileTriggers.serverless.service.resources.triggers = { sample: trigger };
      return expect(openwhiskCompileTriggers.compileTriggers().then(() =>
        expect(openwhiskCompileTriggers.serverless.service.triggers)
          .to.deep.equal({ sample: expected })
      )).to.eventually.be.fulfilled;
    });
  });

  describe('#compileTriggerFeed()', () => {
    it('should define trigger feed without parameters', () => {
      const expected = {
        trigger: '/ns/testing',
        feedName: 'package/action',
        namespace: 'ns',
        params: {},
      };
      const result
        = openwhiskCompileTriggers.compileTriggerFeed('/ns/testing', '/ns/package/action', {});
      return expect(result).to.deep.equal(expected);
    });
    it('should define trigger feed with parameters', () => {
      const expected = {
        trigger: '/ns/testing',
        feedName: 'package/action',
        namespace: 'ns',
        params: {
          hello: 'world',
        },
      };
      const result = openwhiskCompileTriggers
        .compileTriggerFeed('/ns/testing', '/ns/package/action', { hello: 'world' });
      return expect(result).to.deep.equal(expected);
    });
  });

  describe('#compileTrigger()', () => {
    it('should define triggers without a body', () => {
      const testing = { triggerName: 'testing', namespace: 'testing', overwrite: false };
      const result = openwhiskCompileTriggers.compileTrigger('testing', testing);
      return expect(result).to.deep.equal(testing);
    });

    it('should define triggers with manifest params', () => {
      const params = { overwrite: true, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        triggerName: 'testing',
        overwrite: true,
        namespace: 'another_ns',
        parameters: [{ key: 'hello', value: 'world' }],
      };
      const result = openwhiskCompileTriggers.compileTrigger('testing', params);
      return expect(result).to.deep.equal(expected);
    });

    it('should define triggers with feed manifest params', () => {
      const feedName = '/ns/package/feed';
      const params = { feed: feedName, feed_parameters: { hello: 'world' } };
      const expected = {
        triggerName: 'myTrigger',
        overwrite: true,
        namespace: 'testing',
        feed: {
          feedName: 'package/feed',
          namespace: 'ns',
          trigger: '/testing/myTrigger',
          params: params.feed_parameters,
        },
      };
      const result = openwhiskCompileTriggers.compileTrigger('myTrigger', params);
      return expect(result).to.deep.equal(expected);
    });

    it('should log triggers to console when verbose flag is set', () => {
      openwhiskCompileTriggers.options.verbose = true
      const log = sandbox.stub(openwhiskCompileTriggers.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskCompileTriggers.serverless.cli, 'consoleLog')
      const feedName = '/ns/package/feed';
      const params = { feed: feedName, feed_parameters: { hello: 'world' } };
      const expected = {
        triggerName: 'myTrigger',
        overwrite: true,
        namespace: 'testing',
        feed: {
          feedName: 'package/feed',
          namespace: 'ns',
          trigger: '/testing/myTrigger',
          params: params.feed_parameters,
        },
      };
      const result = openwhiskCompileTriggers.compileTrigger('myTrigger', params);
      expect(log.calledOnce).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal(`Compiled Trigger (myTrigger): ${JSON.stringify(result)}`)
    });
  });
});
