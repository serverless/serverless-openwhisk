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

  generateDefaultRuleName(functionName, triggerName) {
      return `${this.serverless.service.service}_${triggerName}_to_${functionName}`
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
  
  getRuleName(funcName, funcObj, trigger) {
    const defaultRuleName = this.generateDefaultRuleName(funcName, trigger);

    if (typeof trigger === 'string') {
      return defaultRuleName
    }
    
    return trigger.rule || defaultRuleName;
  },

  getRuleNames(functionName, functionObject) {
    if (!functionObject.events) return []

    return functionObject.events
      .filter(e => e.trigger)
      .map(e => this.getRuleName(functionName, functionObject, e.trigger))
  },

  getRules() {
    const owRules = {}

    const allFunctions = this.serverless.service.getAllFunctions()

    const functionRules = allFunctions.map(
      functionName => this.getRuleNames(functionName, this.serverless.service.getFunction(functionName))
    ).reduce((a, b) => a.concat(b), [])

    return functionRules
  },

  removeRules() {
    this.serverless.cli.log('Removing Rules...');

    return BbPromise.all(
      this.getRules().map(r => this.disableRule(r).then(() => this.removeRule(r)))
    );
  },
};
