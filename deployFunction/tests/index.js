'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const OpenWhiskDeployFunction = require('../index');
const BbPromise = require('bluebird');

require('chai').use(chaiAsPromised);

describe('OpenWhiskDeployFunction', () => {
  let serverless;
  let openwhiskDeployFunction;
  let sandbox

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    serverless = {pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => {}, provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskDeployFunction = new OpenWhiskDeployFunction(serverless, options);
    openwhiskDeployFunction.serverless.cli = new serverless.classes.CLI();
    openwhiskDeployFunction.serverless.service.provider = {
      namespace: 'testing',
      apihost: 'openwhisk.org',
      auth: 'user:pass',
    };
    openwhiskDeployFunction.provider = {client: () => {}}
  });

  afterEach(() => {
    sandbox.restore();
  });


  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskDeployFunction.hooks).to.be.not.empty);
  });

  describe('hooks', () => {
    it('should run "deploy:function:initialize" promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskDeployFunction, 'validate').returns(BbPromise.resolve());

      return openwhiskDeployFunction.hooks['deploy:function:initialize']().then(() => {
        expect(validateStub.calledOnce).to.equal(true);
        openwhiskDeployFunction.validate.restore()
      });
    });

    it('should run "deploy:function:packageFunction" promise chain in order', () => {
      const packageFunctionStub = sinon
        .stub(openwhiskDeployFunction, 'packageFunction').returns(BbPromise.resolve());
      const compileFunctionStub = sinon
        .stub(openwhiskDeployFunction, 'compileFunction').returns(BbPromise.resolve());

      return openwhiskDeployFunction.hooks['deploy:function:packageFunction']().then(() => {
        expect(packageFunctionStub.calledOnce).to.equal(true);
        expect(compileFunctionStub.calledOnce).to.equal(true);
        expect(compileFunctionStub.calledAfter(packageFunctionStub))
          .to.equal(true);

        openwhiskDeployFunction.packageFunction.restore();
        openwhiskDeployFunction.compileFunction.restore();
      });
    });

    it('should run "deploy:function:deploy" promise chain in order', () => {
      const deployFunctionStub = sinon
        .stub(openwhiskDeployFunction, 'deployFunction').returns(BbPromise.resolve());
      const cleanupStub = sinon
        .stub(openwhiskDeployFunction, 'cleanup').returns(BbPromise.resolve());

      return openwhiskDeployFunction.hooks['deploy:function:deploy']().then(() => {
        expect(deployFunctionStub.calledOnce).to.equal(true);
        expect(cleanupStub.calledAfter(deployFunctionStub))
          .to.equal(true);

        openwhiskDeployFunction.deployFunction.restore();
        openwhiskDeployFunction.cleanup.restore();
      });
    });
  });

  describe('#packageFunction()', () => {
    it('should not package sequence actions', () => {
      const fObj = {sequence: ['a', 'b', 'c']}
      const spy = sinon.spy()
      openwhiskDeployFunction.pkg = { packageFunction: spy }

      const getFunctionStub = sinon.stub(openwhiskDeployFunction.serverless.service, "getFunction").returns(fObj)

      return openwhiskDeployFunction.packageFunction().then(() => {
        expect(spy.called).to.be.false
      })
    })
  })

  describe('#compileFunction()', () => {
    it('should store compiled function on instance', () => {
      const fObj = {handler: "file.main"}
      const action = {name: "action"}
      const getFunctionStub = sinon.stub(openwhiskDeployFunction.serverless.service, "getFunction").returns(fObj)
      const compileFunctionStub = sinon.stub(openwhiskDeployFunction.compileFunctions, "compileFunction").returns(BbPromise.resolve(action))

      return openwhiskDeployFunction.compileFunction().then(() => {
        expect(openwhiskDeployFunction.action).to.be.equal(action);
        getFunctionStub.restore();
        compileFunctionStub.restore();
      })
    })
  })

  describe('#deployFunction()', () => {
    it('should deploy function to openwhisk', () => {
      openwhiskDeployFunction.action = {actionName: "sample"}
      sandbox.stub(openwhiskDeployFunction.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(openwhiskDeployFunction.action);
          return Promise.resolve();
        };

        return Promise.resolve({ actions: { create } });
      });
      return expect(openwhiskDeployFunction.deployFunction())
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeployFunction.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ actions: { create } });
      });
      return expect(openwhiskDeployFunction.deployFunction())
        .to.eventually.be.rejected;
    });
  });
});
