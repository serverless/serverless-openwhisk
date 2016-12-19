'use strict';
const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployHttpEvents', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    serverless = {classes: {Error, CLI}, service: {provider: {}, defaults: {namespace: ''}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskDeploy = new OpenWhiskDeploy(serverless, options);
    openwhiskDeploy.serverless.cli = new serverless.classes.CLI();
    openwhiskDeploy.serverless.service.service = 'my-service'
    openwhiskDeploy.serverless.service.defaults = {
      namespace: 'testing',
      apihost: 'openwhisk.org',
      auth: 'user:pass',
    };
    openwhiskDeploy.provider = { client: () => {} }
  });

  afterEach(() => {
    sandbox.restore();
  });

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
  });
});
