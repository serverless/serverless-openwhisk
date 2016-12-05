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
    const resources = this.serverless.service.resources;

    if (!resources || !resources.triggers) {
      return BbPromise.resolve();
    }

    const triggers = Object.keys(resources.triggers)

    if (triggers.length) {
      this.serverless.cli.log('Removing Triggers...');
    }

    return BbPromise.all(
      triggers.map(t => this.removeTrigger(t))
    );
  }
};
