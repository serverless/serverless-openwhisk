'use strict';

const BaseRuntime = require('./base')

const fs = require('fs-extra')
const BbPromise = require('bluebird')
const JSZip = require('jszip')

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
}

module.exports = Python
