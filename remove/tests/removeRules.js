'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const OpenWhiskRemove = require('../index');
const Serverless = require('serverless');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('OpenWhiskRemove', () => {
  const serverless = new Serverless();

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
      const stub = sandbox.stub(openwhiskRemove, 'removeRule', () => Promise.resolve());
      const disableStub = sandbox.stub(openwhiskRemove, 'disableRule', () => Promise.resolve());
      sandbox.stub(
        openwhiskRemove, 'getRules', () => ["first", "second"]
      );

      return openwhiskRemove.removeRules().then(() => {
        expect(stub.calledTwice).to.be.equal(true);
        expect(stub.calledWith('first')).to.be.equal(true);
        expect(stub.calledWith('second')).to.be.equal(true);
        expect(disableStub.calledTwice).to.be.equal(true);
        expect(disableStub.calledWith('first')).to.be.equal(true);
        expect(disableStub.calledWith('second')).to.be.equal(true);
        expect(disableStub.calledBefore(stub)).to.be.equal(true);
      });
    });
  });

  describe('#disableRule()', () => {
    it('should disable rule in openwhisk', () => {
      sandbox.stub(openwhiskRemove.provider, 'client', () => {
        const stub = params => {
          expect(params).to.be.deep.equal({
            ruleName: 'myRule',
          });
          return Promise.resolve();
        };

        return Promise.resolve({ rules: { disable: stub } });
      });
      return expect(openwhiskRemove.disableRule('myRule'))
        .to.eventually.be.resolved;
    });

    it('should reject when function handler fails to be disabled with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { rules: { disable: () => Promise.reject(err) } }
      ));
      return expect(openwhiskRemove.disableRule('myRule'))
        .to.eventually.be.rejectedWith(
          new RegExp(`myRule.*${err.message}`)
        );
    });
  })

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
        .to.eventually.be.resolved;
    });

    it('should reject when function handler fails to be removed with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskRemove.provider, 'client', () => Promise.resolve(
        { rules: { delete: () => Promise.reject(err) } }
      ));
      return expect(openwhiskRemove.removeRule('myRule'))
        .to.eventually.be.rejectedWith(
          new RegExp(`myRule.*${err.message}`)
        );
    });
  });
});
