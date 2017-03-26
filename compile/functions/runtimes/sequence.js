'use strict';

class Sequence {
  constructor(serverless) {
    this.serverless = serverless
  }

  match (functionObject) {
    return functionObject.hasOwnProperty('sequence')
  }

  exec (functionObject) {
    // sequence action names must be fully qualified.
    // use default namespace if this is missing.
    const components = functionObject.sequence.map(name => {
      if (name.startsWith('/')) {
        return name
      }
      const func = this.serverless.service.getFunction(name)
      return `/_/${func.name}`
    })

    return { kind: 'sequence', components }
  }
}


module.exports = Sequence
