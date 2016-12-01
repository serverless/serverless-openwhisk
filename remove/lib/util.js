'use strict';

module.exports = {
   handleOperationFailure (onProvider, errMsgTemplate) {
    return new Promise((resolve, reject) => {
      this.provider.client().then(onProvider).then(resolve).catch(err => {
        this.serverless.cli.log(`${errMsgTemplate}: ${err.message}`);
        resolve();
      });
    })
  }
};
