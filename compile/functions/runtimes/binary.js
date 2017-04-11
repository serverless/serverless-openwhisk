'use strict';

const BaseRuntime = require('./base')

class Binary extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'binary'
  }

  exec (functionObject) {
    const image = 'openwhisk/dockerskeleton'
    const kind = 'blackbox'
    return this.generateActionPackage(functionObject).then(code => ({ image, kind, code }))
  }

  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      zip.remove(handlerFile)
      return zip.file('exec', data)
    })
  }

  calculateKind (functionObject) {
    return `blackbox`
  }

  convertHandlerToPath (functionHandler) {
    return functionHandler
  }
}

module.exports = Binary
