'use strict';

const fs = require('fs-extra');
const BbPromise = require('bluebird');
const JSZip = require('jszip');

class OpenWhiskCompileFunctions {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:deploy:createDeploymentArtifacts': this.excludes.bind(this),
      'before:deploy:compileFunctions': this.setup.bind(this),
      'deploy:compileFunctions': this.compileFunctions.bind(this),
    };
  }

  // Ensure we don't bundle provider plugin with service artifact.
  excludes() {
    const exclude = this.serverless.service.package.exclude || [];
    exclude.push("node_modules/serverless-openwhisk/**");
    this.serverless.service.package.exclude = exclude;
  }

  setup() {
    // This object will be used to store the Action resources, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.actions = {};
   }

  convertHandlerToPath(functionHandler) {
    return functionHandler.replace(/\..*$/, '.js');
  }

  readFunctionSource(functionHandler) {
    const handlerFile = this.convertHandlerToPath(functionHandler);
    const readFile = BbPromise.promisify(fs.readFile);
    return readFile(handlerFile, 'utf8');
  }

  getArtifactPath(functionObject) {
    return this.serverless.service.package.individually ? 
      functionObject.artifact : this.serverless.service.package.artifact;
  }

  getArtifactZip(functionObject) {
    const artifactPath = this.getArtifactPath(functionObject)
    const readFile = BbPromise.promisify(fs.readFile);
    return readFile(artifactPath).then(zipBuffer => JSZip.loadAsync(zipBuffer))
  }

  generateActionPackage(functionObject) {
    const handlerFile = this.convertHandlerToPath(functionObject.handler);

    return this.getArtifactZip(functionObject).then(zip => {
      zip.file("package.json", JSON.stringify({main: handlerFile}))
      return zip.generateAsync({type:"nodebuffer"})
    }).then(buf => buf.toString('base64'))
  }

  calculateFunctionMain(functionObject) {
    return functionObject.handler.split('.')[1]
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

  calculateTimeout(functionObject) {
    return functionObject.timeout || this.serverless.service.provider.timeout || 60;
  }

  calculateRuntime(functionObject) {
    return functionObject.runtime || this.serverless.service.provider.runtime || 'nodejs:default';
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
        limits: { timeout: params.Timeout * 1000, memory: params.MemorySize },
        parameters: params.Parameters,
        annotations: params.Annotations
      },
    };
  }

  compileExec(functionObject) {
    if (functionObject.sequence) {
      return this.compileSequenceExec(functionObject);
    }

    return this.compileFunctionExec(functionObject);
  }

  compileSequenceExec(functionObject) {
    // sequence action names must be fully qualified.
    // use default namespace if this is missing.
    const components = functionObject.sequence.map(name => {
      if (name.startsWith('/')) {
        return name
      }
      const func = this.serverless.service.getFunction(name)
      return `/_/${func.name}`
    })

    return BbPromise.resolve({ kind: 'sequence', components })
  }

  compileFunctionExec(functionObject) {
    const main = this.calculateFunctionMain(functionObject);
    const kind = this.calculateRuntime(functionObject);
    return this.generateActionPackage(functionObject).then(code => ({ main, kind, code }));
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
    return this.compileExec(functionObject).then(Exec => {
      const FunctionName = this.calculateFunctionName(functionName, functionObject);
      const NameSpace = this.calculateFunctionNameSpace(functionName, functionObject);
      const MemorySize = this.calculateMemorySize(functionObject);
      const Timeout = this.calculateTimeout(functionObject);
      const Overwrite = this.calculateOverwrite(functionObject);

      // optional action parameters
      const Parameters = Object.keys(functionObject.parameters || {})
        .map(key => ({ key, value: functionObject.parameters[key] }));
      
      // optional action annotations 
      const Annotations = Object.keys(functionObject.annotations || {})
        .map(key => ({ key, value: functionObject.annotations[key] }));

      return this.compileFunctionAction(
        { FunctionName, NameSpace, Overwrite, Exec, Timeout, MemorySize, Parameters, Annotations }
      );
    });
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

      return this.compileFunction(functionName, functionObject)
        .then(newFunction => (functions[functionName] = newFunction))
        .catch(err);
    });

    return BbPromise.all(functionPromises);
  }
}

module.exports = OpenWhiskCompileFunctions;
