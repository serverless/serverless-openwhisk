'use strict';

/*
NOTE: this plugin is used to add all the differnet provider related plugins at once.
This way only one plugin needs to be added to the service in order to get access to the
whole provider implementation.
*/

const CompileFunctions = require('./compile/functions/index.js');
const CompileTriggers = require('./compile/triggers/index.js');
const CompileRules = require('./compile/rules/index.js');
const CompilePackages = require('./compile/packages/index.js');
const CompileHttpEvents = require('./compile/apigw/index.js');
const CompileSchedule = require('./compile/schedule/index.js');
const CompileMessageHub = require('./compile/message_hub/index.js');
const CompileCloudant = require('./compile/cloudant/index.js');
const CompileServiceBindings = require('./compile/servicebindings/index.js');
const Deploy = require('./deploy/index.js');
const Invoke = require('./invoke/index.js');
const InvokeLocal = require('./invokeLocal/index.js');
const Remove = require('./remove/index.js');
const Logs = require('./logs/index.js');
const Info = require('./info/index.js');
const DeployFunction = require('./deployFunction/index.js');
const OpenwhiskProvider = require('./provider/openwhiskProvider.js');
const ConfigCredentials = require('./configCredentials/index.js')

class Index {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    this.serverless.pluginManager.addPlugin(OpenwhiskProvider);
    this.serverless.pluginManager.addPlugin(CompilePackages);
    this.serverless.pluginManager.addPlugin(CompileFunctions);
    this.serverless.pluginManager.addPlugin(CompileHttpEvents);
    this.serverless.pluginManager.addPlugin(CompileRules);
    this.serverless.pluginManager.addPlugin(CompileTriggers);
    this.serverless.pluginManager.addPlugin(CompileSchedule);
    this.serverless.pluginManager.addPlugin(CompileMessageHub);
    this.serverless.pluginManager.addPlugin(CompileCloudant);
    this.serverless.pluginManager.addPlugin(CompileServiceBindings);
    this.serverless.pluginManager.addPlugin(Remove);
    this.serverless.pluginManager.addPlugin(Invoke);
    this.serverless.pluginManager.addPlugin(InvokeLocal);
    this.serverless.pluginManager.addPlugin(Deploy);
    this.serverless.pluginManager.addPlugin(Logs);
    this.serverless.pluginManager.addPlugin(Info);
    this.serverless.pluginManager.addPlugin(DeployFunction);
    this.serverless.pluginManager.addPlugin(ConfigCredentials);
  }
}

module.exports = Index;
