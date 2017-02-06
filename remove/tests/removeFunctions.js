'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const OpenWhiskRemove = require('../index');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('OpenWhiskRemove', () => {
  const CLI = function () { this.log = function () {};};
  const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};

  let openwhiskRemove;
  let sandbox;

  const mockFunctionObject = {
    actionName: 'serviceName_functionName',
    namespace: 'namespace',
  };

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskRemove = new OpenWhiskRemove(serverless, options);
    openwhiskRemove.serverless.cli = new serverless.classes.CLI();
    openwhiskRemove.serverless.service.service = 'helloworld';
    openwhiskRemove.provider = {client: () => {}};
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#removeFunction()', () => {
    it('should call removeFunctionHandler with default params', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removeFunctionHandler', () => Promise.resolve());
      const retValue = { name: 'name', namespace: 'namespace' };
      sandbox.stub(openwhiskRemove.serverless.service, 'getFunction', () => retValue);
      const functionName = 'testing';

      return openwhiskRemove.removeFunction(functionName).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ actionName: 'name', namespace: 'namespace' })).to.be.equal(true);
      });
    });

    it('should call removeFunctionHandler without functionObject name or namespace', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removeFunctionHandler', () => Promise.resolve());
      const nothing = {};
      sandbox.stub(openwhiskRemove.serverless.service, 'getFunction', () => nothing);
      const functionName = 'testing';

      return openwhiskRemove.removeFunction(functionName).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ actionName: 'helloworld_testing' })).to.be.equal(true);
      });
    });
  });

  describe('#removeFunctionHandler()', () => {
    it('should remove function handler from openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            actionName: mockFunctionObject.actionName,
            namespace: mockFunctionObject.namespace,
          });
          return Promise.resolve();
        };

        return Promise.resolve({ actions: { delete: stub } });
      });
      return expect(openwhiskRemove.removeFunctionHandler(mockFunctionObject))
        .to.eventually.be.fulfilled;
    });

    it('should still resolve when function handler fails to be removed', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { actions: { delete: () => Promise.reject(err) } }
      ));

      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removeFunctionHandler(mockFunctionObject).then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[0][0].match(/Failed to delete function service \(serviceName_functionName\)/)).to.be.ok;
      })
      return expect(result).to.eventually.be.fulfilled;
    });
  });
});
