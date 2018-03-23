'use strict';

const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');
const OpenWhiskRemove = require('../');

describe('OpenWhiskRemove', () => {
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  const CLI = function () { this.log = function () {};};
  const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
  const openwhiskRemove = new OpenWhiskRemove(serverless, options);
  openwhiskRemove.serverless.cli = new serverless.classes.CLI();

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskRemove.hooks).to.be.not.empty);

    it('should have access to the serverless instance', () => {
      expect(openwhiskRemove.serverless).to.deep.equal(serverless);
    });

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskRemove, 'validate').returns(BbPromise.resolve());
      sinon.stub(openwhiskRemove, 'removePackages').returns(BbPromise.resolve());
      sinon.stub(openwhiskRemove, 'removeFunctions').returns(BbPromise.resolve());
      sinon.stub(openwhiskRemove, 'removeTriggers').returns(BbPromise.resolve());
      sinon.stub(openwhiskRemove, 'removeRules').returns(BbPromise.resolve());
      sinon.stub(openwhiskRemove, 'removeRoutes').returns(BbPromise.resolve());

      return openwhiskRemove.hooks['remove:remove']()
        .then(() => {
          expect(validateStub.calledOnce).to.be.equal(true);

          openwhiskRemove.validate.restore();
          openwhiskRemove.removePackages.restore();
          openwhiskRemove.removeFunctions.restore();
          openwhiskRemove.removeRoutes.restore();
          openwhiskRemove.removeTriggers.restore();
          openwhiskRemove.removeRules.restore();
        });
    });
  });
});
