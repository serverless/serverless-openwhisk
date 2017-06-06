'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompileRules {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:package:compileEvents': this.setup.bind(this),
      'package:compileEvents': this.compileRules.bind(this),
    };
  }

  setup() {
    // This object will be used to store the Rule resources, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.rules = {};

    if (this.serverless.service.provider.namespace) {
      return Promise.resolve();
    }
    // Actions and Triggers referenced by Rules must used fully qualified identifiers (including namespace).
    return this.provider.props().then(props => {
      this.serverless.service.provider.namespace = props.namespace || '_';
    });
  }

  calculateFunctionName(functionName, functionObject) {
    const namespace = this.calculateFunctionNameSpace(functionObject);
    const name = functionObject.name || `${this.serverless.service.service}_${functionName}`;
    return `/${namespace}/${name}`
  }

  calculateFunctionNameSpace(functionObject) {
    return functionObject.namespace || this.serverless.service.provider.namespace
  }

  calculateTriggerName(triggerName) {
    let namespace = this.serverless.service.provider.namespace;

    const resources = this.serverless.service.resources;
    if (resources.triggers && resources.triggers[triggerName]) {
      namespace = resources.triggers[triggerName].namespace || namespace;
    }

    return `/${namespace}/${triggerName}`;
 }

  generateDefaultRuleName(functionName, triggerName) {
      return `${this.serverless.service.service}_${triggerName}_to_${functionName}`
  }

  //
  // This method takes the rule definitions, parsed from the user's YAML file,
  // and turns it into the OpenWhisk Rule resource object.
  //
  // These resource objects are passed to the OpenWhisk SDK to create the associated Rules
  // during the deployment process.
  //
  // Parameter values will be parsed from the user's YAML definition, either as a value from
  // the rule definition or the service provider defaults.
  compileRule(funcName, funcObj, trigger) {
    const namespace = this.calculateFunctionNameSpace(funcObj);
    const action = this.calculateFunctionName(funcName, funcObj);
    const defaultRuleName = this.generateDefaultRuleName(funcName, trigger);

    if (typeof trigger === 'string') {
      return { ruleName: defaultRuleName, overwrite: true, trigger: this.calculateTriggerName(trigger), action, namespace };
    }
    
    if (!trigger.hasOwnProperty('rule')) {
      throw new this.serverless.classes.Error(
        `Missing mandatory rule property from Event Trigger definition for Function: ${funcName}`);
    }
    
    if (!trigger.hasOwnProperty('name')) {
      throw new this.serverless.classes.Error(
        `Missing mandatory name property from Event Trigger definition for Function: ${funcName}`);
    }

    const ruleName = trigger.rule || defaultRuleName;

    let overwrite = true
    if(trigger.hasOwnProperty('overwrite')) {
      overwrite = trigger.overwrite;
    }

    return { ruleName, overwrite, trigger: this.calculateTriggerName(trigger.name), action, namespace };
  }

  compileFunctionRules(functionName, functionObject) {
    if (!functionObject.events) return []

    const events = functionObject.events
      .filter(e => e.trigger)
      .map(e => this.compileRule(functionName, functionObject, e.trigger))

    if (events.length && this.options.verbose) {
      this.serverless.cli.log(`Compiled Rule (${functionName}): ${JSON.stringify(events)}`);
    }

    return events
  }

  compileRules() {
    this.serverless.cli.log('Compiling Rules...');

    const manifestResources = this.serverless.service.resources;
    const owRules = this.serverless.service.rules;

    if (!owRules) {
      throw new this.serverless.classes.Error(
        'Missing Rules section from OpenWhisk Resource Manager template');
    }

    const allFunctions = this.serverless.service.getAllFunctions()

    const functionRules = allFunctions.map(
      functionName => this.compileFunctionRules(functionName, this.serverless.service.getFunction(functionName))
    ).reduce((a, b) => a.concat(b), [])

    functionRules.forEach(rule => {
      owRules[rule.ruleName] = rule;
    })

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskCompileRules;
