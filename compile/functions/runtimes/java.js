'use strict';

const fs = require('fs-extra');
const BbPromise = require('bluebird');
const BaseRuntime = require('./base');
const JSZip = require('jszip');

class Java extends BaseRuntime {
  constructor(serverless) {
    super(serverless);
    this.kind = 'java';
    this.extension = '.jar';
  }

  convertHandlerToPath(functionHandler) {
    return functionHandler;
  }

  // Main class has to be defined as an annotation, otherwise it will assume the main class is called 'Main'.
  calculateFunctionMain(functionObject) {
    return (functionObject.annotations && functionObject.annotations.main_class) || 'Main';
  }

  // Ensure zip package used to deploy action has the correct artifacts for the runtime by only
  // including the deployable JAR file.
  processActionPackage(handlerFile, zip) {
    return zip
      .file(handlerFile)
      .async('nodebuffer')
      .then(data => {
        const readFile = BbPromise.promisify(fs.readFile);
        return readFile(handlerFile).then(zipBuffer => JSZip.loadAsync(zipBuffer));
      });
  }
}

module.exports = Java;
