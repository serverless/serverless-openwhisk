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

  describe('#replaceDefaultNamespace()', async () => {
    it('should return same swagger doc without default namespace', async () => {
      const source = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const swagger = JSON.parse(source)

      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const list = params => {
          return Promise.resolve();
        };

        return Promise.resolve({ actions: { list } });
      });

      let result = await openwhiskDeploy.replaceDefaultNamespace(swagger)
      expect(result).to.be.deep.equal(swagger)
    })

    it('should replace default namespace in swagger doc', async () => {
      const without_default_ns = fs.readFileSync('./deploy/tests/resources/swagger.json', 'utf-8')
      const with_default_ns = fs.readFileSync('./deploy/tests/resources/swagger_default_ns.json', 'utf-8')
      const source = JSON.parse(with_default_ns)
      const converted = JSON.parse(without_default_ns)

      const actions = [{"name":"hello","namespace":"user@host.com_dev"}]

      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const list = params => {
          return Promise.resolve(actions);
        };

        return Promise.resolve({ actions: { list } });
      });

      let result = await openwhiskDeploy.replaceDefaultNamespace(source)
      expect(result).to.be.deep.equal(converted)
    })
  })

  /**
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
  */

/**
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
  */
 
  describe('#deployRouteSwagger()', () => {
    it('should deploy api gw route handler to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal({foo: 'bar'});
          return Promise.resolve();
        };

        return Promise.resolve({ routes: { create } });
      });
      return expect(openwhiskDeploy.deployRouteSwagger({foo: 'bar'}))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ routes: { create } });
      });
      return expect(openwhiskDeploy.deployRouteSwagger({relpath: '/foo/bar'}))
        .to.eventually.be.rejectedWith(
          new RegExp(`${err.message}`)
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

      return openwhiskDeploy.deployRouteSwagger({foo: 'bar'}).then(() => {
      expect(log.calledTwice).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal('Deploying API Gateway Route: ' + JSON.stringify({foo: 'bar'}))
      expect(log.args[1][0]).to.be.equal('Deployed API Gateway Route: ' + JSON.stringify({foo: 'bar'}))
      })
    });
  });
});
