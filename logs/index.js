'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');
const path = require('path');
const ClientFactory = require('../util/client_factory');

class OpenWhiskLogs {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('ibm');

    this.hooks = {
      'logs:logs': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.retrieveInvocationLogs)
        .then(this.filterFunctionLogs)
        .then(this.showFunctionLogs)
    };
  }

  validate () {
  if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    this.serverless.service.getFunction(this.options.function);

    this.options.stage = this.options.stage
      || (this.serverless.service.defaults && this.serverless.service.defaults.stage)
      || 'dev';
    this.options.region = this.options.region
      || (this.serverless.service.defaults && this.serverless.service.defaults.region)
      || 'us-east-1';

    return ClientFactory.fromWskProps().then(client => {
      this.client = client;
    });
  }

  retrieveInvocationLogs () {
    const functionObject = this.serverless.service.getFunction(this.options.function);

    const options = {
      docs: true,
      limit: 100
    };

    if (functionObject.namespace) {
      options.namespace = functionObject.namespace;
    }

    return this.client.activations.list(options)
      .catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to retrieve activation logs due to error:`
          + ` ${err.message}`
        );
      });
  }

  filterFunctionLogs (logs) {
    const functionObject = this.serverless.service.getFunction(this.options.function);
    const actionName = functionObject.name || `${this.serverless.service.service}_${this.options.function}`

    return BbPromise.resolve(logs.filter(log => log.name === actionName));
  }

  showFunctionLogs (logs) {
    if (!logs.length) {
      this.consoleLog(`There's no log data for function "${this.options.function}" available right now…`)
      return BbPromise.resolve();
    }

    // NEED TO FORMAT LOG WITH COLOURS AND STDOUT/STDERR
    logs.forEach(log => {
      log.logs.forEach(logLine => {
        const items = logLine.split(' ')
        const msg = `${log.activationId} ${items[0]} ${items.slice(2).join(' ')}`
        this.consoleLog(msg)
      })
    })
    return BbPromise.resolve();
  }

  // NEED TO ADD TAIL AND OTHER PARAMETERS.
  consoleLog(msg) {
    console.log(msg); // eslint-disable-line no-console
  }
}

module.exports = OpenWhiskLogs;
