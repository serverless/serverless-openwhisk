'use strict';

const BbPromise = require('bluebird');

module.exports = {
  removePackageHandler(pkge) {
    const onProvider = ow => ow.packages.delete(pkge);
    const errMsgTemplate =
      `Failed to delete package (${pkge.name}) due to error:`;
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  },

  removePackage(name) {
    const packageObject = this.serverless.service.resources.packages[name];
    const pkge = { name };

    if (packageObject.namespace) {
      pkge.namespace = packageObject.namespace;
    }

    return this.removePackageHandler(pkge);
  },

  removePackages() {
    const resources = this.serverless.service.resources;

    if (!resources || !resources.packages) {
      return BbPromise.resolve();
    }

    const packages = Object.keys(resources.packages)

    if (packages.length) {
      this.serverless.cli.log('Removing Packages...');
    }

    return BbPromise.all(
      packages.map(p => this.removePackage(p))
    );
  }
};
