'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileCloudant = require('../index');

describe('OpenWhiskCompileCloudant', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileCloudant;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileCloudant = new OpenWhiskCompileCloudant(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { log: () => {} };
    openwhiskCompileCloudant.setup()

  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#processCloudantEvents()', () => {
    it('should call processCloudantEvent for each cloudant event.', () => {
      const service = openwhiskCompileCloudant.serverless.service;
      const fns = {
        first: {
          events: [{}, {cloudant: {package: 'testing_package', db: 'some_db'}}, {trigger: true}]
        },
        second: {
          events: [{cloudant: {package: 'another_package', db: 'some_db'}}]
        },
        third: {}
      }

      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name];

      const spy = openwhiskCompileCloudant.processCloudantEvent = sinon.spy()
      openwhiskCompileCloudant.processCloudantEvents()
      expect(spy.calledTwice).to.be.equal(true)
      expect(spy.withArgs("first", {package: 'testing_package', db: 'some_db'}).calledOnce).to.be.equal(true)
      expect(spy.withArgs("second", {package: 'another_package', db: 'some_db'}).calledOnce).to.be.equal(true)
    })
  })

  describe('#processCloudantEvents()', () => {
    it('should create trigger & rules and update manifest resources.', () => {
      const cloudant = { package: 'some_package', db: 'testing' }
      const fnObj = { events: [{cloudant}] }
      serverless.service.getFunction = () => fnObj
      openwhiskCompileCloudant.compileCloudantTrigger = () => ({name: 'serviceName_fnName_cloudant_testing', content: { a: 1 }})
      openwhiskCompileCloudant.processCloudantEvent("fnName", fnObj.events[0].cloudant)
      expect(fnObj.events[1]).to.be.deep.equal({
        trigger: { name: 'serviceName_fnName_cloudant_testing', rule: 'serviceName_fnName_cloudant_testing_rule' }
      })

      expect(serverless.service.resources.triggers).to.be.deep.equal({serviceName_fnName_cloudant_testing: {a: 1}})
    })
  })

  describe('#compileCloudantTrigger()', () => {
    it('should throw errors for missing db parameter.', () => {
      expect(() => openwhiskCompileCloudant.compileCloudantTrigger('testing', {}))
        .to.throw(Error, 'Cloudant event property (db) missing on function: testing');
    })

    it('should throw errors for missing mandatory parameters without package', () => {
      const config = { db: 'dbname', username: 'user', password: 'password', host: 'hostname' }

      Object.keys(config).forEach(key => {
        const cloned = Object.assign({}, config)
        cloned[key] = ''
        expect(() => openwhiskCompileCloudant.compileCloudantTrigger('testing', cloned))
          .to.throw(Error, `Cloudant event property (${key}) missing on function: testing`);
      })
    })

    it('should return trigger for cloudant provider using package.', () => {
      const db = 'my_db', pkge = '/bluemixOrg_bluemixSpace/packageId'
      const trigger = openwhiskCompileCloudant.compileCloudantTrigger('testing', { db, 'package': pkge }) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_cloudant_${db}`,
        content: {
          feed: `${pkge}/changes`,
          feed_parameters: {
            dbname: `${db}`
          }
        }
      })
    })

    it('should return trigger for cloudant provider with manual configuration.', () => {
      const config = { db: 'dbname', username: 'user', password: 'password', host: 'hostname' }
      const trigger = openwhiskCompileCloudant.compileCloudantTrigger('testing', config) 
      expect(trigger).to.be.deep.equal({
        name: `${serverless.service.service}_testing_cloudant_${config.db}`,
        content: {
          feed: `/whisk.system/cloudant/changes`,
          feed_parameters: {
            username: config.username,
            password: config.password,
            host: config.host,
            dbname: config.db
          }
        }
      })
    })
  })
});
