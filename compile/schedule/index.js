'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompileSchedules {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');
    this.feed = '/whisk.system/alarms/alarm'

    this.hooks = {
      'before:package:compileEvents': () => BbPromise.bind(this)
        .then(this.setup)
        .then(this.processScheduleEvents)
    };
  }

  setup() {
    if (!this.serverless.service.resources) {
      this.serverless.service.resources = {};
    }

    if (!this.serverless.service.resources.triggers) {
      this.serverless.service.resources.triggers = {};
    }

    if (!this.serverless.service.resources.rules) {
      this.serverless.service.resources.rules = {};
    }
 }

  // correct rate syntax is: cron(* * * * *)
  parseScheduleRate (rate) {
    const cron = rate.match(/cron\((.*)\)/)
    if (!cron || !cron[1] || cron[1].split(' ').length !== 5) {
      throw new this.serverless.classes.Error(
        [`Schedule event rate property value is invalid: ${rate}`, 
         'The correct syntax should be "cron(_ _ _ _ _)"'].join('\n')
      )
    }

    return cron[1]
  }

  compileScheduleTrigger (fnName, schedule) {
    const name = schedule.trigger || `${this.serverless.service.service}_${fnName}_schedule_trigger`
    const cron = this.parseScheduleRate(schedule.rate || schedule)
    const trigger_payload = JSON.stringify(schedule.params || {})

    const feed_parameters = { cron, trigger_payload }

    if (schedule.max) {
      feed_parameters.maxTriggers = schedule.max
    }

    return { name, content: { feed: this.feed, feed_parameters } }
  }

  defaultScheduleRuleName (triggerName, fnName) {
    return `${this.serverless.service.service}_${fnName}_schedule_rule`
  }

  processScheduleEvent (fnName, schedule) {
    const fnObj = this.serverless.service.getFunction(fnName)
    const trigger = this.compileScheduleTrigger(fnName, schedule)
    const rule = schedule.rule || this.defaultScheduleRuleName(trigger.name, fnName)

    fnObj.events.push({ trigger: { name: trigger.name, rule } })
    this.serverless.service.resources.triggers[trigger.name] = trigger.content
  }

  processScheduleEvents () {
    this.serverless.service.getAllFunctions().forEach(name => {
      const fn = this.serverless.service.getFunction(name)
      const events = (fn.events || []).filter(e => e.schedule)
      events.forEach(e => this.processScheduleEvent(name, e.schedule))
    })
  }
}

module.exports = OpenWhiskCompileSchedules;
