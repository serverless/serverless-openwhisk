'use strict';

const BbPromise = require('bluebird');

module.exports = {
  removeFunctionHandler(functionHandler) {
    const onProvider = ow => ow.actions.delete(functionHandler);
    const errMsgTemplate =
      `Failed to delete function service (${functionHandler.actionName}) due to error:`;
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  },

  removeFunction(functionName) {
    const functionObject = this.serverless.service.getFunction(functionName);
    const FunctionHandler = {};

    FunctionHandler.actionName = functionObject.name
      || `${this.serverless.service.service}_${functionName}`;

    if (functionObject.namespace) {
      FunctionHandler.namespace = functionObject.namespace;
    }

    return this.removeFunctionHandler(FunctionHandler);
  },

  removeFunctions() {
    this.serverless.cli.log('Removing Functions...');

    return BbPromise.all(
      this.serverless.service.getAllFunctions().map(f => this.removeFunction(f))
    );
  },
};
