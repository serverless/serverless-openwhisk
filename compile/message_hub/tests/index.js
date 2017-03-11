'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileMessageHub = require('../index');

describe('OpenWhiskCompileMessageHub', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileMessageHub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileMessageHub = new OpenWhiskCompileMessageHub(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { log: () => {} };
    openwhiskCompileMessageHub.setup()

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#processMessageHubEvents()', () => {
    it('should call processMessageHubEvent for each message hub event.', () => {
      const service = openwhiskCompileMessageHub.serverless.service;
      const fns = {
        first: {
          events: [{}, {message_hub: {package: 'testing_package', topic: 'some_topic'}}, {trigger: true}]
        },
        second: {
          events: [{message_hub: {package: 'another_package', topic: 'some_topic'}}]
        },
        third: {}
      }

      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name];

      const spy = openwhiskCompileMessageHub.processMessageHubEvent = sinon.spy()
      openwhiskCompileMessageHub.processMessageHubEvents()
      expect(spy.calledTwice).to.be.equal(true)
      expect(spy.withArgs("first", {package: 'testing_package', topic: 'some_topic'}).calledOnce).to.be.equal(true)
      expect(spy.withArgs("second", {package: 'another_package', topic: 'some_topic'}).calledOnce).to.be.equal(true)
    })
  })

  describe('#processMessageHubEvents()', () => {
    it('should create trigger & rules and update manifest resources.', () => {
      const message_hub = { package: 'some_package', topic: 'testing' }
      const fnObj = { events: [{message_hub}] }
      serverless.service.getFunction = () => fnObj
      openwhiskCompileMessageHub.compileMessageHubTrigger = () => ({name: 'serviceName_fnName_messagehub_testing', content: { a: 1 }})
      openwhiskCompileMessageHub.processMessageHubEvent("fnName", fnObj.events[0].message_hub)
      expect(fnObj.events[1]).to.be.deep.equal({
        trigger: { name: 'serviceName_fnName_messagehub_testing', rule: 'serviceName_fnName_messagehub_testing_rule' }
      })

      expect(serverless.service.resources.triggers).to.be.deep.equal({serviceName_fnName_messagehub_testing: {a: 1}})
    })
  })

  describe('#compileMessageHubTrigger()', () => {
    it('should throw errors for missing topic parameter.', () => {
      expect(() => openwhiskCompileMessageHub.compileMessageHubTrigger('testing', {}))
        .to.throw(Error, 'Message Hub event property (topic) missing on function: testing');
    })

    it('should throw errors for missing mandatory parameters without package', () => {
      const config = { topic: 'topic', user: 'user', password: 'password', admin_url: 'url', brokers: 'brokers' }

      Object.keys(config).forEach(key => {
        const cloned = Object.assign({}, config)
        cloned[key] = ''
        expect(() => openwhiskCompileMessageHub.compileMessageHubTrigger('testing', cloned))
          .to.throw(Error, `Message Hub event property (${key}) missing on function: testing`);
      })
    })

    it('should return trigger for message hub provider using package.', () => {
      const topic = 'my_topic', pkge = '/bluemixOrg_bluemixSpace/packageId'
      const trigger = openwhiskCompileMessageHub.compileMessageHubTrigger('testing', { topic, 'package': pkge }) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_messagehub_${topic}`,
        content: {
          feed: `${pkge}/messageHubFeed`,
          feed_parameters: {
            topic: `${topic}`,
            isJSONData: false,
            isBinaryKey: false,
            isBinaryValue: false
          }
        }
      })
    })

    it('should return trigger for message hub provider using package with options.', () => {
      const topic = 'my_topic', pkge = '/bluemixOrg_bluemixSpace/packageId'
      const trigger = openwhiskCompileMessageHub.compileMessageHubTrigger('testing', { json: true, binary_value: true, binary_key: true, topic, 'package': pkge }) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_messagehub_${topic}`,
        content: {
          feed: `${pkge}/messageHubFeed`,
          feed_parameters: {
            topic: `${topic}`,
            isJSONData: true,
            isBinaryKey: true,
            isBinaryValue: true 
          }
        }
      })
    })

    it('should return trigger with minimum message hub config properties.', () => {
      const config = { topic: 'topic', user: 'user', password: 'password', admin_url: 'url', brokers: 'brokers' }
      const trigger = openwhiskCompileMessageHub.compileMessageHubTrigger('testing', config) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_messagehub_${config.topic}`,
        content: {
          feed: `/whisk.system/messaging/messageHubFeed`,
          feed_parameters: {
            kafka_brokers_sasl: config.brokers,
            user: config.user,
            password: config.password,
            topic: config.topic,
            kafka_admin_url: config.admin_url,
            isJSONData: false,
            isBinaryKey: false,
            isBinaryValue: false 
          }
        }
      })
    })

    it('should return trigger with optional message hub config properties.', () => {
      const config = { json: true, binary_key: true, binary_value: true, topic: 'topic', user: 'user', password: 'password', admin_url: 'url', brokers: ['a', 'b', 'c'] }
      const trigger = openwhiskCompileMessageHub.compileMessageHubTrigger('testing', config) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_messagehub_${config.topic}`,
        content: {
          feed: `/whisk.system/messaging/messageHubFeed`,
          feed_parameters: {
            kafka_brokers_sasl: config.brokers.join(','),
            user: config.user,
            password: config.password,
            topic: config.topic,
            kafka_admin_url: config.admin_url,
            isJSONData: true,
            isBinaryKey: true,
            isBinaryValue: true
          }
        }
      })
    })
  })
});
