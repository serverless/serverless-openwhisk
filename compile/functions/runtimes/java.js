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
    const lastColon = functionHandler.lastIndexOf(':');
    if (lastColon === -1) {
      return functionHandler;
    }
    return functionHandler.substring(0, lastColon);
  }

  // Main class has to be defined as an annotation, otherwise it will assume the main class is called 'Main'.
  calculateFunctionMain(functionObject) {
    if (functionObject.handler) {
      const splitted = functionObject.handler.split(':');
      if (splitted.length > 1 && splitted[splitted.length - 1]) {
        return splitted[splitted.length - 1];
      }
    }
    return 'Main';
  }

  // Ensure zip package used to deploy action has the correct artifacts for the runtime by only
  // including the deployable JAR file.
  processActionPackage(handlerFile, zip) {
    return zip;
  }
}

module.exports = Java;
