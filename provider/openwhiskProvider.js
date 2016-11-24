const BbPromise = require('bluebird');
const openwhisk = require('openwhisk')
const Credentials = require('../util/credentials');

const constants = {
  providerName: 'openwhisk',
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

    return Credentials.getWskProps().then(this.hasValidCreds).then(wskProps => {
      this._client = openwhisk({ api: wskProps.apihost, api_key: wskProps.auth, namespace: wskProps.namespace });
      return this._client
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
