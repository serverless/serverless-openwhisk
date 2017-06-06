'use strict';
const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployRules', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  const mockRuleObject = {
    rules: {
      myRule: {
        ruleName: 'myRule',
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

  describe('#deployRule()', () => {
    it('should deploy function handler to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(mockRuleObject.rules.myRule);
          return Promise.resolve();
        };

        return Promise.resolve({ rules: { create } });
      });
      return expect(openwhiskDeploy.deployRule(mockRuleObject.rules.myRule))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ rules: { create } });
      });
      return expect(openwhiskDeploy.deployRule(mockRuleObject.rules.myRule))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockRuleObject.rules.myRule.ruleName}.*${err.message}`)
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

        return Promise.resolve({ rules: { create } });
      });

      return openwhiskDeploy.deployRule(mockRuleObject.rules.myRule).then(() => {
      expect(log.calledTwice).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal('Deploying Rule: myRule')
      expect(log.args[1][0]).to.be.equal('Deployed Rule: myRule')
      })
    });
  });

  describe('#enableRule()', () => {
    it('should call enable rule on openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const enable = params => {
          expect(params).to.be.deep.equal(mockRuleObject.rules.myRule);
          return Promise.resolve();
        };

        return Promise.resolve({ rules: { enable } });
      });
      return expect(openwhiskDeploy.enableRule(mockRuleObject.rules.myRule))
        .to.eventually.be.fulfilled;
    });

    it('should reject when enable rule fails with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const enable = () => Promise.reject(err);

        return Promise.resolve({ rules: { enable } });
      });
      return expect(openwhiskDeploy.enableRule(mockRuleObject.rules.myRule))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockRuleObject.rules.myRule.ruleName}.*${err.message}`)
        );
    });

  });

  describe('#deployRules()', () => {
    it('should call deployRule & enableRule for each rule', () => {
      const deployStub = sandbox.stub(openwhiskDeploy, 'deployRule', () => Promise.resolve());
      const enableStub = sandbox.stub(openwhiskDeploy, 'enableRule', () => Promise.resolve());

      openwhiskDeploy.serverless.service.rules
        = { hello: {}, foo: {} };

      return openwhiskDeploy.deployRules().then(() => {
        expect(deployStub.calledTwice).to.be.equal(true);
        expect(deployStub.calledWith({})).to.be.equal(true);
        expect(enableStub.calledTwice).to.be.equal(true);
        expect(enableStub.calledWith({})).to.be.equal(true);
      });
    });
    it('should not log anything for empty feeds', () => {
      openwhiskDeploy.serverless.service.rules = {};
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log');
      return openwhiskDeploy.deployRules().then(() => {
        console.log(log.called)
        expect(log.called).to.be.equal(false);
      });
    })
  });
});
