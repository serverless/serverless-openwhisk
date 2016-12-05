const BbPromise = require('bluebird');
const openwhisk = require('openwhisk')
const Credentials = require('./credentials');

const constants = {
  providerName: 'ibm',
};

const credentials = ['apihost', 'auth', 'namespace'];

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

  client() {
    if (this._client) return BbPromise.resolve(this._client)

    return this.props().then(this.hasValidCreds).then(wskProps => {
      this._client = openwhisk({ api: wskProps.apihost, api_key: wskProps.auth, namespace: wskProps.namespace });
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
        throw new Error(`Missing mandatory openwhisk configuration property: ${prop.toUpperCase()}.` +
          ' Check .wskprops file or set environment variable?');
      }
    });
    return creds;
  }
}

module.exports = OpenwhiskProvider;
