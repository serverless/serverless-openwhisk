'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompileHttpEvents {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:deploy:compileEvents': this.setup.bind(this),
      'deploy:compileEvents': this.compileHttpEvents.bind(this),
    };
  }

  setup() {
    // This object will be used to store the endpoint definitions, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.apigw = [];

    // Actions and Triggers referenced by Rules must used fully qualified identifiers (including namespace).
    if (!this.serverless.service.provider.namespace) {
      return this.provider.props().then(props => {
        this.serverless.service.provider.namespace = props.namespace;
      });
    }
  }

  calculateFunctionName(functionName, functionObject) {
    const namespace = this.calculateFunctionNameSpace(functionObject);
    const name = functionObject.name || `${this.serverless.service.service}_${functionName}`;
    return `/${namespace}/${name}`
  }

  calculateFunctionNameSpace(functionObject) {
    return functionObject.namespace
      || this.serverless.service.provider.namespace
      || '_';
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
  compileHttpEvent(funcName, funcObj, http) {
    const method_and_path = http.trim().split(' ');
    if (method_and_path.length !== 2) {
      throw new this.serverless.classes.Error(
        `Incorrect HTTP event parameter value (${http}), must be string in form: HTTP_METHOD API_PATH e.g. GET /api/foo`);
    }

    const action = this.calculateFunctionName(funcName, funcObj);

    return { basepath: `/${this.serverless.service.service}`, relpath: method_and_path[1], operation: method_and_path[0], action };
  }

  compileFunctionHttpEvents(functionName, functionObject) {
    if (!functionObject.events) return []

    return functionObject.events
      .filter(e => e.http)
      .map(e => this.compileHttpEvent(functionName, functionObject, e.http))
  }

  compileHttpEvents () {
    this.serverless.cli.log('Compiling API Gateway definitions...');

    const allFunctions = this.serverless.service.getAllFunctions()

    const httpEvents = allFunctions.map(
      functionName => this.compileFunctionHttpEvents(functionName, this.serverless.service.getFunction(functionName))
    ).reduce((a, b) => a.concat(b), [])

    this.serverless.service.apigw = httpEvents;

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskCompileHttpEvents;
