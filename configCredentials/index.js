'use strict';

const BbPromise = require('bluebird');
const path = require('path');
const fse = require('fs-extra');

class OpenWhiskConfigCredentials {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    // Note: we're not setting the provider here as this plugin should also be
    // run when the CWD is not an AWS service

    // this will be merged with the core config commands
    this.commands = {
      config: {
        commands: {
          credentials: {
            lifecycleEvents: [
              'config',
            ],
            options: {
              apihost: {
                usage: 'OpenWhisk platform API hostname.',
                shortcut: 'h',
                required: true,
              },
              auth: {
                usage: 'User authentication credentials for the provider',
                shortcut: 'a',
                required: true,
              }
            },
          },
        },
      },
    };

    this.hooks = {
      'config:credentials:config': () => BbPromise.bind(this)
        .then(this.configureCredentials),
    };
  }

  configureCredentials() {
    // sanitize
    this.options.provider = this.options.provider.toLowerCase();
    this.options.profile = this.options.profile ? this.options.profile : 'default';

    // resolve if provider option is not 'aws'
    if (this.options.provider !== 'openwhisk') {
      return BbPromise.resolve();
    }

    // validate
    if (!this.options.apihost || !this.options.auth) {
      throw new this.serverless.classes.Error('Please include --auth and --apihost options for Apache OpenwWhisk.');
    }

    this.serverless.cli.log('Setting up Apache OpenWhisk...');
    this.serverless.cli.log('Saving your credentials in "~/.wskprops"...');

    // locate home directory on user's machine
    const env = process.env;
    const home = env.HOME ||
      env.USERPROFILE ||
      (env.HOMEPATH ? ((env.HOMEDRIVE || 'C:/') + env.HOMEPATH) : null);

    if (!home) {
      throw new this.serverless.classes
        .Error('Can\'t find home directory on your local file system.');
    }

    // check if ~/.wskprops exists
    const credsPath = path.join(home, '.wskprops');

    if (this.serverless.utils.fileExistsSync(credsPath)) {
      // check if credentials files contains anything
      const credsFile = this.serverless.utils.readFileSync(credsPath);

      // if credentials file exists w/ auth, exit
      if (credsFile.length && credsFile.indexOf(`AUTH`) > -1) {
        this.serverless.cli.log(
          `Failed! ~/.wskprops exists and already has credentials.`);
        return BbPromise.resolve();
      }
    }

    // write credentials file with 'default' profile
    this.serverless.utils.writeFile(
      credsPath,
      `APIHOST=${this.options.apihost}
AUTH=${this.options.auth}`); 

    this.serverless.cli.log(
      'Success! Your Apache OpenWhisk credentials were stored in the configuration file (~/.wskprops).'
    );

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskConfigCredentials;
