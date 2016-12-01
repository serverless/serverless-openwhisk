'use strict';

const BbPromise = require('bluebird');
const Credentials = require('../../provider/credentials.js');

module.exports = {
  removeFeed (feed) {
    const onProvider = ow => ow.feeds.delete(feed);
    const errMsgTemplate =
      `Failed to remove feed (${feed.feedName}) due to error:`
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  },

  removeTriggerFeed(triggerName, params) {
    return Credentials.getWskProps().then(props => {
      const triggerNamespace = params.namespace
        || `${props.namespace}`;

      const trigger = `/${triggerNamespace}/${triggerName}`;

      // split feed identifier into namespace & name
      const feedPathParts = params.feed.split('/').filter(i => i);
      const namespace = feedPathParts.splice(0, 1).join();
      const feedName = feedPathParts.join('/');
      return this.removeFeed({ trigger, feedName, namespace });
    });
  },

  removeFeeds() {
    this.serverless.cli.log('Removing Feeds...');

    const resources = this.serverless.service.resources;

    if (!resources || !resources.triggers) {
      return BbPromise.resolve();
    }

    const triggers = resources.triggers;

    return BbPromise.all(
      Object.keys(triggers)
        .filter(t => triggers[t].feed)
        .map(t => this.removeTriggerFeed(t, triggers[t]))
    );
  },
};
