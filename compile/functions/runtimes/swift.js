'use strict';

const BaseRuntime = require('./base')
const JSZip = require("jszip")

class Swift extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'swift'
    this.extension = '.swift'
  }

  convertHandlerToPath (functionHandler) {
    if (this.isBuildPath(functionHandler)) {
      return functionHandler
    }

    return super.convertHandlerToPath(functionHandler)
  }

  isBuildPath (path) {
    return path.startsWith('.build/')
  }

  // Ensure zip package used to deploy action has the correct artifacts for the runtime.
  // Swift source actions must have the function code in `main.swift`.
  // Swift binary actions must have the binary as `./build/release/Action`.
  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      if (this.isBuildPath(handlerFile)) {
        zip = new JSZip()
        return zip.file('.build/release/Action', data)
      }
      zip.remove(handlerFile)
      return zip.file('main.swift', data)
    })
  }
}

module.exports = Swift
