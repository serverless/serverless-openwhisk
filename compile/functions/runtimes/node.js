'use strict';

const BaseRuntime = require('./base')

const fs = require('fs-extra')

class Node extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'nodejs'
    this.extension = '.js'
  }

  calculateRuntime(functionObject) {
    return super.calculateRuntime(functionObject) || 'nodejs:default'
  }

  processActionPackage (handlerFile, zip) {
    zip.file("package.json", JSON.stringify({main: handlerFile}))
    return zip
  }
}

module.exports = Node
