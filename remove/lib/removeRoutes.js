'use strict';

const BbPromise = require('bluebird');

module.exports = {
  hasRoutes() {
    return this.serverless.service.getAllFunctions()
      .map(f => this.serverless.service.getFunction(f))
      .some(fnObj => {
        const events = fnObj.events || []
        return events.some(event => event.http)
      })
  },

  removeRoutes() {
    if (!this.hasRoutes()) {
      return Promise.resolve();
    }

    this.serverless.cli.log('Removing API Gateway definitions...');

    const basepath = `/${this.serverless.service.service}`;
    const onProvider = ow => ow.routes.delete({ basepath });
    const errMsgTemplate = `Failed to unbind API Gateway routes (${basepath}) due to error:`;

    return this.handleOperationFailure(onProvider, errMsgTemplate);
  }
};
