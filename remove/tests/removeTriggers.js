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

  const mockTriggerObject = {
    triggerName: 'someTrigger',
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

  describe('#removeTrigger()', () => {
    it('should call removeTriggerHandler with default params', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removeTriggerHandler', () => Promise.resolve());
      const triggers = { myTrigger: {} };
      openwhiskRemove.serverless.service.resources = { triggers };
      const triggerName = 'myTrigger';

      return openwhiskRemove.removeTrigger(triggerName).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ triggerName: 'myTrigger' })).to.be.equal(true);
      });
    });

    it('should call removeTriggerHandler with custom namespace', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removeTriggerHandler', () => Promise.resolve());
      const triggers = { myTrigger: { namespace: 'myNamespace' } };
      openwhiskRemove.serverless.service.resources = { triggers };
      const triggerName = 'myTrigger';

      return openwhiskRemove.removeTrigger(triggerName).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ triggerName: 'myTrigger', namespace: 'myNamespace' }))
          .to.be.equal(true);
      });
    });
  });

  describe('#removeFunctionHandler()', () => {
    it('should remove function handler from openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            triggerName: mockTriggerObject.triggerName,
            namespace: mockTriggerObject.namespace,
          });
          return Promise.resolve();
        };

        return Promise.resolve({ triggers: { delete: stub } });
      });
      return expect(openwhiskRemove.removeTriggerHandler(mockTriggerObject))
        .to.eventually.be.fulfilled;
    });

    it('should resolve even when function handler fails to be removed', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { triggers: { delete: () => Promise.reject(err) } }
      ));
      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removeTriggerHandler(mockTriggerObject).then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[0][0].match(/Failed to delete event trigger \(someTrigger\)/)).to.be.ok;
      })
      return expect(result).to.eventually.be.fulfilled;
    });
  });
});
