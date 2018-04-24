'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployTrigger(trigger) {
    return this.provider.client().then(ow => {
      if (this.options.verbose) {
        this.serverless.cli.log(`Deploying Trigger: ${trigger.triggerName}`);
      }

      const feed = this.getFeed(trigger)
      if (feed) {
        Object.assign(trigger, { annotations: [{ key: 'feed', value: feed }] });
      }

      return ow.triggers.create(trigger)
       .then(() => {
          if (this.options.verbose) {
            this.serverless.cli.log(`Deployed Trigger: ${trigger.triggerName}`);
          }
        }).catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy trigger (${trigger.triggerName}) due to error: ${err.message}`
        );
      })
    });
  },

  deployTriggers() {
    const triggers = this.getTriggers();

    if(triggers.length) {
      this.serverless.cli.log('Deploying Triggers...');
    }

    return BbPromise.all(
      triggers.map(t => this.deployTrigger(t))
    );
  },

  getTriggers() {
    const triggers = this.serverless.service.triggers;
    const trigger = { feed: undefined };
    return Object.keys(triggers)
      .map(t => Object.assign({}, triggers[t], trigger));
  },

  getFeed(trigger) {
    return trigger.feed;
  },
};
