'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const openwhisk = require('openwhisk');
const chaiAsPromised = require('chai-as-promised');
const BbPromise = require('bluebird');

require('chai').use(chaiAsPromised);

const OpenwhiskProvider = require('../openwhiskProvider');
const Credentials = require('../credentials');

describe('OpenwhiskProvider', () => {
  let openwhiskProvider;
  let serverless;
  let sandbox;

  const options = {
    stage: 'dev',
    region: 'us-east-1',
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const CLI = function () { this.log = function () {};};
    const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
    openwhiskProvider = new OpenwhiskProvider(serverless, options);
    openwhiskProvider.serverless.cli = new serverless.classes.CLI();
  });

  afterEach(() => {
    sandbox.restore();
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
      const creds = {apihost: 'some_api', auth: 'user:pass'}
      sandbox.stub(openwhiskProvider, "props").returns(BbPromise.resolve(creds))
      return openwhiskProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: undefined, apigwSpaceGuid: undefined, namespace: undefined, apiKey: creds.auth, ignoreCerts: false, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof openwhiskProvider._client).to.not.equal('undefined');
      })
    })

    it('should allow ignore_certs options for openwhisk client', () => {
      openwhiskProvider._client = null
      const creds = {apihost: 'some_api', auth: 'user:pass'}
      sandbox.stub(openwhiskProvider, "props").returns(BbPromise.resolve(creds))
      openwhiskProvider.serverless.service.provider.ignore_certs = true
      return openwhiskProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: undefined, apigwSpaceGuid: undefined, namespace: undefined, apiKey: creds.auth, ignoreCerts: true, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof openwhiskProvider._client).to.not.equal('undefined');
      })
    })

    it('should allow apigw_access_token option for openwhisk client', () => {
      openwhiskProvider._client = null
      const creds = {apihost: 'some_api', auth: 'user:pass', apigw_access_token: 'token'}
      sandbox.stub(openwhiskProvider, "props").returns(BbPromise.resolve(creds))
      return openwhiskProvider.client().then(client => {
        expect(client.actions.client.options).to.be.deep.equal({apigwToken: 'token', apigwSpaceGuid: 'user', namespace: undefined, apiKey: creds.auth, ignoreCerts: false, api: `https://${creds.apihost}/api/v1/`, authHandler: undefined, noUserAgent: undefined})
        expect(typeof openwhiskProvider._client).to.not.equal('undefined');
      })
    })

    it('should cache client instance', () => {
      openwhiskProvider._client = {}
      return openwhiskProvider.client().then(client => {
        expect(client).to.be.equal(openwhiskProvider._client)
      })
    })
  })

  describe('#props()', () => {
    it('should return promise that resolves with provider credentials', () => {
      openwhiskProvider._props = null
      const creds = {apihost: 'some_api', auth: 'user:pass', namespace: 'namespace'}
      sandbox.stub(Credentials, "getWskProps").returns(BbPromise.resolve(creds))
      return openwhiskProvider.props().then(props => {
        expect(props).to.be.deep.equal({auth: creds.auth, namespace: creds.namespace, apihost: creds.apihost})
        expect(typeof openwhiskProvider._props).to.not.equal('undefined');
      })
    });

    it('should return cached provider credentials', () => {
      openwhiskProvider._props = {}
      const stub = sandbox.stub(Credentials, "getWskProps")
      return openwhiskProvider.props().then(props => {
        expect(props).to.be.equal(openwhiskProvider._props)
        expect(stub.called).to.be.equal(false)
      })
    });

    it('should reject promise when getWskProps rejects', () => {
      sandbox.stub(Credentials, "getWskProps").returns(BbPromise.reject())
      return expect(openwhiskProvider.props()).to.eventually.be.rejected;
    });
  });

  describe('#hasValidCreds()', () => {
    it('should throw error when parameter (AUTH) is missing', () => {
      const mockObject = {
        apihost: 'blah.blah.com', namespace: 'user@user.com',
      };

      return expect(() => openwhiskProvider.hasValidCreds(mockObject)).to.throw(/OW_AUTH/);
    });

    it('should throw error when parameter (APIHOST) is missing', () => {
      const mockObject = {
        auth: 'user:pass', namespace: 'user@user.com',
      };

      return expect(() => openwhiskProvider.hasValidCreds(mockObject)).to.throw(/OW_APIHOST/);
    });
  })
})
