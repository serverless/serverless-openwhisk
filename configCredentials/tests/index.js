'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const BbPromise = require('bluebird');
const fs = require('fs');
const fse = require('fs-extra');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const OpenWhiskConfigCredentials = require('../index');
const OpenWhiskProvider = require('../../provider/openwhiskProvider');

const getTmpDirPath = () => path.join(os.tmpdir(),
  'tmpdirs-serverless', 'serverless', crypto.randomBytes(8).toString('hex'));

const getTmpFilePath = (fileName) => path.join(getTmpDirPath(), fileName);

describe('OpenWhiskConfigCredentials', () => {
  let openwhiskConfigCredentials;

  const serverless = {
    cli: { log: () => {} },
    utils: {}
  };
 
  beforeEach(() => {
    const options = {
      provider: 'openwhisk',
      apihost: 'openwhisk.ng.bluemix.net',
      auth: 'user:pass',
    };
    openwhiskConfigCredentials = new OpenWhiskConfigCredentials(serverless, options);
  });

  describe('#constructor()', () => {
    it('should have the command "config"', () => {
      expect(openwhiskConfigCredentials.commands.config).to.not.equal(undefined);
    });

    it('should have the sub-command "credentials"', () => {
      expect(openwhiskConfigCredentials.commands.config.commands.credentials).to.not.equal(undefined);
    });

    it('should have no lifecycle event', () => {
      expect(openwhiskConfigCredentials.commands.config.lifecycleEvents).to.equal(undefined);
    });

    it('should have the lifecycle event "config" for the "credentials" sub-command', () => {
      expect(openwhiskConfigCredentials.commands.config.commands.credentials.lifecycleEvents)
        .to.deep.equal(['config']);
    });

    it('should have the req. options "apihost" and "auth" for the "credentials" sub-command', () => {
      // eslint-disable-next-line no-unused-expressions
      expect(openwhiskConfigCredentials.commands.config.commands.credentials.options.apihost.required)
        .to.be.true;
      // eslint-disable-next-line no-unused-expressions
      expect(openwhiskConfigCredentials.commands.config.commands.credentials.options.auth.required)
        .to.be.true;
    });

    it('should have a "config:credentials:config" hook', () => {
      expect(openwhiskConfigCredentials.hooks['config:credentials:config']).to.not.equal(undefined);
    });

    it('should run promise chain in order for "config:credentials:config" hook', () => {
      const openwhiskConfigCredentialsStub = sinon
        .stub(openwhiskConfigCredentials, 'configureCredentials').returns(BbPromise.resolve());

      return openwhiskConfigCredentials.hooks['config:credentials:config']().then(() => {
        expect(openwhiskConfigCredentialsStub.calledOnce).to.equal(true);

        openwhiskConfigCredentials.configureCredentials.restore();
      });
    });
  });

  describe('#configureCredentials()', () => {
    let homeDir;
    let tmpDirPath;
    let credentialsFilePath;

    beforeEach(() => {
      // create a new tmpDir for the homeDir path
      tmpDirPath = getTmpDirPath();
      fse.mkdirsSync(tmpDirPath);

      // create the .openwhisk/credetials directory and file
      credentialsFilePath = path.join(tmpDirPath, '.wskprops');
      fse.ensureFileSync(credentialsFilePath);

      // save the homeDir so that we can reset this later on
      homeDir = os.homedir();
      process.env.HOME = tmpDirPath;
      process.env.HOMEPATH = tmpDirPath;
      process.env.USERPROFILE = tmpDirPath;
    });

    it('should lowercase the provider option', () => {
      openwhiskConfigCredentials.options.provider = 'SOMEPROVIDER';

      return openwhiskConfigCredentials.configureCredentials().then(() => {
        expect(openwhiskConfigCredentials.options.provider).to.equal('someprovider');
      });
    });

    it('should resolve if the provider option is not "openwhisk"', (done) => {
      openwhiskConfigCredentials.options.provider = 'invalid-provider';

      openwhiskConfigCredentials.configureCredentials().then(() => done());
    });

    it('should throw an error if the "apihost" and "auth" options are not given', () => {
      openwhiskConfigCredentials.options.apihost = false;
      openwhiskConfigCredentials.options.auth = false;

      expect(() => openwhiskConfigCredentials.configureCredentials()).to.throw(Error);
    });

    it('should reject if credentials file exists and has credentials', () => {
      serverless.utils.fileExistsSync = () => true;
      serverless.utils.readFileSync = () => "AUTH";

      const lines = []
      serverless.cli.log = log => lines.push(log)
      return openwhiskConfigCredentials.configureCredentials().then(() => {
        expect(lines[2]).to.equal('Failed! ~/.wskprops exists and already has credentials.');
      });
    });

    it('should write to empty credentials file', () => {
      openwhiskConfigCredentials.options.apihost = 'my-apihost';
      openwhiskConfigCredentials.options.auth = 'my-auth';

      let args 
      serverless.utils.fileExistsSync = () => true;
      serverless.utils.readFileSync = () => "";
      serverless.utils.writeFile = (path, content) => args = {path, content};

      return openwhiskConfigCredentials.configureCredentials().then(() => {
        expect(args.content).to.equal('APIHOST=my-apihost\nAUTH=my-auth');
      });
    });

    afterEach(() => {
      // recover the homeDir
      process.env.HOME = homeDir;
      process.env.HOMEPATH = homeDir;
      process.env.USERPROFILE = homeDir;
    });
  });
});
