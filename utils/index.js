'use strict';

function formatApiHost(apihost) {
  if (apihost && !(apihost.startsWith('http://') || apihost.startsWith('https://'))) {
    // assume https unless explicitly declared
    return `https://${apihost}`;
  } else {
    return apihost;
  }
}

module.exports = { formatApiHost };
