'use strict';

const BbPromise = require('bluebird');

module.exports = {
  initializeTriggers () {
    if (!this.serverless.service.resources) {
      this.serverless.service.resources = {};
    }

    if (!this.serverless.service.resources.triggers) {
      this.serverless.service.resources.triggers = {};
    }

    const triggers = this.getEventTriggers();
    const manifestTriggers = this.serverless.service.resources.triggers || {};

    triggers.forEach(trigger => {
      manifestTriggers[trigger] = manifestTriggers[trigger] || {}
    })
  },

  getEventTriggers() {
    const eventTriggers = new Set();

    this.serverless.service.getAllFunctions()
      .map(name => this.serverless.service.getFunction(name))
      .filter(func => func.events)
      .forEach(func => func.events.forEach(event => {
        if (event.trigger) {
          eventTriggers.add(event.trigger.name || event.trigger)
        }
      }));

    return [...eventTriggers];
  },

  initializeRules() {
    const allFunctions = this.serverless.service.getAllFunctions()

    const rules = allFunctions.map(
      functionName => this.getRuleNames(functionName, this.serverless.service.getFunction(functionName))
    ).reduce((a, b) => a.concat(b), [])

    this.serverless.service.rules = rules;
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

  generateDefaultRuleName(functionName, triggerName) {
      return `${this.serverless.service.service}_${triggerName}_to_${functionName}`
  },

  setupResources () {
    this.serverless.cli.log('Setting up resources...');
    this.initializeRules();
    this.initializeTriggers();
    return BbPromise.resolve();
  }
};
