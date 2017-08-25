'use strict';

const BaseRuntime = require('./base')

class Php extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'php'
    this.extension = '.php'
  }

  processActionPackage (handlerFile, zip) {
    return zip.file(handlerFile).async('nodebuffer').then(data => {
      zip.remove(handlerFile)
      return zip.file('index.php', data)
    })
  }
}

module.exports = Php
