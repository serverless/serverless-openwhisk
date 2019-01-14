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
    it('should return empty swagger if functions has no http events', () =>
      expect(openwhiskCompileHttpEvents.compileHttpEvents().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.apigw).to.deep.equal({});
      })).to.eventually.be.fulfilled
    );

    it('should call compileFunctionEvents for each function with events', () => {
      const stub = sinon.stub(openwhiskCompileHttpEvents, 'compileFunctionHttpEvents').returns([{foo: 'bar'}]);

      sandbox.stub(openwhiskCompileHttpEvents.serverless.service, 'getAllFunctions', () => ["first", "second", "third"]);

      sandbox.stub(openwhiskCompileHttpEvents, 'generateSwagger', () => ({"swagger": {}}));
      const handler = name => ({events: {}})
      openwhiskCompileHttpEvents.serverless.service.getFunction = handler;

      return expect(openwhiskCompileHttpEvents.compileHttpEvents().then(() => {
        expect(openwhiskCompileHttpEvents.serverless.service.apigw.swagger).to.deep.equal(
          {swagger: {}}
        );
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
      return expect(result).to.deep.equal({
        relpath: '/api/foo/bar',
        operation: 'GET',
        pkge: 'default',
        namespace: 'sample_ns',
        action: 'my-service_action-name',
        responsetype: 'json'
      });
    });

    it('should define http events from string property with explicit package', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  "GET /api/foo/bar"
      const fnObj = { name: 'somePackage/actionName' }
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', fnObj, http);
      return expect(result).to.deep.equal({
        relpath: '/api/foo/bar',
        operation: 'GET',
        pkge: 'somePackage',
        namespace: 'sample_ns',
        action: 'actionName',
        responsetype: 'json'
      });
    });

    it('should define http events from object property', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET"}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      return expect(result).to.deep.equal({relpath: '/api/foo/bar', operation: 'GET', action: 'my-service_action-name', namespace: 'sample_ns', pkge: 'default', responsetype: 'json'});
    });

    it('should add secure auth key if present', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET"}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {
        annotations: { 'require-whisk-auth': 'auth-token' }
      }, http);
      return expect(result).to.deep.equal({relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token', action: 'my-service_action-name', namespace: 'sample_ns', pkge: 'default', responsetype: 'json'});
    });

    it('should define http events with explicit response type', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service'
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};
      const http =  {path: "/api/foo/bar", method: "GET", resp: 'http'}
      const result = openwhiskCompileHttpEvents.compileHttpEvent('action-name', {}, http);
      return expect(result).to.deep.equal({relpath: '/api/foo/bar', operation: 'GET', action: 'my-service_action-name', namespace: 'sample_ns', pkge: 'default', responsetype: 'http'});
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

  describe('#compileSwaggerPath()', () => {
    it('should define swagger definition from http events', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const result = openwhiskCompileHttpEvents.compileSwaggerPath(httpEvent, host);

      const expectedResult = {
        operationId: "get-/api/foo/bar",
        responses: {
          "200": { description: "A successful invocation response" }
        },
        "x-openwhisk": {
          action: "action-name",
          namespace: "user@host.com_space",
          package: "default",
          url: "https://openwhisk.somewhere.com/api/v1/web/user@host.com_space/default/action-name.json"
        }
      }

      return expect(result).to.deep.equal(expectedResult)
    });
  });

  describe('#compileSwaggerCaseSwitch()', () => {
    it('should define swagger case statement from http events', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const result = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(httpEvent, host);

      const expectedResult = {
        execute: [{
            "set-variable": {
              actions: [{
                  set: "message.headers.X-Require-Whisk-Auth",
                  value: "auth-token"
              }]
            }
          },
          {
            invoke: {
              "target-url": "https://openwhisk.somewhere.com/api/v1/web/user@host.com_space/default/action-name.json",
              "verb": "keep"
            }
          }
        ],
        operations: [ "get-/api/foo/bar" ]
      }

      return expect(result).to.deep.equal(expectedResult)
    });
  });

  describe('#generateSwagger()', () => {
    it('should generate APIGW swagger with paths and case statements from http event', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = "false"
      const swaggerPath = openwhiskCompileHttpEvents.compileSwaggerPath(httpEvent, host)
      const swaggerCase = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(httpEvent, host)
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );
      const swaggerCases = result["x-ibm-configuration"]
        .assembly.execute[0]["operation-switch"].case 

      expect(result.swagger).to.equal("2.0")
      expect(result.basePath).to.equal("/")
      expect(result.info.title).to.equal(service)
      expect(result.info.version).to.equal("1.0")
      expect(result.paths["/api/foo/bar"].get).to.deep.equal(swaggerPath)
      expect(swaggerCases[0]).to.deep.equal(swaggerCase)
    });

    it('should generate APIGW swagger with multiple http events on same path', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const gethttpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const posthttpEvent = {
        relpath: '/api/foo/bar', operation: 'POST', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = "false"

      const getswaggerPath = openwhiskCompileHttpEvents.compileSwaggerPath(gethttpEvent, host)
      const getswaggerCase = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(gethttpEvent, host)
      const postswaggerPath = openwhiskCompileHttpEvents.compileSwaggerPath(posthttpEvent, host)
      const postswaggerCase = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(posthttpEvent, host)

      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ gethttpEvent, posthttpEvent ] );
      const swaggerCases = result["x-ibm-configuration"]
        .assembly.execute[0]["operation-switch"].case 

      expect(result.paths["/api/foo/bar"].get).to.deep.equal(getswaggerPath)
      expect(result.paths["/api/foo/bar"].post).to.deep.equal(postswaggerPath)
      expect(swaggerCases.length).to.equal(2)
      expect(swaggerCases[0]).to.deep.equal(getswaggerCase)
      expect(swaggerCases[1]).to.deep.equal(postswaggerCase)
    });
    
    it('should generate APIGW swagger with multiple http events on different paths', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const gethttpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const posthttpEvent = {
        relpath: '/api/foo/ccc', operation: 'POST', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = "false"

      const getswaggerPath = openwhiskCompileHttpEvents.compileSwaggerPath(gethttpEvent, host)
      const getswaggerCase = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(gethttpEvent, host)
      const postswaggerPath = openwhiskCompileHttpEvents.compileSwaggerPath(posthttpEvent, host)
      const postswaggerCase = openwhiskCompileHttpEvents.compileSwaggerCaseSwitch(posthttpEvent, host)

      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ gethttpEvent, posthttpEvent ] );
      const swaggerCases = result["x-ibm-configuration"]
        .assembly.execute[0]["operation-switch"].case 

      expect(result.paths["/api/foo/bar"].get).to.deep.equal(getswaggerPath)
      expect(result.paths["/api/foo/ccc"].post).to.deep.equal(postswaggerPath)
      expect(swaggerCases.length).to.equal(2)
      expect(swaggerCases[0]).to.deep.equal(getswaggerCase)
      expect(swaggerCases[1]).to.deep.equal(postswaggerCase)
    });

    it('should generate APIGW swagger with default API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = {}
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result["x-ibm-configuration"].cors.enabled).to.equal(true)
    });

    it('should generate APIGW swagger with custom CORS API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { cors: false }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result["x-ibm-configuration"].cors.enabled).to.equal(false)
    });

    it('should generate APIGW swagger with custom basepath API gateway option', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { basepath: "/api" }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.basePath).to.equal(options.basepath)
    });

    it('should generate APIGW swagger with custom API name option', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { name: "my-api" }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.info.title).to.equal(options.name)
    });


    it('should generate APIGW swagger with custom auth key API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { auth: { key: "some-header-key" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{"client_id": []}])
      expect(result.securityDefinitions.client_id).to.deep.equal({"in": "header", type: "apiKey", "x-key-type": "clientId", name: "some-header-key" })
    });

    it('should generate APIGW swagger with custom auth key and secret API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { auth: { key: "some-header-key", secret: "some-header-secret" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{client_id: [], client_secret: []}])
      expect(result.securityDefinitions.client_id).to.deep.equal({"in": "header", type: "apiKey", "x-key-type": "clientId", name: "some-header-key" })
      expect(result.securityDefinitions.client_secret).to.deep.equal({"in": "header", type: "apiKey", "x-key-type": "clientSecret", name: "some-header-secret" })
    });
    
    it('should generate APIGW swagger with AppID OAuth provider API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { oauth: { provider: "app-id", tenant: "some-id" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{"app-id": []}])
      expect(result.securityDefinitions["app-id"]).to.deep.equal({
        flow: "application", tokenUrl: "", type: "oauth2",
        "x-provider": {
          name: "app-id", params: { tenantId: options.oauth.tenant }
        },
        "x-tokenintrospect": { "url": null }
      })
    });

    it('should generate APIGW swagger with Google OAuth provider API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { oauth: { provider: "google" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{"google": []}])
      expect(result.securityDefinitions["google"]).to.deep.equal({
        flow: "application", tokenUrl: "", type: "oauth2",
        "x-provider": { name: "google" },
        "x-tokenintrospect": { url: "https://www.googleapis.com/oauth2/v3/tokeninfo"}
      })
    });

    it('should generate APIGW swagger with Facebook OAuth provider API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { oauth: { provider: "facebook" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{"facebook": []}])
      expect(result.securityDefinitions["facebook"]).to.deep.equal({
        flow: "application", tokenUrl: "", type: "oauth2",
        "x-provider": { name: "facebook" },
        "x-tokenintrospect": { url: "https://graph.facebook.com/debug_token"}
      })
    });

    it('should generate APIGW swagger with Github OAuth provider API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { oauth: { provider: "github" } }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result.security).to.deep.equal([{"github": []}])
      expect(result.securityDefinitions["github"]).to.deep.equal({
        flow: "application", tokenUrl: "", type: "oauth2",
        "x-provider": { name: "github" },
        "x-tokenintrospect": { url: "https://api.github.com/user"}
      })
    });

    it('should generate APIGW swagger with rate limiting API gateway options', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      const options = { rate_limit: { rate: 1000, unit: "minute"} }
      const result = openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ] );

      expect(result["x-ibm-rate-limit"]).to.deep.equal([{rate: 1000, unit: "minute", units: 1}])
    });

    it('should throw if API GW auth options are invalid', () => {
      openwhiskCompileHttpEvents.serverless.service.service = 'my-service' 
      openwhiskCompileHttpEvents.serverless.service.provider = {namespace: "sample_ns"};

      const httpEvent = {
        relpath: '/api/foo/bar', operation: 'GET', secure_key: 'auth-token',
        action: 'action-name', namespace: 'user@host.com_space', pkge: 'default', responsetype: 'json'
      }

      const host = 'openwhisk.somewhere.com'
      const service = "my-service"
      let options = { auth: { secret: "something" } }
      
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /Missing mandatory resources.apigw.auth.key/);

      options = { rate_limit: { } }
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /Missing rate limit parameter: rate/);
      options = { rate_limit: { rate: 1000 } }
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /Missing rate limit parameter: unit/);
      options = { rate_limit: { rate: 1000, unit: 'blah' } }
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /Invalid rate limit parameter: unit/);

      options = { oauth: { provider: 'blah' } }
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /OAuth defined with invalid provider/);

      options = { oauth: { provider: 'app-id' } }
      expect(() => openwhiskCompileHttpEvents.generateSwagger(service, host, options, [ httpEvent ]))
        .to.throw(Error, /OAuth provider app-id defined without tenant parameter/);
    });
  });
});
