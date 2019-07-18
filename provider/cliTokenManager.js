'use strict';

"use strict";

const jws = require('jws');
const { exec } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');

// Configuration file location for IBM Cloud CLI.
// This will contain the current IAM tokens for the user.
const DEFAULT_CONFIG_LOCATION = `.bluemix/config.json`

// This class handles retrieving authentication tokens for IAM namespaces on IBM Cloud Functions.
// Tokens are parsed from the configuration file used by the IBM Cloud CLI.
// If tokens have expired, the CLI command `ibmcloud iam oauth-tokens` is executed.
// This will automatically refresh the tokens in the configuration.
module.exports = class CliTokenManager {
  constructor(_exec = exec, _readFile = readFileSync) {
    this.exec = _exec
    this.readFile = _readFile
    this.refresh_command = 'ibmcloud iam oauth-tokens'
  }

  getAuthHeader () {
    const to_header = token => `Bearer ${token}`
    const token = this.readTokenFromConfig()
    if (this.isTokenExpired(token)) {
      return this.refreshToken().then(to_header)
    }

    return Promise.resolve(to_header(token))
  }

  refreshToken () {
    return new Promise((resolve, reject) => {
      this.exec(this.refresh_command, error => {
        if (error) {
          const err_message = `IAM token from IBM Cloud CLI configuration file (.bluemix/config.json) has expired. `
            + `Refresh failed using CLI command (ibmcloud iam oauth-tokens). Check error message for details: ${error}`
          return reject(new Error(err_message))
        }
        resolve(this.readTokenFromConfig())
      });
    })
  }

  // IAM Tokens stored under the IAMToken field in configuration.
  readTokenFromConfig (configPath = CliTokenManager.configFilePath()) {
    const contents = this.readFile(configPath, 'utf-8')
    const config = JSON.parse(contents)
    const [prefix, token] = config.IAMToken.split(' ')
    return token
  }

  isTokenExpired (token) {
    const decoded = jws.decode(token, { json: true })
    const expiry_time = decoded.payload.exp
    const now = Math.floor(Date.now() / 1000)

    return expiry_time <= now
  }

  // Support both platforms for configuration files.
  static configFilePath (config_file = DEFAULT_CONFIG_LOCATION) {
    const home_dir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
    const config_path = path.format({ dir: home_dir, base: config_file });
    return config_path
  }
}
