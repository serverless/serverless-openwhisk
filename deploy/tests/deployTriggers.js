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
        namespace: 'myNamespace',
        action: 'myAction',
        trigger: 'myTrigger',
      },
      feedTrigger: {
        triggerName: 'myTrigger',
        namespace: 'myNamespace',
        action: 'myAction',
        trigger: 'myTrigger',
        feed: '/whisk.system/alarms/alarm',
      },
    },
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {}; };
    serverless = { classes: { Error, CLI }, service: { provider: {}, resources: {}, getAllFunctions: () => [] }, getProvider: sandbox.spy() };
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
    openwhiskDeploy.provider = { client: () => {} };
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

    it('should log function deploy information with verbose flag', () => {
      openwhiskDeploy.options.verbose = true;
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log');
      const clog = sandbox.stub(openwhiskDeploy.serverless.cli, 'consoleLog');
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => Promise.resolve();

        return Promise.resolve({ triggers: { create } });
      });

      return openwhiskDeploy.deployTrigger(mockTriggerObject.triggers.myTrigger).then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0]).to.be.equal('Deploying Trigger: myTrigger');
        expect(log.args[1][0]).to.be.equal('Deployed Trigger: myTrigger');
      });
    });

    it('should deploy trigger with feed annotation to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(mockTriggerObject.triggers.feedTrigger);
          return Promise.resolve();
        };

        return Promise.resolve({ triggers: { create } });
      });
      return expect(openwhiskDeploy.deployTrigger(mockTriggerObject.triggers.feedTrigger))
        .to.eventually.be.fulfilled;
    });
  });
});
