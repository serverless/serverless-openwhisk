'use strict';

const BbPromise = require('bluebird');

const config_properties = ['user', 'password', 'brokers', 'topic', 'admin_url']

class OpenWhiskCompileMessageHub {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');
    this.default_package = '/whisk.system/messaging'

    this.hooks = {
      'before:package:compileEvents': () => BbPromise.bind(this)
        .then(this.setup)
        .then(this.processMessageHubEvents)
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

  validateConfig (fnName, config) {
    if (!config.topic) {
      throw new this.serverless.classes.Error(
        `Message Hub event property (topic) missing on function: ${fnName}`
      )
    }

    if (!config.package) {
      config_properties.forEach(prop => {
        if (!config[prop]) {
          throw new this.serverless.classes.Error(
            `Message Hub event property (${prop}) missing on function: ${fnName}`
          )
        }
      })
    }
  }

  compileMessageHubTrigger (fnName, config) {
    this.validateConfig(fnName, config)
    const name = config.trigger || this.defaultMessageHubName(fnName, config.topic)
    const feed = `${config.package || this.default_package}/messageHubFeed`

    const feed_parameters = { 
      topic: config.topic,
      isJSONData: config.json || false,
      isBinaryKey: config.binary_key || false,
      isBinaryValue: config.binary_value || false
    }

    if (!config.package) {
      feed_parameters.user = config.user
      feed_parameters.password = config.password
      feed_parameters.kafka_brokers_sasl = Array.isArray(config.brokers) ? config.brokers.join(',') : config.brokers
      feed_parameters.kafka_admin_url = config.admin_url
    }

    return { name, content: { feed, feed_parameters } }
  }

  defaultMessageHubName (fnName, topic) {
    return `${this.serverless.service.service}_${fnName}_messagehub_${topic}`
  }

  processMessageHubEvent (fnName, config) {
    const fnObj = this.serverless.service.getFunction(fnName)
    const trigger = this.compileMessageHubTrigger(fnName, config)
    const rule = config.rule || `${this.defaultMessageHubName(fnName, config.topic)}_rule`

    fnObj.events.push({ trigger: { name: trigger.name, rule } })
    this.serverless.service.resources.triggers[trigger.name] = trigger.content
  }

  processMessageHubEvents () {
    this.serverless.service.getAllFunctions().forEach(name => {
      const fn = this.serverless.service.getFunction(name)
      const events = (fn.events || []).filter(e => e.message_hub)
      events.forEach(e => this.processMessageHubEvent(name, e.message_hub))
    })
  }
}

module.exports = OpenWhiskCompileMessageHub
