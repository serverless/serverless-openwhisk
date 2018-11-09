'use strict';
const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const fs = require('fs');

require('chai').use(chaiAsPromised);

describe('deployHttpEvents', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    serverless = {classes: {Error, CLI}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskDeploy = new OpenWhiskDeploy(serverless, options);
    openwhiskDeploy.serverless.cli = { consoleLog: () => {}, log: () => {} };
    openwhiskDeploy.serverless.service.service = 'my-service'
    openwhiskDeploy.serverless.service.provider = {
      namespace: 'testing',
      apihost: 'openwhisk.org',
      auth: 'user:pass',
    };
    openwhiskDeploy.provider = { client: () => {} }
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#deployOptionalRoutesConfig()', () => {
    it('should not call API GW unless config present', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => Promise.reject('No config present!'))
      return expect(openwhiskDeploy.deployOptionalRoutesConfig())
        .to.eventually.be.fulfilled;
    })

    it('should call API GW when config present', () => {
      let called = false
      sandbox.stub(openwhiskDeploy, 'updateRoutesConfig', (basepath, config) => {
        called = true
        expect(basepath).to.be.equal('/my-service')
        expect(config).to.be.deep.equal(openwhiskDeploy.serverless.service.resources.apigw)
        return Promise.resolve({})
      });

      openwhiskDeploy.serverless.service.resources = {
        apigw: { cors: true }
      }
      const result = openwhiskDeploy.deployOptionalRoutesConfig()

      result.then(() => expect(called).to.be.equal(true))
      return expect(result).to.eventually.be.fulfilled;
    })
  })

  describe('#unbindAllRoutes()', () => {
    it('should deploy api gw route handler to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const del = params => {
          expect(params).to.be.deep.equal({basepath: '/my-service'});
          return Promise.resolve();
        };

        return Promise.resolve({ routes: { delete: del } });
      });
      return expect(openwhiskDeploy.unbindAllRoutes())
        .to.eventually.be.fulfilled;
    });

    it('should ignore errors unbinding routes to openwhisk', () => {

      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const del = () => Promise.reject(err);

        return Promise.resolve({ routes: { delete: del } });
      });
      return expect(openwhiskDeploy.unbindAllRoutes())
        .to.eventually.be.fulfilled;
    });

  });

  describe('#configRouteSwagger()', () => {
    it('should update swagger with CORS config parameter', () => {
      const source = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const swagger = JSON.parse(source)
      const options = { cors: false }
      let result = openwhiskDeploy.configRouteSwagger(swagger, options)
      expect(result['x-ibm-configuration'].cors.enabled).to.be.equal(false)

      swagger['x-ibm-configuration'].cors.enabled = false
      options.cors = true
      result = openwhiskDeploy.configRouteSwagger(swagger, options)
      expect(result['x-ibm-configuration'].cors.enabled).to.be.equal(true)
    })

    it('should maintain existing swagger config parameters', () => {
      const source = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const swagger = JSON.parse(source)
      swagger['x-ibm-configuration'].test = 'value'
      const options = { cors: false }
      let result = openwhiskDeploy.configRouteSwagger(swagger, options)
      expect(result['x-ibm-configuration'].test).to.be.equal('value')
    })

    it('should leave swagger the same without config parameters', () => {
      const source = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const swagger = JSON.parse(source)
      const options = { }
      const result = openwhiskDeploy.configRouteSwagger(swagger, options)
      expect(result).to.be.deep.equal(swagger)
    })
  })

  describe('#updateRouteConfig()', () => {
    it('should retrieve and deploy updated api gw route swagger to openwhisk', () => {
      const source = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const swagger = JSON.parse(source)

      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const get = params => {
          expect(params).to.be.deep.equal({basepath: '/my-service'});
          return Promise.resolve({ apis: [{value: {apidoc:swagger}}]});
        };

        const create = params => {
          expect(params.swagger).to.be.deep.equal(swagger);
          return Promise.resolve({});
        };

        return Promise.resolve({ routes: { get: get, create: create } });
      });
      return expect(openwhiskDeploy.updateRoutesConfig('/my-service', {random: false}))
        .to.eventually.be.fulfilled;
    });
  });
 
  describe('#deploySequentialRoutes()', () => {
    it('should deploy each route in sequential order', () => {
      let inflight = 0
      let count = 0
      const routes = [
        {order: 0}, {order: 1}, {order: 2} 
      ];
      sandbox.stub(openwhiskDeploy, 'deployRoute', r => {
        expect(inflight).to.equal(0)
        expect(count).to.equal(r.order)
        inflight += 1
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            inflight -= 1
            count++
            expect(inflight).to.equal(0)
            resolve()
          }, 10)
        })
      });
      return openwhiskDeploy.deploySequentialRoutes(routes).then(() => {
        expect(count).to.equal(routes.length)
      })
    });
  });

  describe('#deployRoute()', () => {
    it('should deploy api gw route handler to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal({foo: 'bar'});
          return Promise.resolve();
        };

        return Promise.resolve({ routes: { create } });
      });
      return expect(openwhiskDeploy.deployRoute({foo: 'bar'}))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ routes: { create } });
      });
      return expect(openwhiskDeploy.deployRoute({relpath: '/foo/bar'}))
        .to.eventually.be.rejectedWith(
          new RegExp(`/foo/bar.*${err.message}`)
        );
    });

    it('should log function deploy information with verbose flag', () => {
      openwhiskDeploy.options.verbose = true
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskDeploy.serverless.cli, 'consoleLog')
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          return Promise.resolve();
        };

        return Promise.resolve({ routes: { create } });
      });

      return openwhiskDeploy.deployRoute({foo: 'bar'}).then(() => {
      expect(log.calledTwice).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal('Deploying API Gateway Route: ' + JSON.stringify({foo: 'bar'}))
      expect(log.args[1][0]).to.be.equal('Deployed API Gateway Route: ' + JSON.stringify({foo: 'bar'}))
      })
    });

  });
});
