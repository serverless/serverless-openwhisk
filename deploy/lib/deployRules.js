'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployRule(rule) {
    return this.provider.client().then(ow =>
      this.disableRule(rule).then(rule => ow.rules.create(rule)).catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy rule (${rule.ruleName}) due to error: ${err.message}`
        );
      })
    );
  },

  disableRule(rule) {
    return new Promise((resolve, reject) => {
      this.provider.client().then(ow =>
          ow.rules.disable(rule).then(() => resolve(rule)).catch(() => resolve(rule))
      );
    })
  },

  deployRules() {
    this.serverless.cli.log('Deploying Rules...');
    const rules = this.serverless.service.rules;
    return BbPromise.all(Object.keys(rules).map(t => this.deployRule(rules[t])));
  },
};
