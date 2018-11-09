'use strict';

const crypto = require('crypto');
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

    serverless.cli = { consoleLog: () => {}, log: () => {} };
    openwhiskCompileHttpEvents.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('#addWebAnnotations()', () => {
    it('should add annotations when http event present', () => {
      openwhiskCompileHttpEvents.serverless.service.functions = {
        a: { events: [ { http: true } ], annotations: {} },
        b: { events: [ { http: true } ], annotations: { foo: 'bar' } },
        c: { events: [ { http: true } ], annotations: { 'web-export': false } },
        d: { events: [ { http: true } ] }
      }

      const auth_string = crypto.randomBytes(64).toString('hex');
      sandbox.stub(openwhiskCompileHttpEvents, 'generateAuthString', () => auth_string);

      return openwhiskCompileHttpEvents.addWebAnnotations().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.functions.a.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': auth_string })
        expect(openwhiskCompileHttpEvents.serverless.service.functions.b.annotations).to.deep.equal({ foo: 'bar', 'web-export': true, 'require-whisk-auth': auth_string })
        expect(openwhiskCompileHttpEvents.serverless.service.functions.c.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': auth_string })
        expect(openwhiskCompileHttpEvents.serverless.service.functions.d.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': auth_string })
      })
    });

    it('should not add auth annotation when annotation already present', () => {
      openwhiskCompileHttpEvents.serverless.service.functions = {
        a: { events: [ { http: true } ], annotations: { 'require-whisk-auth': false } },
        b: { events: [ { http: true } ], annotations: { 'require-whisk-auth': true } },
        c: { events: [ { http: true } ], annotations: { 'require-whisk-auth': 'some string' } }
      }

      return openwhiskCompileHttpEvents.addWebAnnotations().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.functions.a.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': false })
        expect(openwhiskCompileHttpEvents.serverless.service.functions.b.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': true })
        expect(openwhiskCompileHttpEvents.serverless.service.functions.c.annotations).to.deep.equal({ 'web-export': true, 'require-whisk-auth': 'some string' })
      })
    });

    it('should ignore annotations when http event not present', () => {
      openwhiskCompileHttpEvents.serverless.service.functions = {
        a: { },
        b: { events: [] },
        c: { events: [], annotations: { hello: 'world', 'web-export': true } }
      }
      return openwhiskCompileHttpEvents.addWebAnnotations().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.functions.a.annotations).to.be.equal(undefined)
        expect(openwhiskCompileHttpEvents.serverless.service.functions.b.annotations).to.be.equal(undefined)
        expect(openwhiskCompileHttpEvents.serverless.service.functions.c.annotations).to.deep.equal({ hello: 'world', 'web-export': true })
      })
    });
  })

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

    it('should log event when verbose flag is used', () => {
      openwhiskCompileHttpEvents.options.verbose = true
      const log = sandbox.stub(openwhiskCompileHttpEvents.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskCompileHttpEvents.serverless.cli, 'consoleLog')
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileHttpEvent').returns({ foo: 'bar' })
      openwhiskCompileHttpEvents.compileFunctionHttpEvents('name', { events: [
        {"http": true},
        {"http": true},
        {"http": true}
      ] })

      expect(log.calledOnce).to.be.equal(true);
      const result = JSON.stringify([{foo: "bar"}, {foo: "bar"}, {foo: "bar"}])
      expect(log.args[0][0]).to.be.equal(`Compiled API Gateway definition (name): ${result}`);
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
      return expect(result).to.deep.equal({basepath: '/my-service', relpath: '/api/foo/bar', operation: 'GET', action: '/sample_ns/my-service_action-name', responsetype: 'json'});
    });

    it('should add secure auth key if present', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET"}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {
        annotations: { 'require-whisk-auth': 'auth-token' }
      }, http);
      return expect(result).to.deep.equal({basepath: '/my-service', relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token', action: '/sample_ns/my-service_action-name', responsetype: 'json'});
    });

    it('should define http events with explicit response type', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET", resp: 'http'}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      return expect(result).to.deep.equal({basepath: '/my-service', relpath: '/api/foo/bar', operation: 'GET', action: '/sample_ns/my-service_action-name', responsetype: 'http'});
    });

    /**
    it('should define http events with optional API GW parameters', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET", cors: true}
      let result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      expect(result.options).to.deep.equal({cors: true});
      http.cors = false
      result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      expect(result.options).to.deep.equal({cors: false});
    });
    */

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
