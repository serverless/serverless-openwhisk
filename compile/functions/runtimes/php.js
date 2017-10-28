'use strict';

const BaseRuntime = require('./base')
const PHP_ACTION_FILE = 'index.php'

class Php extends BaseRuntime {
  constructor (serverless) {
    super(serverless)
    this.kind = 'php'
    this.extension = '.php'
  }

  processActionPackage (handlerFile, zip) {
    var fileName = handlerFile, pathSeparatorIndex = handlerFile.lastIndexOf('/');
    if (pathSeparatorIndex != -1) {
      zip = zip.folder(handlerFile.substr(0, pathSeparatorIndex));
      fileName = handlerFile.substr(pathSeparatorIndex + 1);
    }

    if (fileName == PHP_ACTION_FILE) {
      return zip;
    }

    return zip.file(fileName).async('nodebuffer').then(data => {
      zip.remove(fileName)
      return zip.file(PHP_ACTION_FILE, data)
    })
  }
}

module.exports = Php
