'use strict';

/*
NOTE: this plugin is used to add all the differnet provider related plugins at once.
This way only one plugin needs to be added to the service in order to get access to the
whole provider implementation.
*/

const CompileFunctions = require('./compile/functions/index.js');
const CompileTriggers = require('./compile/triggers/index.js');
const CompileRules = require('./compile/rules/index.js');
const Deploy = require('./deploy/index.js');
const Invoke = require('./invoke/index.js');
const Remove = require('./remove/index.js');
const Logs = require('./logs/index.js');
const Info = require('./info/index.js');
const DeployFunction = require('./deployFunction/index.js');
const OpenwhiskProvider = require('./provider/openwhiskProvider.js');

class Index {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.serverless.pluginManager.addPlugin(OpenwhiskProvider);
    this.serverless.pluginManager.addPlugin(CompileFunctions);
    this.serverless.pluginManager.addPlugin(CompileRules);
    this.serverless.pluginManager.addPlugin(CompileTriggers);
    this.serverless.pluginManager.addPlugin(Remove);
    this.serverless.pluginManager.addPlugin(Invoke);
    this.serverless.pluginManager.addPlugin(Deploy);
    this.serverless.pluginManager.addPlugin(Logs);
    this.serverless.pluginManager.addPlugin(Info);
    this.serverless.pluginManager.addPlugin(DeployFunction);
  }
}

module.exports = Index;
