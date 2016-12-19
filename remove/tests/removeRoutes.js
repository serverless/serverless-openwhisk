'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const OpenWhiskRemove = require('../index');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('OpenWhiskRemove', () => {
  const CLI = function () { this.log = function () {};};
  const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, defaults: {namespace: ''}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};

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

  describe('#removeRoutes()', () => {
    it('should remove service api gw routes from openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            basepath: '/my-service',
          });
          return Promise.resolve();
        };

        return Promise.resolve({ routes: { delete: stub } });
      });
      return expect(openwhiskRemove.removeRoutes())
        .to.eventually.be.fulfilled;
    });

    it('should still resolve when api gw routes fail to be removed', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { routes: { delete: () => Promise.reject(err) } }
      ));

      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removeRoutes().then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[1][0].match(/Failed to unbind API Gateway routes \(\/helloworld\)/)).to.be.ok;
      })
      return expect(result).to.eventually.be.fulfilled;
    });
  });
});
