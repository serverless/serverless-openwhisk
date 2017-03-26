'use strict';

const Node = require('./node')
const Python = require('./python')
const Swift = require('./swift')
const Sequence = require('./sequence')

class Runtimes {
  constructor(serverless) {
    this.serverless = serverless;
    this.runtimes = [
      new Node(serverless),
      new Python(serverless),
      new Swift(serverless),
      new Sequence(serverless)
    ];
  }
 
  exec (functionObj) {
    const matched = this.runtimes.find(runtime => runtime.match(functionObj))
    if (matched) return Promise.resolve(matched.exec(functionObj))

    throw new this.serverless.classes.Error(
      'This runtime is not currently supported by the OpenWhisk provider plugin.');
  }
}

module.exports = Runtimes
