'use strict';

const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployFunctions', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  const fileContents =
    `function main() {
      return {payload: 'Hello world'};
    }`;

  const mockFunctionObject = {
    actionName: 'serviceName_functionName',
    namespace: 'namespace',
    action: {
      exec: { kind: 'nodejs:default', code: fileContents },
      limits: { timeout: 60 * 1000, memory: 256 },
      parameters: [{ key: 'foo', value: 'bar' }],
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

  describe('#deployFunctionHandler()', () => {
    it('should deploy function handler to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal({
            actionName: mockFunctionObject.actionName,
            namespace: mockFunctionObject.namespace,
            action: mockFunctionObject.action,
          });
          return Promise.resolve();
        };

        return Promise.resolve({ actions: { create } });
      });
      return expect(openwhiskDeploy.deployFunctionHandler(mockFunctionObject))
        .to.eventually.be.fulfilled;
    });

    it('should log function deploy information with verbose flag', () => {
      openwhiskDeploy.options.verbose = true
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskDeploy.serverless.cli, 'consoleLog')
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          return Promise.resolve();
        };

        return Promise.resolve({ actions: { create } });
      });

      return openwhiskDeploy.deployFunctionHandler(mockFunctionObject).then(() => {
      expect(log.calledTwice).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal('Deploying Function: serviceName_functionName')
      expect(log.args[1][0]).to.be.equal('Deployed Function: serviceName_functionName')
      })
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ actions: { create } });
      });
      return expect(openwhiskDeploy.deployFunctionHandler(mockFunctionObject))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockFunctionObject.actionName}.*${err.message}`)
        );
    });
  });
});
