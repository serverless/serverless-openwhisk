'use strict';

module.exports.withObj = () => {
  return { message: 'hello' }
};

module.exports.withError = () => {
  throw new Error('failed')
};

module.exports.withPromise = () => {
  return Promise.resolve({ message: 'hello' })
};

module.exports.withRejectedPromise = () => {
  return Promise.reject(new Error('failed'))
};
