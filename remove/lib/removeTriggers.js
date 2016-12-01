'use strict';

const BbPromise = require('bluebird');

module.exports = {
  removeTriggerHandler(Trigger) {
    const onProvider = ow => ow.triggers.delete(Trigger);
    const errMsgTemplate = 
      `Failed to delete event trigger (${Trigger.triggerName}) due to error:`;
    return this.handleOperationFailure(onProvider, errMsgTemplate);
  },

  removeTrigger(triggerName) {
    const triggerObject = this.serverless.service.resources.triggers[triggerName];
    const Trigger = { triggerName };

    if (triggerObject.namespace) {
      Trigger.namespace = triggerObject.namespace;
    }

    return this.removeTriggerHandler(Trigger);
  },

  removeTriggers() {
    this.serverless.cli.log('Removing Triggers...');
    const resources = this.serverless.service.resources;

    if (!resources || !resources.triggers) {
      return BbPromise.resolve();
    }

    return BbPromise.all(
      Object.keys(resources.triggers).map(t => this.removeTrigger(t))
    );
  }
};
