'use strict';

const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployTriggers', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  const mockTriggerObject = {
    triggers: {
      myTrigger: {
        triggerName: 'myTrigger',
        namepspace: 'myNamespace',
        action: 'myAction',
        trigger: 'myTrigger',
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
    openwhiskDeploy.serverless.cli = new serverless.classes.CLI();
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

  describe('#deployTrigger()', () => {
    it('should deploy trigger to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(mockTriggerObject.triggers.myTrigger);
          return Promise.resolve();
        };

        return Promise.resolve({ triggers: { create } });
      });
      return expect(openwhiskDeploy.deployTrigger(mockTriggerObject.triggers.myTrigger))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ triggers: { create } });
      });
      return expect(openwhiskDeploy.deployTrigger(mockTriggerObject.triggers.myTrigger))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockTriggerObject.triggers.myTrigger.triggerName}.*${err.message}`)
        );
    });
  });
});
