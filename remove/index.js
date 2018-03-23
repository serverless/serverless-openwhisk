'use strict';

const BbPromise = require('bluebird');
const validate = require('./lib/validate');
const removePackages = require('./lib/removePackages');
const removeFunctions = require('./lib/removeFunctions');
const removeTriggers = require('./lib/removeTriggers');
const removeRules = require('./lib/removeRules');
const removeFeeds = require('./lib/removeFeeds');
const removeRoutes = require('./lib/removeRoutes');
const setupResources = require('./lib/setupResources');
const util = require('./lib/util');

class OpenWhiskRemove {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

    Object.assign(this, validate, setupResources, removePackages, removeFunctions,
      removeTriggers, removeRules, removeFeeds, removeRoutes, util);

    this.hooks = {
      'remove:remove': () => BbPromise.bind(this)
          .then(this.validate)
          .then(this.setupResources)
          .then(this.removeRoutes)
          .then(this.removeRules)
          .then(this.removeFunctions)
          .then(this.removePackages)
          .then(this.removeTriggers)
          .then(this.removeFeeds)
          .then(() => this.serverless.cli.log('Resource removal successful!')),
    };
  }
}

module.exports = OpenWhiskRemove;
