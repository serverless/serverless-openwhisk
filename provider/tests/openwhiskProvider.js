'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const openwhisk = require('openwhisk');
const chaiAsPromised = require('chai-as-promised');
const BbPromise = require('bluebird');

require('chai').use(chaiAsPromised);

const OpenwhiskProvider = require('../openwhiskProvider');
const Serverless = require('serverless');
const Credentials = require('../../util/credentials');

describe('OpenwhiskProvider', () => {
  let openwhiskProvider;
  let serverless;
  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };

  beforeEach(() => {
    serverless = new Serverless(options);
    openwhiskProvider = new OpenwhiskProvider(serverless, options);
    openwhiskProvider.serverless.cli = new serverless.classes.CLI();
  });

  describe('#getProviderName()', () => {
    it('should return the provider name', () => {
      expect(OpenwhiskProvider.getProviderName()).to.equal('openwhisk');
    });
  });

  describe('#constructor()', () => {
    it('should set Serverless instance', () => {
      expect(typeof openwhiskProvider.serverless).to.not.equal('undefined');
    });

    it('should set OpenWhisk instance', () => {
      expect(typeof openwhiskProvider.sdk).to.not.equal('undefined');
    });

    it('should set the provider property', () => {
      expect(openwhiskProvider.provider).to.equal(openwhiskProvider);
    });
  });

  describe('#client()', () => {
    it('should return pre-configured openwhisk client', () => {
      openwhiskProvider._client = null 
      const creds = {apihost: 'some_api', auth: 'user:pass', namespace: 'namespace'}
      const stub = sinon.stub(Credentials, "getWskProps").returns(BbPromise.resolve(creds))
      return openwhiskProvider.client().then(client => {
        expect(client.actions.options).to.be.deep.equal({api_key: creds.auth, ignore_certs: undefined, namespace: creds.namespace, api: creds.apihost})
        expect(typeof openwhiskProvider._client).to.not.equal('undefined');
      })
      stub.restore()
    })

    it('should cache client instance', () => {
      openwhiskProvider._client = {} 
      return openwhiskProvider.client().then(client => {
        expect(client).to.be.equal(openwhiskProvider._client)
      })
    })
  })

  describe('#hasValidCreds()', () => {
    it('should throw error when parameter (AUTH) is missing', () => {
      const mockObject = {
        apihost: 'blah.blah.com', namespace: 'user@user.com',
      };

      return expect(() => openwhiskProvider.hasValidCreds(mockObject)).to.throw(/AUTH/);
    });

    it('should throw error when parameter (APIHOST) is missing', () => {
      const mockObject = {
        auth: 'user:pass', namespace: 'user@user.com',
      };

      return expect(() => openwhiskProvider.hasValidCreds(mockObject)).to.throw(/APIHOST/);
    });

    it('should throw error when parameter (NAMESPACE) is missing', () => {
      const mockObject = {
        auth: 'user:pass', apihost: 'blah.blah.com',
      };

      return expect(() => openwhiskProvider.hasValidCreds(mockObject)).to.throw(/NAMESPACE/);
    });
  })
}) 
