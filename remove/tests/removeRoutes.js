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

  describe('#removeRoutes()', () => {
    it('should not remove routes when http events not defined.', () => {
      const fnDefs = {
        none: {
        },
        has_event: {
          events: [{trigger: true}, {schedule: true}]
        }
      } 
      openwhiskRemove.serverless.service.getAllFunctions = () => Object.keys(fnDefs)
      openwhiskRemove.serverless.service.getFunction = (name) => fnDefs[name]
 
      const stub = sinon.stub().returns(Promise.resolve())

      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        return Promise.resolve({ routes: { delete: stub } });
      });

      return openwhiskRemove.removeRoutes().then(() => {
        expect(stub.called).to.be.equal(false);
      })
    });

    it('should remove service api gw routes from openwhisk', () => {
      const fnDefs = {
        has_event: {
          events: [{http: true}]
        }
      } 
      openwhiskRemove.serverless.service.getAllFunctions = () => Object.keys(fnDefs)
      openwhiskRemove.serverless.service.getFunction = (name) => fnDefs[name]
 
      const stub = sinon.stub().returns(Promise.resolve())
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        return Promise.resolve({ routes: { delete: stub } });
      });

      const result = openwhiskRemove.removeRoutes().then(() => {
        expect(stub.called).to.be.equal(true);
        expect(stub.args[0][0]).to.be.deep.equal({
          basepath: '/'
        });
      })
      return expect(result).to.eventually.be.fulfilled;
    });

    it('should still resolve when api gw routes fail to be removed', () => {
      const fnDefs = {
        has_event: {
          events: [{http: true}]
        }
      } 
      openwhiskRemove.serverless.service.getAllFunctions = () => Object.keys(fnDefs)
      openwhiskRemove.serverless.service.getFunction = (name) => fnDefs[name]


      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { routes: { delete: () => Promise.reject(err) } }
      ));

      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removeRoutes().then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[1][0].match(/Failed to unbind API Gateway routes \(\/\)/)).to.be.ok;
      })
      return expect(result).to.eventually.be.fulfilled;
    });
  });
});
