'use strict';

const BbPromise = require('bluebird');

module.exports = {
  disableRule(ruleName) {
    const onSuccess = ow => ow.rules.disable({ ruleName });
    const errMsgTemplate =
      `Failed to disable rule (${ruleName}) due to error:`;
    const onErr = err => BbPromise.reject(
      new this.serverless.classes.Error(`${errMsgTemplate}: ${err.message}`)
    );

    return this.provider.client().then(onSuccess).catch(onErr);
  },

  removeRule(ruleName) {
    const onSuccess = ow => ow.rules.delete({ ruleName });
    const errMsgTemplate =
      `Failed to delete rule (${ruleName}) due to error:`;
    const onErr = err => BbPromise.reject(
      new this.serverless.classes.Error(`${errMsgTemplate}: ${err.message}`)
    );

    return this.provider.client().then(onSuccess).catch(onErr);
  },
  
  removeRules() {
    this.serverless.cli.log('Removing Rules...');

    return BbPromise.all(
      this.serverless.service.rules.map(r => this.disableRule(r).then(() => this.removeRule(r)))
    );
  },
};
