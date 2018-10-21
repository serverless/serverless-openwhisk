'use strict';

const Binary = require('./binary')
const Docker = require('./docker')
const Node = require('./node')
const Python = require('./python')
const Swift = require('./swift')
const Php = require('./php')
const Sequence = require('./sequence')
const Java = require('./java')
const Ruby = require('./ruby')

class Runtimes {
  constructor(serverless) {
    this.serverless = serverless;
    this.runtimes = [
      new Binary(serverless),
      new Docker(serverless),
      new Node(serverless),
      new Python(serverless),
      new Swift(serverless),
      new Php(serverless),
      new Sequence(serverless),
      new Java(serverless),
      new Ruby(serverless)
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
