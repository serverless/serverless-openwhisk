'use strict';

const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployServiceBindings', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  const mockPackageObject = {
    packages: {
      myPackage: {
        name: 'myPackage',
        namespace: 'myNamespace'
      },
    },
  };

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

  describe('#configureServiceBindings()', () => {
    it('should call binding command for each binding and return when all finish', () => {
      const bindings = [[{name: 'a'}, {name: 'a'}, {name: 'a'}]]
      openwhiskDeploy.serverless.service.bindings = { fns: bindings, packages: bindings }
      sandbox.stub(openwhiskDeploy, 'configureServiceBinding', () => {
        return Promise.resolve();
      });
      return openwhiskDeploy.configureServiceBindings().then(results => {
        expect(results.length).to.equal(bindings.length)
      })
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const bindings = [[{name: 'a'}, {name: 'a'}, {name: 'a'}]]
      openwhiskDeploy.serverless.service.bindings = { fns: bindings, packages: bindings }
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy, 'configureServiceBinding', () => {
        return Promise.reject(err);
      });

      return expect(openwhiskDeploy.configureServiceBindings())
        .to.eventually.be.rejectedWith(new RegExp(`${err.message}`));
    });
  });
});
