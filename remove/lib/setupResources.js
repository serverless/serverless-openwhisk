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

    const triggers = this.getEventTriggers()
    const manifestTriggers = this.serverless.service.resources.triggers || {};

    triggers.forEach(trigger => {
      manifestTriggers[trigger] = manifestTriggers[trigger] || {}
    })
  },

  getEventTriggers() {
    const triggers = new Set();

    this.serverless.service.getAllFunctions()
      .forEach(name => {
        const func = this.serverless.service.getFunction(name);
        const events = func.events || []
        events.forEach(event => {
          if (event.schedule) {
            triggers.add(event.schedule.name || 
              `${this.serverless.service.service}_${name}_schedule_trigger`)
          } else if (event.trigger) {
            triggers.add(event.trigger.name || event.trigger)
          }
        })
      })

    return [...triggers];
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

  getScheduleRuleName(funcName, funcObj, schedule) {
    return schedule.rule || `${this.serverless.service.service}_${funcName}_schedule_rule`
  },

  getRuleNames(functionName, functionObject) {
    if (!functionObject.events) return []

    const triggerRules = functionObject.events
      .filter(e => e.trigger)
      .map(e => this.getRuleName(functionName, functionObject, e.trigger))

    const scheduleRules = functionObject.events
      .filter(e => e.schedule)
      .map(e => this.getScheduleRuleName(functionName, functionObject, e.schedule))

    return triggerRules.concat(scheduleRules)
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
