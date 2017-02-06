'use strict';

const expect = require('chai').expect;
const OpenWhiskDeploy = require('../index');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('deployFeeds', () => {
  let serverless;
  let openwhiskDeploy;
  let sandbox;

  const mockFeedObject = {
    feeds: {
      myFeed: {
        feedName: 'myFeed',
      },
    },
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    serverless = {classes: {Error, CLI}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskDeploy = new OpenWhiskDeploy(serverless, options);
    openwhiskDeploy.serverless.cli = new serverless.classes.CLI();
    openwhiskDeploy.serverless.service.provider = {
      namespace: 'testing',
      apihost: 'openwhisk.org',
      auth: 'user:pass',
    };
    openwhiskDeploy.provider = { client: () => {} }
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#deployFeeds()', () => {
    it('should call deployFeed for each registered trigger feed', () => {
      const stub = sandbox.stub(openwhiskDeploy, 'deployFeed', () => {});

      const triggerWithFeed = { feed: { feedName: 'blah' } };
      openwhiskDeploy.serverless.service.triggers
        = { myTrigger: triggerWithFeed, anotherTrigger: {}, finalTrigger: triggerWithFeed };

      return openwhiskDeploy.deployFeeds().then(() => {
        expect(stub.calledTwice).to.be.equal(true);
        expect(stub.calledWith(triggerWithFeed.feed)).to.be.equal(true);
      });
    });
    it('should not log anything for empty feeds', () => {
      openwhiskDeploy.serverless.service.triggers = {};
      const log = sandbox.stub(openwhiskDeploy.serverless.cli, 'log');
      return openwhiskDeploy.deployFeeds().then(() => {
        console.log(log.called)
        expect(log.called).to.be.equal(false);
      });
    })
  });

  describe('#deployFeed()', () => {
    it('should deploy feed to openwhisk', () => {
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = params => {
          expect(params).to.be.deep.equal(mockFeedObject.feeds.myFeed);
          return Promise.resolve();
        };

        return Promise.resolve({ feeds: { create } });
      });
      return expect(openwhiskDeploy.deployFeed(mockFeedObject.feeds.myFeed))
        .to.eventually.be.fulfilled;
    });

    it('should reject when function handler fails to deploy with error message', () => {
      const err = { message: 'some reason' };
      sandbox.stub(openwhiskDeploy.provider, 'client', () => {
        const create = () => Promise.reject(err);

        return Promise.resolve({ feeds: { create } });
      });
      return expect(openwhiskDeploy.deployFeed(mockFeedObject.feeds.myFeed))
        .to.eventually.be.rejectedWith(
          new RegExp(`${mockFeedObject.feeds.myFeed.feedName}.*${err.message}`)
        );
    });
  });
});
