'use strict';

const fs = require('fs-extra')
const JSZip = require('jszip')
const BbPromise = require('bluebird')

class BaseRuntime {
  constructor(serverless) {
    this.serverless = serverless
  }

  match (functionObject) {
    if (!functionObject.hasOwnProperty('handler')) return false
    const runtime = this.calculateRuntime(functionObject)
    return !!(runtime && runtime.startsWith(this.kind))
  }

  exec (functionObject) {
    const main = this.calculateFunctionMain(functionObject);
    const kind = this.calculateKind(functionObject);
    const exec = { main, kind }

    if (functionObject.hasOwnProperty('image')) {
      exec.image = functionObject.image
    }

    return this.generateActionPackage(functionObject).then(code => Object.assign(exec, { code }))
  }

  calculateFunctionMain(functionObject) {
    const splitted = functionObject.handler.split('.');
    if (splitted.length < 2) {
      return functionObject;
    }
    return splitted[splitted.length - 1];
  }

  calculateRuntime(functionObject) {
    return functionObject.runtime || this.serverless.service.provider.runtime
  }

  calculateDefaultRuntime(functionObject) {
    const runtime = this.calculateRuntime(functionObject)
    return runtime.includes(':') ? runtime : `${runtime}:default`
  }

  calculateKind(functionObject) {
    if (functionObject.hasOwnProperty('image')) return 'blackbox'

    return this.calculateDefaultRuntime(functionObject)
  }

  isValidFile (handlerFile) {
    return fs.existsSync(handlerFile)
  }

  convertHandlerToPath(functionHandler) {
    const lastDot = functionHandler.lastIndexOf('.');
    if (lastDot === -1) {
      return functionHandler;
    }
    return functionHandler.substring(0, lastDot) + this.extension;
  }

  convertHandlerToPathInZip(functionHandler) {
    let path = this.convertHandlerToPath(functionHandler);
    while (path.startsWith('../')) {
      path = path.substring(3);
    }
    return path;
  }

  generateActionPackage(functionObject) {
    // Check that handler file exists
    const handlerFile = this.convertHandlerToPath(functionObject.handler);
    if (!this.isValidFile(handlerFile)) {
      throw new this.serverless.classes.Error(`Function handler (${handlerFile}) does not exist.`)
    }

    // Generate action package
    const handlerFileZipPath = this.convertHandlerToPathInZip(functionObject.handler);

    return this.getArtifactZip(functionObject)
      .then(zip => this.processActionPackage(handlerFileZipPath, zip))
      .then(zip => zip.generateAsync(
        { type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }
      ))
      .then(buf => buf.toString('base64'));
  }

  getArtifactZip(functionObject) {
    const artifactPath = this.getArtifactPath(functionObject)
    const readFile = BbPromise.promisify(fs.readFile);
    return readFile(artifactPath).then(zipBuffer => JSZip.loadAsync(zipBuffer))
  }

  getArtifactPath(functionObject) {
    return this.serverless.service.package.individually ? 
      functionObject.package.artifact : this.serverless.service.package.artifact;
  }
}

module.exports = BaseRuntime
