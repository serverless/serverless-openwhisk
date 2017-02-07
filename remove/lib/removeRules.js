'use strict';

const BbPromise = require('bluebird');
const Util = require('./util.js');

module.exports = {
  removeRule (ruleName) {
    const onProvider = ow => ow.rules.delete({ ruleName });
    const errMsgTemplate = `Failed to delete rule (${ruleName}) due to error:`;
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  }, 

  removeRules() {
    if (this.serverless.service.rules.length) {
      this.serverless.cli.log('Removing Rules...');
    }

    return BbPromise.all(
      this.serverless.service.rules.map(r => this.removeRule(r))
    );
  }
};
