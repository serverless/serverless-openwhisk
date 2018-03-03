'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const fs = require('fs-extra');
const chaiAsPromised = require('chai-as-promised');
const Credentials = require('../credentials');

require('chai').use(chaiAsPromised);

describe('#getWskProps()', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    ['WSK_CONFIG_FILE', ...Credentials.ENV_PARAMS].forEach(param => process.env[param] = '');
    sandbox.restore();
  });

  describe('should instantiate openwhisk resources from the properties file', () => {
    const mockObject = {
      apihost: 'openwhisk.ng.bluemix.net',
      auth: 'user:pass',
      namespace: 'blah@provider.com_dev',
      apigw_access_token: 'blahblahblahkey1234',
    };

    const wskProps =
      'APIHOST=openwhisk.ng.bluemix.net\nNAMESPACE=blah@provider.com_dev\n'  +
      'AUTH=user:pass\nAPIGW_ACCESS_TOKEN=blahblahblahkey1234\n';

    it('when the default is used', () => {
      const home = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];

      sandbox.stub(fs, 'readFile', (path, encoding, cb) => {
        expect(path.match(home).length).to.equal(1);
        expect(path.match('.wskprops').length).to.equal(1);
        cb(null, wskProps);
      });

      return expect(Credentials.getWskProps()).to.eventually.deep.equal(mockObject);
    });

    it('when a path is specified', () => {
      const propsFilePath = '/different/place/file_name';
      process.env.WSK_CONFIG_FILE = propsFilePath;

      sandbox.stub(fs, 'readFile', (path, encoding, cb) => {
        expect(path).to.equal(propsFilePath);
        cb(null, wskProps);
      });

      return expect(Credentials.getWskProps()).to.eventually.deep.equal(mockObject);
    });
  });

  it('should instantiate openwhisk resources from environment variables', () => {
    const mockObject = {
      apihost: 'blah.blah.com',
      auth: 'another_user:another_pass',
      namespace: 'user@user.com',
      apigw_access_token: 'some_access_token'
    };

    sandbox.stub(fs, 'readFile', (path, encoding, cb) => {
      cb(true);
    });

    process.env.OW_APIHOST = 'blah.blah.com';
    process.env.OW_AUTH = 'another_user:another_pass';
    process.env.OW_NAMESPACE = 'user@user.com';
    process.env.OW_APIGW_ACCESS_TOKEN = 'some_access_token';

    return expect(Credentials.getWskProps()).to.eventually.deep.equal(mockObject);
  });

  it('should overwrite properties files resource variables with environment variables', () => {
    const mockObject = {
      apihost: 'blah.blah.com',
      auth: 'another_user:another_pass',
      namespace: 'user@user.com',
      apigw_access_token: 'some_access_token'
    };

    const wskProps =
      'APIHOST=openwhisk.ng.bluemix.net\nNAMESPACE=blah@provider.com_dev\nAUTH=user:pass\nAPIGW_ACCESS_TOKEN=hello\n';

    sandbox.stub(fs, 'readFile', (path, encoding, cb) => {
      cb(null, wskProps);
    });

    process.env.OW_APIHOST = 'blah.blah.com';
    process.env.OW_AUTH = 'another_user:another_pass';
    process.env.OW_NAMESPACE = 'user@user.com';
    process.env.OW_APIGW_ACCESS_TOKEN = 'some_access_token';

    return expect(Credentials.getWskProps()).to.eventually.deep.equal(mockObject);
  });
});
