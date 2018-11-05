'use strict';

const BbPromise = require('bluebird');
const fs = require('fs-extra');
const path = require('path')
const CompileFunctions = require('../compile/functions/')

class OpenWhiskDeployFunction {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

    // Temporary hack until we have a better way to access existing plugins.
    const is_package_plugin = plugin => plugin.hasOwnProperty('packageFunction')
    this.pkg = serverless.pluginManager.getPlugins().find(is_package_plugin)

    this.compileFunctions = new CompileFunctions(serverless, options)

    this.hooks = {
      'deploy:function:initialize': () => BbPromise.bind(this)
        .then(this.validate),
      'deploy:function:packageFunction': () => BbPromise.bind(this)
        .then(this.packageFunction)
        .then(this.compileFunction),
      'deploy:function:deploy': () => BbPromise.bind(this)
        .then(this.deployFunction)
        .then(this.cleanup)
    };
  }

  validate () {
    if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service');
    }

    this.options.stage = this.options.stage
      || (this.serverless.service.provider && this.serverless.service.provider.stage)
      || 'dev';
    this.options.region = this.options.region
      || (this.serverless.service.provider && this.serverless.service.provider.region)
      || 'us-east-1';

    return BbPromise.resolve();
  }

  compileFunction () {
    const functionObject = this.serverless.service.getFunction(this.options.function);
    return this.compileFunctions.compileFunction(this.options.function, functionObject).then(action => this.action = action)
  }

  packageFunction () {
    this.serverless.cli.log(`Packaging function: ${this.options.function}...`);
    const functionObject = this.serverless.service.getFunction(this.options.function);
    // sequences do not need packaging, no files to deploy
    if (functionObject.sequence) {
      return BbPromise.resolve();
    }

    this.serverless.service.package.individually = true
    return this.pkg.packageFunction(this.options.function);
  }

  deployFunction (data) {
    this.serverless.cli.log(`Deploying function: ${this.options.function}...`);
    return this.provider.client().then(ow =>
      ow.actions.create(this.action).then(() => {
        this.serverless.cli.log(`Successfully deployed function: ${this.options.function}`);
      }).catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy function (${this.options.function}) due to error: ${err.message}`
        );
      })
    );
  }

  cleanup () {
    if (this.serverless.config.servicePath) {
      const serverlessTmpDirPath = path.join(this.serverless.config.servicePath, '.serverless');

      if (this.serverless.utils.dirExistsSync(serverlessTmpDirPath)) {
        fs.removeSync(serverlessTmpDirPath);
      }
    }

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskDeployFunction;
