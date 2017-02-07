'use strict';

const BbPromise = require('bluebird');
const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileHttpEvents = require('../index');

describe('OpenWhiskCompileHttpEvents', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileHttpEvents;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileHttpEvents = new OpenWhiskCompileHttpEvents(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { log: () => {} };
    openwhiskCompileHttpEvents.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#compileHttpEvents()', () => {
    it('should return empty rules if functions has no triggers', () =>
      expect(openwhiskCompileHttpEvents.compileHttpEvents().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.apigw).to.deep.equal([]);
      })).to.eventually.be.fulfilled
    );

    it('should call compileFunctionRule and update rules for each function with events', () => {
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileFunctionHttpEvents').returns([{foo: 'bar'}]);

      sandbox.stub(openwhiskCompileHttpEvents.serverless.service, 'getAllFunctions', () => ["first", "second", "third"]);

      const handler = name => ({events: {}})
      openwhiskCompileHttpEvents.serverless.service.getFunction = handler;

      return expect(openwhiskCompileHttpEvents.compileHttpEvents().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.apigw).to.deep.equal([
          {foo: 'bar'}, {foo: 'bar'}, {foo: 'bar'}
        ]);
        expect(stub.calledThrice).to.be.equal(true);
      })).to.eventually.be.fulfilled;
    });
  });

  describe('#compileFunctionHttpEvents()', () => {
    it('should not call compileHttpEvents when events parameter is missing', () => {
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileHttpEvent')
      const events = openwhiskCompileHttpEvents.compileFunctionHttpEvents('name', {})
      expect(events).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })
    
    it('should not call compileHttpEvents when events list contains no events', () => {
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileHttpEvent')
      const events = openwhiskCompileHttpEvents.compileFunctionHttpEvents('name', { events: [{"trigger": {}}] })
      expect(events).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })

    it('should call compileHttpEvents when events list contains triggers', () => {
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileHttpEvent').returns({})
      const events = openwhiskCompileHttpEvents.compileFunctionHttpEvents('name', { events: [
        {"http": true},
        {"http": true},
        {"http": true}
      ] })
      expect(events).to.deep.equal([{}, {}, {}]);
      expect(stub.calledThrice).to.be.equal(true);
    })
  });

  describe('#compileHttpEvent()', () => {
    it('should define http events from string property', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  "GET /api/foo/bar"
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      return expect(result).to.deep.equal({basepath: '/my-service', relpath: '/api/foo/bar', operation: 'GET', action: '/sample_ns/my-service_action-name'});
    });

    it('should define http events from object property', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET"}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      return expect(result).to.deep.equal({basepath: '/my-service', relpath: '/api/foo/bar', operation: 'GET', action: '/sample_ns/my-service_action-name'});
    });

    it('should throw if http event value invalid', () => {
      expect(() => openwhiskCompileHttpEvents.compileHttpEvent('', {}, 'OPERATION'))
        .to.throw(Error, /Incorrect HTTP event/);
      expect(() => openwhiskCompileHttpEvents.compileHttpEvent('', {}, {}))
        .to.throw(Error, /Incorrect HTTP event/);
      expect(() => openwhiskCompileHttpEvents.compileHttpEvent('', {}, {method: true}))
        .to.throw(Error, /Incorrect HTTP event/);
      expect(() => openwhiskCompileHttpEvents.compileHttpEvent('', {}, {path: true}))
        .to.throw(Error, /Incorrect HTTP event/);
    });
  });
});
