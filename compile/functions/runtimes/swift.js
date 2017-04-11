'use strict';

const BaseRuntime = require('./base')

class Swift extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'swift'
    this.extension = '.swift'
  }

  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      zip.remove(handlerFile)
      return zip.file('main.swift', data)
    })
  }
}

module.exports = Swift
