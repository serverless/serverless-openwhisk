'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployRoute(route) {
    return this.provider.client().then(ow =>
      ow.routes.create(route).then().catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy API Gateway route (${route.relpath}) due to error: ${err.message}`
        );
      })
    );
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

    if (apigw.length) {
      this.serverless.cli.log('Deploying API Gateway definitions...');
    }

    return this.unbindAllRoutes().then(() =>
      BbPromise.all(apigw.map(r => this.deployRoute(r)))
    )
  }
};
