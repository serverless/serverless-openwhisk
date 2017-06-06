'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployFunctionHandler(functionHandler) {
    return this.provider.client().then(ow => {
      if (this.options.verbose) {
        this.serverless.cli.log(`Deploying Function: ${functionHandler.actionName}`);
      }
      return ow.actions.create(functionHandler)
        .then(() => {
          if (this.options.verbose) {
            this.serverless.cli.log(`Deployed Function: ${functionHandler.actionName}`);
          }
        })
        .catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy function (${functionHandler.actionName}) due to error: ${err.message}`
        );
      })}
    );
  },

  deploySequences() {
    const sequences = this.filterActions(true)

    if (sequences.length) {
      this.serverless.cli.log('Deploying Sequences...');
    }

    return this.deployActions(sequences);
  },

  deployFunctions() {
    this.serverless.cli.log('Deploying Functions...');
    return this.deployActions(this.filterActions())
  },

  deployActions(names) {
    const actions = this.serverless.service.actions;
    return BbPromise.all(
      names.map(a => this.deployFunctionHandler(actions[a]))
    );
  },

  filterActions(sequence) {
    const actions = this.serverless.service.actions;
    const kind = action => action.action.exec.kind
    const match = action => (kind(action) === 'sequence') === !!sequence
    return Object.keys(actions).filter(a => match(actions[a]))
  },
};
