'use strict';

const fs = require('fs-extra')
const BaseRuntime = require('./base')
const JSZip = require("jszip")

class Swift extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'swift'
    this.extension = '.swift'
  }

  convertHandlerToPath (functionHandler) {
    if (this.isZipFile(functionHandler)) {
      return functionHandler
    }

    return super.convertHandlerToPath(functionHandler)
  }

  calculateFunctionMain(functionObject) {
    if (this.isZipFile(functionObject.handler)) {
      return 'main'
    }

    return super.calculateFunctionMain(functionObject)
  }

  isZipFile (path) {
    return path.endsWith('.zip')
  }

  readHandlerFile (path) {
    const contents = fs.readFileSync(path)
    const encoding = this.isZipFile(path) ? 'base64' : 'utf8'
    return contents.toString(encoding)
  }

  exec (functionObject) {
    const main = this.calculateFunctionMain(functionObject);
    const kind = this.calculateKind(functionObject);
    const handlerPath = this.convertHandlerToPath(functionObject.handler)

    if (!this.isValidFile(handlerPath)) {
      throw new this.serverless.classes.Error(`Function handler (${handlerPath}) does not exist.`)
    }

    const code = this.readHandlerFile(handlerPath)
    const binary = this.isZipFile(handlerPath)
    const exec = { main, kind, code, binary }

    if (functionObject.hasOwnProperty('image')) {
      exec.image = functionObject.image
    }

    return Promise.resolve(exec)
  }
}

module.exports = Swift
