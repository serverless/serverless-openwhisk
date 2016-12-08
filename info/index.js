'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');

class OpenWhiskInfo {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

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

    return this.provider.props().then(props => {
      this.props = props;
      return this.provider.client();
    }).then(client => {
      this.client = client;
    })
  }

  info () {
    this.consoleLog(`${chalk.yellow.underline('Service Information')}`);

    return BbPromise.bind(this)
      .then(this.showServiceInfo)
      .then(this.showActionsInfo)
      .then(this.showTriggersInfo)
      .then(this.showRulesInfo);
  }

  showServiceInfo () {
    this.consoleLog(`platform:\t${this.props.apihost}`);
    this.consoleLog(`namespace:\t${this.props.namespace}`);
    this.consoleLog(`service:\t${this.serverless.service.service}\n`);
  }

  showActionsInfo () {
    this.consoleLog(`${chalk.yellow('actions:')}`);
    return this.client.actions.list().then(actions => {
      if (!actions.length) return console.log('**no actions deployed**\n');
      const names = actions.map(action => action.name).join('    ');
      this.consoleLog(names + '\n')
    })
  }

  showTriggersInfo () {
    this.consoleLog(`${chalk.yellow('triggers:')}`);
    return this.client.triggers.list().then(triggers => {
      if (!triggers.length) return console.log('**no triggers deployed**\n');
      const names = triggers.map(trigger => trigger.name).join('    ');
      this.consoleLog(names + '\n')
    })
  }

  showRulesInfo () {
    this.consoleLog(`${chalk.yellow('rules:')}`);
    return this.client.rules.list().then(rules => {
      if (!rules.length) return console.log('**no rules deployed**');
      const names = rules.map(rule => rule.name).join('    ');
      this.consoleLog(names)
    })
  }

  consoleLog (message) {
    console.log(message)
  }
}

module.exports = OpenWhiskInfo;
