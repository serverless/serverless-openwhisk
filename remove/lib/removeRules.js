'use strict';

const BbPromise = require('bluebird');
const Util = require('./util.js');

module.exports = {
  modifyRule(ruleName, operation) {
    const onProvider = ow => ow.rules[operation]({ ruleName });
    const errMsgTemplate = `Failed to ${operation} rule (${ruleName}) due to error:`;
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  },

  disableRule (ruleName) {
    return this.modifyRule(ruleName, 'disable')
  }, 

  removeRule (ruleName) {
    return this.modifyRule(ruleName, 'delete')
  }, 

  removeRules() {
    if (this.serverless.service.rules.length) {
      this.serverless.cli.log('Removing Rules...');
    }

    return BbPromise.all(
      this.serverless.service.rules.map(r => this.disableRule(r).then(() => this.removeRule(r)))
    );
  }
};
