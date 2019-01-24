'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompileCloudant {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');
    this.default_package = '/whisk.system/cloudant'

    this.hooks = {
      'before:package:compileEvents': () => BbPromise.bind(this)
        .then(this.setup)
        .then(this.processCloudantEvents)
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
    if (!config.db) {
      throw new this.serverless.classes.Error(
        `Cloudant event property (db) missing on function: ${fnName}`
      )
    }

    if (!config.package) {
      const config_properties = ['db', 'password', 'username', 'host']

      if (!config.db) {
        throw new this.serverless.classes.Error(
          `Cloudant event property (db) missing on function: ${fnName}`
        )
      }

      if (!config.host) {
        throw new this.serverless.classes.Error(
          `Cloudant event property (host) missing on function: ${fnName}`
        )
      }

      const has_manual_auth = !!config.username && !!config.password
      const has_iam_auth = !!config.iam_api_key
      if (!has_manual_auth && !has_iam_auth) {
        throw new this.serverless.classes.Error(
          `Cloudant event authentication property (username & password or iam_api_key) missing on function: ${fnName}`
        )
      }

    }
  }

  compileCloudantTrigger (fnName, config) {
    this.validateConfig(fnName, config)
    const name = config.trigger || this.defaultCloudantName(fnName, config.db)
    const feed = `${config.package || this.default_package}/changes`

    const feed_parameters = { 
      dbname: config.db
    }

    if (!config.package) {
      if (config.iam_api_key) {
        feed_parameters.iamApiKey = config.iam_api_key
      } else {
        feed_parameters.username = config.username
        feed_parameters.password = config.password
      }
      feed_parameters.host = config.host
    }

    if (config.max) {
      feed_parameters.maxTriggers = config.max
    }

    if (config.query) {
      feed_parameters.query_params = config.query
    }

    if (config.filter) {
      feed_parameters.filter = config.filter
    }

    return { name, content: { feed, feed_parameters } }
  }

  defaultCloudantName (fnName, db) {
    return `${this.serverless.service.service}_${fnName}_cloudant_${db}`
  }

  processCloudantEvent (fnName, config) {
    const fnObj = this.serverless.service.getFunction(fnName)
    const trigger = this.compileCloudantTrigger(fnName, config)
    const rule = config.rule || `${this.defaultCloudantName(fnName, config.db)}_rule`

    fnObj.events.push({ trigger: { name: trigger.name, rule } })
    this.serverless.service.resources.triggers[trigger.name] = trigger.content
  }

  processCloudantEvents () {
    this.serverless.service.getAllFunctions().forEach(name => {
      const fn = this.serverless.service.getFunction(name)
      const events = (fn.events || []).filter(e => e.cloudant)
      events.forEach(e => this.processCloudantEvent(name, e.cloudant))
    })
  }
}

module.exports = OpenWhiskCompileCloudant
