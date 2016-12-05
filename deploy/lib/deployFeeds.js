'use strict';

const BbPromise = require('bluebird');

module.exports = {
  deployFeed(feed) {
    return this.provider.client().then(ow =>
      ow.feeds.create(feed).catch(err => {
        throw new this.serverless.classes.Error(
          `Failed to deploy feed (${feed.feedName}) due to error: ${err.message}`
        );
      })
    );
  },

  deployFeeds() {
    const feeds = this.getFeeds()

    if (feeds.length) {
      this.serverless.cli.log('Binding Feeds To Triggers...');
    }

    return BbPromise.all(feeds
        .map(feed => this.deployFeed(feed))
    );
  },

  getFeeds() {
    const triggers = this.serverless.service.triggers;
    return Object.keys(triggers).map(t => triggers[t].feed).filter(f => f);
  }
};
