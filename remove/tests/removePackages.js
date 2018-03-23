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

  const mockPackageObject = {
    name: 'somePackage',
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

  describe('#removePackage()', () => {
    it('should call removePackageHandler with default params', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removePackageHandler', () => Promise.resolve());
      const packages = { myPackage: {} };
      openwhiskRemove.serverless.service.resources = { packages };
      const name = 'myPackage';

      return openwhiskRemove.removePackage(name).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ name: 'myPackage' })).to.be.equal(true);
      });
    });

    it('should call removePackageHandler with custom namespace', () => {
      const stub = sandbox.stub(openwhiskRemove, 'removePackageHandler', () => Promise.resolve());
      const packages = { myPackage: { namespace: 'myNamespace' } };
      openwhiskRemove.serverless.service.resources = { packages };
      const name = 'myPackage';

      return openwhiskRemove.removePackage(name).then(() => {
        expect(stub.calledOnce).to.be.equal(true);
        expect(stub.calledWith({ name: 'myPackage', namespace: 'myNamespace' }))
          .to.be.equal(true);
      });
    });
  });

  describe('#removeFunctionHandler()', () => {
    it('should remove function handler from openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            name: mockPackageObject.name,
            namespace: mockPackageObject.namespace,
          });
          return Promise.resolve();
        };

        return Promise.resolve({ packages: { delete: stub } });
      });
      return expect(openwhiskRemove.removePackageHandler(mockPackageObject))
        .to.eventually.be.fulfilled;
    });

    it('should resolve even when function handler fails to be removed', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { packages: { delete: () => Promise.reject(err) } }
      ));
      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removePackageHandler(mockPackageObject).then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[0][0].match(/Failed to delete package \(somePackage\)/)).to.be.ok;
      })
      return expect(result).to.eventually.be.fulfilled;
    });
  });
});
