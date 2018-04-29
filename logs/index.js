'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');
const moment = require('moment');
const path = require('path');

class OpenWhiskLogs {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');
    this.previous_activations = new Set()

    this.hooks = {
      'logs:logs': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.functionLogs)
    };
  }

  validate () {
  if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    this.serverless.service.getFunction(this.options.function);

    this.options.stage = this.options.stage
      || (this.serverless.service.provider && this.serverless.service.provider.stage)
      || 'dev';
    this.options.region = this.options.region
      || (this.serverless.service.provider && this.serverless.service.provider.region)
      || 'us-east-1';

    this.options.interval = this.options.interval || 1000;

    if (this.options.filter) {
      this.options.filter = new RegExp(this.options.filter, 'i');
    }

    if (this.options.startTime) {
      this.options.startTime = moment(this.options.startTime)
    }

    return this.provider.client().then(client => {
      this.client = client;
    });
  }

  functionLogs () {
    return BbPromise.bind(this)
        .then(this.retrieveInvocationLogs)
        .then(this.filterFunctionLogs)
        .then(this.showFunctionLogs)
        .then(() => {
          if (this.options.tail) {
            this.timeout = setTimeout(() => {
              this.functionLogs()
            }, this.options.interval)
          }
        })
  }

  retrieveInvocationLogs () {
    const functionObject = this.serverless.service.getFunction(this.options.function);

    const options = {
      docs: true,
      limit: 100,
      namespace: '_'
    };

    return this.client.activations.list(options)
      .catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to retrieve activation logs due to error:`
          + ` ${err.message}`
        );
      });
  }

  // activation log annotations have a { key: 'path, value: 'namespace/actioname' } member.
  hasPathAnnotationWithName (annotations, name) {
    return annotations.filter(an => an.key === 'path')
      .map(an => an.value.split('/').slice(1).join('/'))
      .some(value => value === name)
  }

  filterFunctionLogs (logs) {
    const functionObject = this.serverless.service.getFunction(this.options.function);
    const actionName = functionObject.name || `${this.serverless.service.service}_${this.options.function}`

    // skip activations for other actions or that we have seen before 
    const filtered = logs.filter(log => this.hasPathAnnotationWithName((log.annotations || []), actionName)
      && !this.previous_activations.has(log.activationId))

    // allow regexp filtering of log messages
    if (this.options.filter) {
      filtered.forEach(log => {
        log.logs = log.logs.filter(logLine => logLine.match(this.options.filter))
      })
    }
    
    // filter those logs based upon start time
    if (this.options.startTime) {
      filtered.forEach(log => {
        log.logs = log.logs.filter(logLine => {
          const timestamp = logLine.split(" ")[0]
          return this.options.startTime.isBefore(moment(timestamp))
        })
      })
    }
      
    return BbPromise.resolve(filtered);
  }

  showFunctionLogs (logs) {
    if (!this.options.tail && !logs.length) {
      this.consoleLog(`There's no log data for function "${this.options.function}" available right now…`)
      return BbPromise.resolve();
    }

    logs.filter(log => log.logs.length)
      .reverse()
      .map((log, idx, arr) => {
        if (this.timeout && idx === 0) console.log('')

        this.previous_activations.add(log.activationId)
        this.consoleLog(this.formatActivationLine(log))
        log.logs.map(this.formatLogLine).forEach(this.consoleLog)

        if (idx != (arr.length - 1)) {
          this.consoleLog('')
        }
      })
    return BbPromise.resolve();
  }

  formatActivationLine (activation) {
    return `${chalk.blue('activation')} (${chalk.yellow(activation.activationId)}):`
  }

  formatLogLine (logLine) {
    const items = logLine.split(' ').filter(item => item !== '')
    const format = 'YYYY-MM-DD HH:mm:ss.SSS'
    const timestamp = chalk.green(moment(items[0]).utc().format(format))

    let contents = items.slice(2).join(' ')
    if (items[1] === 'stderr:') {
      contents = chalk.red(contents)
    }

    return `${timestamp} ${contents}`
  }

  consoleLog(msg) {
    console.log(msg); // eslint-disable-line no-console
  }
}

module.exports = OpenWhiskLogs;
