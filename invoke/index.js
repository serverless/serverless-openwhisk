'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');
const path = require('path');
const stdin = require('get-stdin');
const fse = require('fs-extra');

const CmdLineParamsOptions = {
  type: ['blocking', 'nonblocking'],
  log: ['result', 'response'],
};

class OpenWhiskInvoke {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'invoke:invoke': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.invoke)
        .then(this.log),
    };
  }

  validate() {
    if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    this.serverless.service.getFunction(this.options.function);

    return new Promise((resolve, reject) => {
      if (this.options.data) {
        resolve();
      } else if (this.options.path) {
        const absolutePath = path.isAbsolute(this.options.path) ?
          this.options.path :
          path.join(this.serverless.config.servicePath, this.options.path);
        if (!this.serverless.utils.fileExistsSync(absolutePath)) {
          throw new this.serverless.classes.Error('The file you provided does not exist.');
        }
        this.options.data = this.readFileSync(absolutePath);
        console.log(typeof this.options.data)

        if (this.options.data == null) {
          throw new this.serverless.classes.Error(
            'The file path provided must point to a JSON file with a top-level JSON object definition.'
          );
        }
        resolve();
      } else {
        return this.getStdin().then(input => {
          this.options.data = input || '{}';
          resolve();
        });
      }
    }).then(() => {
      try {
        this.options.data = JSON.parse(this.options.data);
        if (this.options.data == null || typeof this.options.data !== 'object') throw new this.serverless.classes.Error('Data parameter must be a JSON object')
        
          } catch (exception) {
        throw new this.serverless.classes.Error(
          `Error parsing data parameter as JSON: ${exception}`
        );
      }
    }).then(() => {
      this.validateParamOptions();

      return this.provider.client().then(client => {
        this.client = client;
      });
    });
  }

  readFileSync(path) {
    return fse.readFileSync(path);
  }

  getStdin() {
    return stdin()
  }
  // ensure command-line parameter values is a valid option.
  validateParamOptions() {
    Object.keys(CmdLineParamsOptions).forEach(key => {
      if (!this.options[key]) {
        this.options[key] = CmdLineParamsOptions[key][0];
      } else if (!CmdLineParamsOptions[key].find(i => i === this.options[key])) {
        const options = CmdLineParamsOptions[key].join(' or ');
        throw new this.serverless.classes.Error(
          `Invalid ${key} parameter value, must be either ${options}.`
        );
      }
    });
  }

  invoke() {
    const functionObject = this.serverless.service.getFunction(this.options.function);

    const options = {
      blocking: this.isBlocking(),
      actionName: functionObject.name
        || `${this.serverless.service.service}_${this.options.function}`,
    };

    if (functionObject.namespace) {
      options.namespace = functionObject.namespace;
    }

    if (this.options.data) {
      options.params = this.options.data;
    }

    return this.client.actions.invoke(options)
      .catch(err => this.formatErrMsg(err));
  }

  formatErrMsg (err) {
    let err_msg = `Failed to invoke function service (${this.options.function}) due to error:`
    const base_err = err.error
    if (base_err.response && base_err.response.result && typeof base_err.response.result.error === 'string') {
      err.message = base_err.response.result.error
      err_msg = `Failed to invoke function service (${this.options.function}) due to application error:`
      const logs_msg = ` Check logs for activation: ${base_err.activationId}`
      throw new this.serverless.classes.Error(`${err_msg}\n\n     ${err.message}\n\n    ${logs_msg}`)
    }

    throw new this.serverless.classes.Error(`${err_msg}\n\n     ${err.message}`)
  }

  isBlocking() {
    return this.options.type === 'blocking';
  }

  isLogResult() {
    return this.options.log === 'result';
  }

  log(invocationReply) {
    if (this.options.verbose || this.options.v) {
      this.logDetails(invocationReply)
    }

    let color = 'white';

    // error response indicated in-blocking call boolean parameter, success.
    if (this.isBlocking() && !invocationReply.response.success) {
      color = 'red';
    }

    let result = invocationReply;

    // blocking invocation result available as 'response.result' parameter
    if (this.isBlocking() && this.isLogResult()) {
      result = invocationReply.response.result;
    }

    this.consoleLog(chalk[color](JSON.stringify(result, null, 4)));
    return BbPromise.resolve();
  }

  logDetails(invocationReply) {
    const id = `/${invocationReply.namespace}/${invocationReply.name}`
    const actv = invocationReply.activationId

    const find_time = (annotations, key) => (annotations.find(el => el.key === key) || {value: 0}).value
    const annotations = invocationReply.annotations || []
    const waitTime = find_time(annotations, 'waitTime')
    const initTime = find_time(annotations, 'initTime')

    const field = (name, label) => `${chalk.blue(name)} (${chalk.yellow(label)})`
    const time = (name, value, color = 'blue') => `${chalk[color](name)}: ${chalk.green(value + 'ms')}`

    const duration = (duration, init = 0, wait) => `${time('duration', duration)} (${time('init', init, 'magenta')}, ${time('wait', wait, 'magenta')})`

    this.consoleLog(`${chalk.green('=>')} ${field('action', id)} ${field('activation', actv)} ${duration(invocationReply.duration, initTime, waitTime)}`)
  }

  consoleLog(msg) {
    console.log(msg); // eslint-disable-line no-console
  }
}

module.exports = OpenWhiskInvoke;
