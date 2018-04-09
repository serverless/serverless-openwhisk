'use strict';

const BaseRuntime = require('./base')

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

  //We're handling a special case here which is that if TypeScript is being used
  //we won't actually have a ".js" file (this.extension), instead we'll have a "ts"
  //which should still be considered safe enough, or at least shouldn't
  //completely stop the deployment process
  isValidFile(handlerFile) {
    return super.isValidFile(handlerFile) || this.isValidTypeScriptFile(handlerFile);
  }

  //Check for TypeScript version of handler file
  isValidTypeScriptFile(handlerFile) {
    //replaces the last occurance of `.js` with `.ts`, case insensitive
    const typescriptHandlerFile = handlerFile.replace(/\.js$/gi, ".ts");
    return super.isValidFile(typescriptHandlerFile);
  }
}

module.exports = Node
