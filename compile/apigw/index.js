'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompileHttpEvents {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:package:compileEvents': this.setup.bind(this),
      'before:package:compileFunctions': this.addWebAnnotations.bind(this),
      'package:compileEvents': this.compileHttpEvents.bind(this),
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

  // HTTP events need Web Actions enabled for those functions. Add
  // annotation 'web-export' if it is not already present.
  addWebAnnotations() {
    const names = Object.keys(this.serverless.service.functions)
    names.forEach(fnName => {
      const f = this.serverless.service.functions[fnName]
      const httpEvents = (f.events || []).filter(e => e.http)
      if (httpEvents.length) {
        if (!f.annotations) f.annotations = {}
        f.annotations['web-export'] = true
      }
    })

    return BbPromise.resolve();
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
    const options = this.parseHttpEvent(http);
    options.action = this.calculateFunctionName(funcName, funcObj);
    options.basepath = `/${this.serverless.service.service}`;
    return options;
  }

  parseHttpEvent(httpEvent) {
    if (httpEvent.path && httpEvent.method) {
      return { relpath: httpEvent.path, operation: httpEvent.method };
    } else if (typeof httpEvent === 'string') {
      const method_and_path = httpEvent.trim().split(' ');
      if (method_and_path.length !== 2) {
        throw new this.serverless.classes.Error(
          `Incorrect HTTP event parameter value (${httpEvent}), must be string in form: HTTP_METHOD API_PATH e.g. GET /api/foo`);
      }
      return { operation: method_and_path[0], relpath: method_and_path[1] }
    } 

    throw new this.serverless.classes.Error(
      `Incorrect HTTP event parameter value (${httpEvent}), must be string ("GET /api/foo") or object ({method: "GET", path: "/api/foo"})`);
  }

  compileFunctionHttpEvents(functionName, functionObject) {
    if (!functionObject.events) return []

    const events = functionObject.events
      .filter(e => e.http)
      .map(e => this.compileHttpEvent(functionName, functionObject, e.http))

    if (events.length && this.options.verbose) {
      this.serverless.cli.log(`Compiled API Gateway definition (${functionName}): ${JSON.stringify(events)}`);
    }

    return events
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
