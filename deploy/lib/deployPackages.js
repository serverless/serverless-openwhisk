'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployPackage(pkge) {
    return this.provider.client().then(ow => {
      if (this.options.verbose) {
        this.serverless.cli.log(`Deploying Package: ${pkge.name}`);
      }
      return ow.packages.create(pkge)
       .then(() => {
         if (this.options.verbose) {
           this.serverless.cli.log(`Deployed Package: ${pkge.name}`);
         }
       }).catch(err => {
         throw new this.serverless.classes.Error(
          `Failed to deploy package (${pkge.name}) due to error: ${err.message}`
        );
       });
    });
  },

  deployPackages() {
    const pkges = this.getPackages();

    if (pkges.length) {
      this.serverless.cli.log('Deploying Packages...');
    }

    return BbPromise.all(
      pkges.map(p => this.deployPackage(p))
    );
  },

  getPackages() {
    const pkges = this.serverless.service.packages;
    return Object.keys(this.serverless.service.packages).map(p => pkges[p]);
  }
};
