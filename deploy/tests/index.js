'use strict';

const OpenWhiskDeploy = require('../index');
const expect = require('chai').expect;
const BbPromise = require('bluebird');
const sinon = require('sinon');

describe('OpenWhiskDeploy', () => {
  const CLI = function () { this.log = function () {};};
  const serverless = {classes: {Error, CLI}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };
  const openwhiskDeploy = new OpenWhiskDeploy(serverless, options);
  openwhiskDeploy.serverless.cli = new serverless.classes.CLI();

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskDeploy.hooks).to.be.not.empty);

    it('should run "deploy:initializeResources" hook promise chain in order', () => {
      const initializeResourcesStub = sinon
        .stub(openwhiskDeploy, 'initializeResources').returns(BbPromise.resolve());

      return openwhiskDeploy.hooks['deploy:initializeResources']().then(() => {
        expect(initializeResourcesStub.calledOnce).to.be.equal(true);
        openwhiskDeploy.initializeResources.restore();
      });
    });

    it('should run "deploy:deploy" promise chain in order', () => {
      const deployPackagesStub = sinon
        .stub(openwhiskDeploy, 'deployPackages').returns(BbPromise.resolve());
      const deployFunctionsStub = sinon
        .stub(openwhiskDeploy, 'deployFunctions').returns(BbPromise.resolve());
      const deploySequencesStub = sinon
        .stub(openwhiskDeploy, 'deploySequences').returns(BbPromise.resolve());
      const deployRulesStub = sinon
        .stub(openwhiskDeploy, 'deployRules').returns(BbPromise.resolve());
      const deployTriggersStub = sinon
        .stub(openwhiskDeploy, 'deployTriggers').returns(BbPromise.resolve());
      const deployFeedsStub = sinon
        .stub(openwhiskDeploy, 'deployFeeds').returns(BbPromise.resolve());
      const deployRoutesStub = sinon
        .stub(openwhiskDeploy, 'deployRoutes').returns(BbPromise.resolve());

      return openwhiskDeploy.hooks['deploy:deploy']().then(() => {
        expect(deployPackagesStub.calledOnce).to.be.equal(true);
        expect(deployFunctionsStub.calledOnce).to.be.equal(true);
        expect(deploySequencesStub.calledOnce).to.be.equal(true);
        expect(deployRoutesStub.calledOnce).to.be.equal(true);
        expect(deployRulesStub.calledOnce).to.be.equal(true);
        expect(deployTriggersStub.calledOnce).to.be.equal(true);
        expect(deployFeedsStub.calledOnce).to.be.equal(true);

        openwhiskDeploy.deployFunctions.restore();
      });
    });
  });
});
