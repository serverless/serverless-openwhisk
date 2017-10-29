'use strict';

class Docker {
  constructor(serverless) {
    this.serverless = serverless
  }

  match (functionObject) {
    if (!functionObject.hasOwnProperty('handler')) return false
    return this.calculateRuntime(functionObject) === 'docker'
  }

  exec (functionObject) {
    return { kind: 'blackbox', image: functionObject.handler }
  }

  calculateRuntime(functionObject) {
    return functionObject.runtime || this.serverless.service.provider.runtime
  }
}


module.exports = Docker
