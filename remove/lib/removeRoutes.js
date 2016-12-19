'use strict';

const BbPromise = require('bluebird');

module.exports = {
  removeRoutes() {
    this.serverless.cli.log('Removing API Gateway definitions...');

    const basepath = `/${this.serverless.service.service}`;
    const onProvider = ow => ow.routes.delete({ basepath });
    const errMsgTemplate = `Failed to unbind API Gateway routes (${basepath}) due to error:`;

    return this.handleOperationFailure(onProvider, errMsgTemplate);
  }
};
