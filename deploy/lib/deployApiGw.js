'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployRouteSwagger(route) {
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
          `Failed to deploy API Gateway route due to error: ${err.message}`
        );
      })
    });
  },


  replaceDefaultNamespace(swagger) {
    return this.provider.client()
      .then(ow => ow.actions.list())
      .then(allActions => {

        for(let path in swagger.paths) {
          for(let verb in swagger.paths[path]) {
            const operation = swagger.paths[path][verb] 
            if (operation['x-openwhisk'].namespace === '_') {
              const swaggerAction = operation['x-openwhisk']

              const action = allActions.find(item => item.name === swaggerAction.action)
              const namespace = `${action.namespace}`.replace(/\/.*/, '')
              swaggerAction.namespace = namespace
              swaggerAction.url = swaggerAction.url.replace(/web\/_/, `web/${namespace}`)

              const id = operation.operationId
              const stmts = swagger["x-ibm-configuration"].assembly.execute[0]['operation-switch'].case
              const stmt = stmts.find(stmt => stmt.operations[0] === id)
              const invoke = stmt.execute[stmt.execute.length -1].invoke
              invoke['target-url'] = invoke['target-url'].replace(/web\/_/, `web/${namespace}`)
            }
          }
        }
        return swagger
      })
  },

  deployRoutes() {
    const apigw = this.serverless.service.apigw;

    if (!apigw.swagger) {
      return BbPromise.resolve();
    }

    this.serverless.cli.log('Deploying API Gateway definitions...');
    return this.replaceDefaultNamespace(apigw.swagger)
      .then(swagger => this.deployRouteSwagger({ swagger }))
  }
};
