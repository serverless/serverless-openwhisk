'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');
const Credentials = require('../provider/credentials')

class OpenWhiskInfo {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('ibm');

    this.hooks = {
      'info:info': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.info)
    };
  }

  validate() {
    if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    return this.provider.client().then(client => {
      this.client = client;
    });
  }

  info () {
    this.consoleLog(`${chalk.yellow.underline('Service Information')}`);
    this.showServiceInfo();
    this.showActionsInfo();
    this.showTriggersInfo();
    this.showRulesInfo();
    return BbPromise.resolve();
  }

  showServiceInfo () {
    const props = Credentials.getWskProps();
    this.consoleLog(`platform: ${props.apihost}`);
    this.consoleLog(`namespace: ${props.namespace}`);
    this.consoleLog(`service: ${this.serverless.service.service}`);
  }

  showActionsInfo () {
    this.consoleLog(`${chalk.yellow('actions:')}`);
    return this.client.actions.list().then(actions => {
      const names = actions.map(action => action.name).join('    ');
      this.consoleLog(names)
    })
  }

  showTriggersInfo () {
    this.consoleLog(`${chalk.yellow('triggers:')}`);
    return this.client.triggers.list().then(triggers => {
      const names = triggers.map(trigger => trigger.name).join('    ');
      this.consoleLog(names)
    })
  }

  showRulesInfo () {
    this.consoleLog(`${chalk.yellow('rules:')}`);
    return this.client.rules.list().then(rules => {
      const names = rules.map(rule => rule.name).join('    ');
      this.consoleLog(names)
    })
  }

  consoleLog (message) {
    console.log(message)
  }
}

module.exports = OpenWhiskInfo;
