'use strict';

const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployPackages', () => {
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

  describe('#deployPackage()', () => {
    it('should deploy package to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(mockPackageObject.packages.myPackage);
          return Promise.resolve();
        };

        return Promise.resolve({ packages: { create } });
      });
      return expect(openwhiskDeploy.deployPackage(mockPackageObject.packages.myPackage))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ packages: { create } });
      });
      return expect(openwhiskDeploy.deployPackage(mockPackageObject.packages.myPackage))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockPackageObject.packages.myPackage.name}.*${err.message}`)
        );
    });

    it('should log package deploy information with verbose flag', () => {
      openwhiskDeploy.options.verbose = true
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskDeploy.serverless.cli, 'consoleLog')
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          return Promise.resolve();
        };

        return Promise.resolve({ packages: { create } });
      });

      return openwhiskDeploy.deployPackage(mockPackageObject.packages.myPackage).then(() => {
      expect(log.calledTwice).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal('Deploying Package: myPackage')
      expect(log.args[1][0]).to.be.equal('Deployed Package: myPackage')
      })
    })
  });
});
