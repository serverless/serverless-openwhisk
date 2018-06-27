'use strict';

const BbPromise = require('bluebird');
const initializeResources = require('./lib/initializeResources');
const deployPackages = require('./lib/deployPackages');
const deployFunctions = require('./lib/deployFunctions');
const deployRules = require('./lib/deployRules');
const deployTriggers = require('./lib/deployTriggers');
const deployFeeds = require('./lib/deployFeeds');
const deployApiGw = require('./lib/deployApiGw');
const deployServiceBindings = require('./lib/deployServiceBindings');

class OpenWhiskDeploy {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    Object.assign(
      this,
      initializeResources,
      deployPackages,
      deployFunctions,
      deployApiGw,
      deployRules,
      deployTriggers,
      deployFeeds,
      deployServiceBindings
    );

    this.hooks = {
      'deploy:initializeResources': () => BbPromise.bind(this).then(this.initializeResources),

      'deploy:deploy': () => BbPromise.bind(this)
        .then(this.deployPackages)
        .then(this.deployFunctions)
        .then(this.deploySequences)
        .then(this.deployRoutes)
        .then(this.deployTriggers)
        .then(this.deployFeeds)
        .then(this.deployRules)
        .then(this.configureServiceBindings)
        .then(() => this.serverless.cli.log('Deployment successful!')),
    };
  }
}

module.exports = OpenWhiskDeploy;
