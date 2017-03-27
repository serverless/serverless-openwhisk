'use strict';

const BaseRuntime = require('./base')

class Python extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'python'
    this.extension = '.py'
  }

  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      zip.remove(handlerFile)
      return zip.file('__main__.py', data)
    })
  }

  calculateDefaultRuntime (functionObject) {
    return this.calculateRuntime(functionObject)
  }
}

module.exports = Python
