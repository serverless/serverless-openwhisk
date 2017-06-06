'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployRoute(route) {
    return this.provider.client().then(ow => {
      if (this.options.verbose) {
        this.serverless.cli.log(`Deploying API Gateway Route: ${JSON.stringify(route)}`);
      }
      return ow.routes.create(route)
        .then(() => {
          if (this.options.verbose) {
            this.serverless.cli.log(`Deployed API Gateway Route: ${JSON.stringify(route)}`);
          }
        }).catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy API Gateway route (${route.relpath}) due to error: ${err.message}`
        );
      })
    });
  },

  unbindAllRoutes() {
    return new Promise((resolve) => {
      this.provider.client()
        .then(ow => ow.routes.delete({basepath:`/${this.serverless.service.service}`}))
        .then(resolve)
        .catch(resolve)
    })
  },

  deployRoutes() {
    const apigw = this.serverless.service.apigw;

    if (!apigw.length) {
      return BbPromise.resolve();
    }

    this.serverless.cli.log('Deploying API Gateway definitions...');
    return this.unbindAllRoutes().then(() => {
      const requests = apigw.map(r => this.deployRoute(r))
      return BbPromise.all(requests)
    })
  }
};
