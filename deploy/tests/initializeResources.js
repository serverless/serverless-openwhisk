'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');
const OpenWhiskDeploy = require('../index');

require('chai').use(chaiAsPromised);

describe('#initializeResources()', () => {
  let serverless;
  let sandbox;
  let openwhiskDeploy;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    serverless = {classes: {Error, CLI}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskDeploy = new OpenWhiskDeploy(serverless, options);
    openwhiskDeploy.provider = {props: () => {}};

    serverless.cli = { log: () => {} };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should instantiate openwhisk resources from openwhisk authentication properties', () => {
    const mockObject = {
      apihost: 'blah.blah.com', auth: 'another_user:another_pass', namespace: 'user@user.com',
    };

    sandbox.stub(openwhiskDeploy.provider, 'props', () => Promise.resolve(mockObject));
    return openwhiskDeploy.initializeResources().then(() => {
      expect(openwhiskDeploy.serverless.service.provider).to.deep.equal(mockObject);
    });
  });

  it('should throw error when parameter (OW_AUTH) is missing', () => {
    const mockObject = {
      apihost: 'blah.blah.com', namespace: 'user@user.com',
    };

    sandbox.stub(openwhiskDeploy.provider, 'props', () => Promise.resolve(mockObject));
    return expect(openwhiskDeploy.initializeResources()).to.be.rejectedWith(/OW_AUTH/);
  });

  it('should throw error when parameter (OW_APIHOST) is missing', () => {
    const mockObject = {
      auth: 'user:pass', namespace: 'user@user.com',
    };

    sandbox.stub(openwhiskDeploy.provider, 'props', () => Promise.resolve(mockObject));
    return expect(openwhiskDeploy.initializeResources()).to.be.rejectedWith(/OW_APIHOST/);
  });

  it('should throw error when parameter (OW_NAMESPACE) is missing', () => {
    const mockObject = {
      auth: 'user:pass', apihost: 'blah.blah.com',
    };

    sandbox.stub(openwhiskDeploy.provider, 'props', () => Promise.resolve(mockObject));
    return expect(openwhiskDeploy.initializeResources()).to.be.rejectedWith(/OW_NAMESPACE/);
  });
});
