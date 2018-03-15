'use strict';

const path = require('path');
const fs = require('fs-extra');

const ENV_PARAMS = ['OW_APIHOST', 'OW_AUTH', 'OW_NAMESPACE', 'OW_APIGW_ACCESS_TOKEN'];

function getWskPropsFile() {
  const Home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
  return process.env.WSK_CONFIG_FILE || path.format({ dir: Home, base: '.wskprops' });
}

function readWskPropsFile() {
  const wskFilePath = getWskPropsFile();

  return new Promise(resolve => {
    fs.readFile(wskFilePath, 'utf8', (err, data) => {
      resolve(err ? '' : data);
    });
  });
}

function getWskProps() {
  return readWskPropsFile().then(data => {
    if (!data) return {};

    const wskProps = data.trim().split('\n')
    .map(line => line.split('='))
    .reduce((params, keyValue) => {
      params[keyValue[0].toLowerCase()] = keyValue[1]; // eslint-disable-line no-param-reassign
      return params;
    }, {});

    return wskProps;
  });
}

function getWskEnvProps() {
  const envProps = {};
  ENV_PARAMS.forEach((envName) => {
    if (process.env[envName]) envProps[envName.slice(3).toLowerCase()] = process.env[envName];
  });
  return envProps;
}

module.exports = {
  getWskProps() {
    return getWskProps()
      .then(props => Object.assign(props, getWskEnvProps()));
  },
  ENV_PARAMS,
};
