'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const OpenWhiskInfo = require('../');
const BbPromise = require('bluebird');
const chalk = require('chalk');
const moment = require('moment');
const Credentials = require('../../provider/credentials')

require('chai').use(chaiAsPromised);

describe('OpenWhiskInfo', () => {
  let sandbox;

  const CLI = function () { this.log = function () {};};
  const serverless = {pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => {}, provider: {}, defaults: {namespace: ''}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};

  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first'
  };
  const openwhiskInfo = new OpenWhiskInfo(serverless, options);
  openwhiskInfo.client = { routes: { list: () => {} }, rules: { list: () => {} }, triggers: { list: () => {} }, actions: { list: () => {} } };
  serverless.service.service = "my_service";

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskInfo.hooks).to.be.not.empty);

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskInfo, 'validate').returns(BbPromise.resolve());
      const infoStub = sinon
        .stub(openwhiskInfo, 'info').returns(BbPromise.resolve());

      return openwhiskInfo.hooks['info:info']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
        expect(infoStub.calledAfter(validateStub)).to.be.equal(true);
        openwhiskInfo.validate.restore();
        openwhiskInfo.info.restore();
      });
    });
  });


  describe('#info()', () => {
    it('should show title and call display functions', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      const service = sandbox.stub(openwhiskInfo, 'showServiceInfo')
      const action = sandbox.stub(openwhiskInfo, 'showActionsInfo')
      const triggers = sandbox.stub(openwhiskInfo, 'showTriggersInfo')
      const rules = sandbox.stub(openwhiskInfo, 'showRulesInfo')
      const routes = sandbox.stub(openwhiskInfo, 'showRoutesInfo')

      return openwhiskInfo.info().then(() => {
        expect(service.calledOnce).to.be.equal(true);
        expect(action.calledOnce).to.be.equal(true);
        expect(triggers.calledOnce).to.be.equal(true);
        expect(rules.calledOnce).to.be.equal(true);
        expect(routes.calledOnce).to.be.equal(true);
        expect(log.args[0][0].match(/Service Information/)).to.be.ok;
      });
    });
  });

  describe('#showServiceInfo()', () => {
    it('should show service, platform and call display functions', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      openwhiskInfo.props = {
        apihost: 'some_end_point',
        namespace: 'custom_ns'
      };

      openwhiskInfo.showServiceInfo()
      expect(log.calledThrice).to.be.equal(true);
      expect(log.args[0][0].match(/platform:\tsome_end_point/)).to.be.ok;
      expect(log.args[1][0].match(/namespace:\tcustom_ns/)).to.be.ok;
      expect(log.args[2][0].match(/service:\tmy_service/)).to.be.ok;
    });
  });

  describe('#showActionsInfo()', () => {
    it('should show action names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.actions, 'list').returns(BbPromise.resolve([
        {name: 'first'}, {name: 'second'}, {name: 'third'}
      ]));

      return expect(openwhiskInfo.showActionsInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/actions:/)).to.be.ok;
        expect(log.args[1][0].match(/first    second    third/)).to.be.ok;
      }));
    })
  })

  describe('#showTriggersInfo()', () => {
    it('should show trigger names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.triggers, 'list').returns(BbPromise.resolve([
        {name: 'first'}, {name: 'second'}, {name: 'third'}
      ]));

      return expect(openwhiskInfo.showTriggersInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/triggers:/)).to.be.ok;
        expect(log.args[1][0].match(/first    second    third/)).to.be.ok;
      }));
    })
  })

  describe('#showRulesInfo()', () => {
    it('should show rules names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.rules, 'list').returns(BbPromise.resolve([
        {name: 'first'}, {name: 'second'}, {name: 'third'}
      ]));

      return expect(openwhiskInfo.showRulesInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/rules:/)).to.be.ok;
        expect(log.args[1][0].match(/first    second    third/)).to.be.ok;
      }));
    })
  })

  describe('#showRoutesInfo()', () => {
    it('should show routes returned', () => {
      const endpoint = {
        "x-ibm-op-ext": {
          "actionName": "my_service-dev-hello"
        }
      }
      const apis = [{
        value: {
          apidoc: {
            paths: {
              "/api/hello": { get: endpoint },
              "/api/foobar": { post: endpoint }
            }
          }
        }
      }, {
        value: {
          apidoc: {
            paths: {
              "/api/foo/1": { get: endpoint },
              "/api/bar/2": { post: endpoint }
            }
          }
        }
      }] 

      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.routes, 'list').returns(BbPromise.resolve({ apis }));

      return expect(openwhiskInfo.showRoutesInfo().then(() => {
        expect(log.args[0][0].match(/endpoints:/)).to.be.ok;
        expect(log.args[2][0].match(/\/api\/hello GET -> my_service-dev-hello/)).to.be.ok;
        expect(log.args[2][0].match(/\/api\/foobar POST -> my_service-dev-hello/)).to.be.ok;
        expect(log.args[4][0].match(/\/api\/foo\/1 GET -> my_service-dev-hello/)).to.be.ok;
        expect(log.args[4][0].match(/\/api\/bar\/2 POST -> my_service-dev-hello/)).to.be.ok;
      }));
    })
  })
});
