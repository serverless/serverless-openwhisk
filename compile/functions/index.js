'use strict';

const BbPromise = require('bluebird');
const Runtimes = require('./runtimes/index.js')

class OpenWhiskCompileFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');
    this.runtimes = new Runtimes(serverless)

    this.hooks = {
      'before:package:createDeploymentArtifacts':  () => BbPromise.bind(this)
        .then(this.excludes)
        .then(this.disableSeqPackaging),
      'before:package:compileFunctions': this.setup.bind(this),
      'package:compileFunctions': this.compileFunctions.bind(this),
    };
  }

  // Ensure we don't bundle provider plugin with service artifact.
  excludes() {
    const exclude = this.serverless.service.package.exclude || [];
    exclude.push("node_modules/serverless-openwhisk/**");
    this.serverless.service.package.exclude = exclude;
  }

  disableSeqPackaging() {
    this.serverless.service.getAllFunctions().forEach(functionName => {
      const functionObject = this.serverless.service.getFunction(functionName);

      if (functionObject.sequence) {
        Object.assign(functionObject, { package: { disable: true } })
      }
    })
  }

  setup() {
    // This object will be used to store the Action resources, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.actions = {};
   }

  calculateFunctionName(functionName, functionObject) {
    return functionObject.name || `${this.serverless.service.service}_${functionName}`;
  }

  calculateFunctionNameSpace(functionName, functionObject) {
    return functionObject.namespace || this.serverless.service.provider.namespace;
  }

  calculateMemorySize(functionObject) {
    return functionObject.memory || this.serverless.service.provider.memory || 256;
  }

  calculateConcurrency(functionObject) {
    return functionObject.concurrency || this.serverless.service.provider.concurrency || 1;
  }

  calculateTimeout(functionObject) {
    return functionObject.timeout || this.serverless.service.provider.timeout || 60;
  }

  calculateOverwrite(functionObject) {
    let Overwrite = true;

    if (functionObject.hasOwnProperty('overwrite')) {
      Overwrite = functionObject.overwrite;
    } else if (this.serverless.service.provider.hasOwnProperty('overwrite')) {
      Overwrite = this.serverless.service.provider.overwrite;
    }

    return Overwrite;
  }

  compileFunctionAction(params) {
    return {
      actionName: params.FunctionName,
      namespace: params.NameSpace,
      overwrite: params.Overwrite,
      action: {
        exec: params.Exec,
        limits: {
          timeout: params.Timeout * 1000,
          memory: params.MemorySize,
          concurrency: params.Concurrency,
        },
        parameters: params.Parameters,
        annotations: params.Annotations
      },
    };
  }

  // This method takes the function handler definition, parsed from the user's YAML file,
  // and turns it into the OpenWhisk Action resource object.
  //
  // These resource objects are passed to the OpenWhisk SDK to create the associated Actions
  // during the deployment process.
  //
  // Parameter values will be parsed from the user's YAML definition, either as a value from
  // the function handler definition or the service provider defaults.
  compileFunction(functionName, functionObject) {
    return this.runtimes.exec(functionObject).then(Exec => {
      const FunctionName = this.calculateFunctionName(functionName, functionObject);
      const NameSpace = this.calculateFunctionNameSpace(functionName, functionObject);
      const MemorySize = this.calculateMemorySize(functionObject);
      const Timeout = this.calculateTimeout(functionObject);
      const Overwrite = this.calculateOverwrite(functionObject);
      const Concurrency = this.calculateConcurrency(functionObject);

      // optional action parameters
      const Parameters = Object.keys(functionObject.parameters || {})
        .map(key => ({ key, value: functionObject.parameters[key] }));
      
      // optional action annotations 
      const Annotations = this.constructAnnotations(functionObject.annotations);

      return this.compileFunctionAction(
        { FunctionName, NameSpace, Overwrite, Exec, Timeout, MemorySize, Concurrency, Parameters, Annotations }
      );
    });
  }

  constructAnnotations (annotations) {
    if (!annotations) return []

    // finalise action parameters when exposing as external HTTP endpoint.
    // mirrors behaviour from OpenWhisk CLI.
    if (annotations['web-export']) {
      annotations['final'] = true
    }

    const converted = Object.keys(annotations)
      .map(key => ({ key, value: annotations[key] }));

    return converted
  }

  logCompiledFunction (name, fn) {
    const clone = JSON.parse(JSON.stringify(fn))
    if (clone.action.exec.code) {
      clone.action.exec.code = '<hidden>'
    }
    this.serverless.cli.log(`Compiled Function (${name}): ${JSON.stringify(clone)}`);
  }

  compileFunctions() {
    this.serverless.cli.log('Compiling Functions...');

    if (!this.serverless.service.actions) {
      throw new this.serverless.classes.Error(
        'Missing Resources section from OpenWhisk Resource Manager template');
    }

    const functionPromises = this.serverless.service.getAllFunctions().map((functionName) => {
      const functionObject = this.serverless.service.getFunction(functionName);

      if (!functionObject.handler && !functionObject.sequence) {
        throw new this.serverless.classes
          .Error(`Missing "handler" or "sequence" property in function ${functionName}`);
      }

      if (functionObject.handler && functionObject.sequence) {
        throw new this.serverless.classes
          .Error(`Found both "handler" and "sequence" properties in function ${functionName}, please choose one.`);
      }

      const functions = this.serverless.service.actions;
      const err = () => {
        throw new this.serverless.classes
          .Error(`Unable to read handler file in function ${functionName}`);
      };

      let compileFn = this.compileFunction(functionName, functionObject)
        .then(newFunction => (functions[functionName] = newFunction))

      if (this.options.verbose) {
        compileFn = compileFn.then(fn => this.logCompiledFunction(functionName, fn))
      }

      return compileFn.catch(err);
    });

    return BbPromise.all(functionPromises);
  }
}

module.exports = OpenWhiskCompileFunctions;
