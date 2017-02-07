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

  const mockRuleObject = {
    myRule: 'myTrigger',
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

  describe('#removeRules()', () => {
    it('should call removeRule for each rule', () => {
      openwhiskRemove.serverless.service.rules = ["first", "second"]
      const stub = sandbox.stub(openwhiskRemove, 'removeRule', () => Promise.resolve());

      return openwhiskRemove.removeRules().then(() => {
        expect(stub.calledTwice).to.be.equal(true);
        expect(stub.calledWith('first')).to.be.equal(true);
        expect(stub.calledWith('second')).to.be.equal(true);
      });
    });
  });

  describe('#removeRule()', () => {
    it('should remove rule handler from openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            ruleName: 'myRule',
          });
          return Promise.resolve();
        };

        return Promise.resolve({ rules: { delete: stub } });
      });
      return expect(openwhiskRemove.removeRule('myRule'))
        .to.eventually.be.fulfilled;
    });

    it('should resolve even if function handler fails to be removed', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { rules: { delete: () => Promise.reject(err) } }
      ));
      const log = sandbox.stub(openwhiskRemove.serverless.cli, "log");
      const result = openwhiskRemove.removeRule('myRule').then(() => {
        expect(log.called).to.be.equal(true);
        expect(log.args[0][0].match(/Failed to delete rule \(myRule\)/)).to.be.ok;
      })
      return expect(result)
        .to.eventually.be.fulfilled;
    });
  });
});
