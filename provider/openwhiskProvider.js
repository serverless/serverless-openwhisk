'use strict';

const BbPromise = require('bluebird');
const openwhisk = require('openwhisk')
const IamTokenManager = require('@ibm-functions/iam-token-manager')
const CliTokenManager = require('./cliTokenManager')
const Credentials = require('./credentials');

const constants = {
  providerName: 'openwhisk',
};

const credentials = ['apihost', 'auth'];

class OpenwhiskProvider {
  static getProviderName() {
    return constants.providerName;
  }

  constructor(serverless) {
    this.serverless = serverless;
    this.provider = this;
    this.serverless.setProvider(constants.providerName, this);
    this.sdk = openwhisk
  }

  // Returns OpenWhisk SDK client configured with authentication credentials.
  // Auto-detects use of IAM namespaces when using IBM Cloud Functions and adds
  // external auth handler to client.
  client() {
    if (this._client) return BbPromise.resolve(this._client)

    const ignore_certs = this.serverless.service.provider.ignore_certs || false
    return this.props().then(props => {
      if (props.hasOwnProperty('iam_namespace_api_key')) {
        const auth_handler = new IamTokenManager({ iamApikey: props.iam_namespace_api_key });
        this._client = openwhisk({ apihost: props.apihost, auth_handler, namespace: props.namespace });
      } else if (this.isIBMCloudIAMProps(props)) {
        const auth_handler = new CliTokenManager()
        this._client = openwhisk({ apihost: props.apihost, auth_handler, namespace: props.namespace });
      } else {
        this.hasValidCreds(props)
        this._client = openwhisk({ apihost: props.apihost, api_key: props.auth, namespace: props.namespace, ignore_certs, apigw_token: props.apigw_access_token });
      }

      return this._client
    })
  }

  props() {
    if (this._props) return BbPromise.resolve(this._props)

    return Credentials.getWskProps().then(wskProps => {
      this._props = wskProps;
      return this._props;
    })
  }

  hasValidCreds(creds) {
    credentials.forEach(prop => {
      if (!creds[prop]) {
        throw new Error(`Missing mandatory openwhisk configuration property: OW_${prop.toUpperCase()}.` +
          ' Check .wskprops file or set environment variable?');
      }
    });
    return creds;
  }

  // Auto-detect whether ~/.wskprops uses IBM Cloud IAM namespace (and therefore requires IAM auth handler).
  // Namespace will be IAM NS ID rather than default namespace. Api host will end with ibm.com hostname.
  isIBMCloudIAMProps (props) {
    return props.namespace !== '_' && props.apihost.endsWith('cloud.ibm.com')
  }
}

module.exports = OpenwhiskProvider;
