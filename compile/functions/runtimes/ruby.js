'use strict';

const BaseRuntime = require('./base')

class Ruby extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'ruby'
    this.extension = '.rb'
  }

  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      zip.remove(handlerFile)
      return zip.file('main.rb', data)
    })
  }
}

module.exports = Ruby 
