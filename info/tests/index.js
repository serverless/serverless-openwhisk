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
  const serverless = {pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => {}, provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};

  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first'
  };
  const openwhiskInfo = new OpenWhiskInfo(serverless, options);
  openwhiskInfo.client = { routes: { list: () => {} }, rules: { list: () => {} }, triggers: { list: () => {} }, packages: { list: () => {} }, actions: { list: () => {} } };
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
      const packages = sandbox.stub(openwhiskInfo, 'showPackagesInfo')
      const triggers = sandbox.stub(openwhiskInfo, 'showTriggersInfo')
      const rules = sandbox.stub(openwhiskInfo, 'showRulesInfo')
      const routes = sandbox.stub(openwhiskInfo, 'showRoutesInfo')
      const web_actions = sandbox.stub(openwhiskInfo, 'showWebActionsInfo')

      return openwhiskInfo.info().then(() => {
        expect(service.calledOnce).to.be.equal(true);
        expect(packages.calledOnce).to.be.equal(true);
        expect(action.calledOnce).to.be.equal(true);
        expect(triggers.calledOnce).to.be.equal(true);
        expect(rules.calledOnce).to.be.equal(true);
        expect(routes.calledOnce).to.be.equal(true);
        expect(web_actions.calledOnce).to.be.equal(true);
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

  describe('#showPackagesInfo()', () => {
    it('should show package names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.packages, 'list').returns(BbPromise.resolve([
        {name: 'first'}, {name: 'second'}, {name: 'third'}
      ]));

      return expect(openwhiskInfo.showPackagesInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/packages:/)).to.be.ok;
        expect(log.args[1][0].match(/first    second    third/)).to.be.ok;
      }));
    })
  })

  describe('#showActionsInfo()', () => {
    it('should show action names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.actions, 'list').returns(BbPromise.resolve([
        {name: 'first', namespace: 't'}, {name: 'second', namespace: "t"}, {name: 'third', namespace: "t"}
      ]));

      return expect(openwhiskInfo.showActionsInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/actions:/)).to.be.ok;
        expect(log.args[1][0].match(/first    second    third/)).to.be.ok;
      }));
    })

    it('should show package action names returned', () => {
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.actions, 'list').returns(BbPromise.resolve([
        {name: 'first', namespace: "testing"}, {name: 'second', namespace: 'user@host.com/somePackage'}, {name: 'third', namespace: "testing"}
      ]));

      return expect(openwhiskInfo.showActionsInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/actions:/)).to.be.ok;
        expect(log.args[1][0].match(/first    somePackage\/second    third/)).to.be.ok;
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
          gwApiUrl: 'https://api-gateway.com/service_name',
          apidoc: {
            paths: {
              "/api/hello": { get: endpoint },
              "/api/foobar": { post: endpoint }
            }
          }
        }
      }, {
        value: {
          gwApiUrl: 'https://api-gateway.com/service_name',
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
        expect(log.args[0][0].match(/endpoints \(api-gw\):/)).to.be.ok;
        expect(log.args[1][0].match(/GET https:\/\/api-gateway.com\/service_name\/api\/hello/)).to.be.ok;
        expect(log.args[2][0].match(/POST https:\/\/api-gateway.com\/service_name\/api\/foobar/)).to.be.ok;
        expect(log.args[3][0].match(/GET https:\/\/api-gateway.com\/service_name\/api\/foo\/1/)).to.be.ok;
        expect(log.args[4][0].match(/POST https:\/\/api-gateway.com\/service_name\/api\/bar\/2/)).to.be.ok;
      }));
    })

    it('should show api v2 routes returned', () => {
      const endpoint = {
        "x-openwhisk": {
          "action": "my_service-dev-hello"
        }
      }
      const apis = [{
        value: {
          gwApiUrl: 'https://api-gateway.com/service_name/api',
          apidoc: {
            paths: {
              "hello": { get: endpoint },
              "foobar": { post: endpoint }
            }
          }
        }
      }, {
        value: {
          gwApiUrl: 'https://api-gateway.com/service_name/api',
          apidoc: {
            paths: {
              "foo/1": { get: endpoint },
              "bar/2": { post: endpoint }
            }
          }
        }
      }] 

      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.routes, 'list').returns(BbPromise.resolve({ apis }));

      return expect(openwhiskInfo.showRoutesInfo().then(() => {
        expect(log.args[0][0].match(/endpoints \(api-gw\):/)).to.be.ok;
        expect(log.args[1][0].match(/GET https:\/\/api-gateway.com\/service_name\/api\/hello/)).to.be.ok;
        expect(log.args[2][0].match(/POST https:\/\/api-gateway.com\/service_name\/api\/foobar/)).to.be.ok;
        expect(log.args[3][0].match(/GET https:\/\/api-gateway.com\/service_name\/api\/foo\/1/)).to.be.ok;
        expect(log.args[4][0].match(/POST https:\/\/api-gateway.com\/service_name\/api\/bar\/2/)).to.be.ok;
      }));
    })

    it('should display error message in failsafe mode', () => {
      openwhiskInfo.failsafe = true;
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.routes, 'list').returns(BbPromise.resolve(false));

      return expect(openwhiskInfo.showRoutesInfo().then(() => {
        expect(log.calledTwice).to.be.equal(true);
        expect(log.args[0][0].match(/endpoints \(api-gw\):/)).to.be.ok;
        expect(log.args[1][0].match(/failed to fetch routes/)).to.be.ok;
      }));
    })

    it('should display error message about expired key in failsafe mode', () => {
      openwhiskInfo.failsafe = true;
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.routes, 'list').returns(BbPromise.reject(new Error('status code 400 blah blah expired')));

      return expect(openwhiskInfo.showRoutesInfo().then(() => {
        expect(log.calledThrice).to.be.equal(true);
        expect(log.args[0][0].match(/endpoints \(api-gw\):/)).to.be.ok;
        expect(log.args[1][0].match(/failed to fetch routes/)).to.be.ok;
        expect(log.args[2][0].match(/expired/)).to.be.ok;
      }));
    })

    it('should return error about expired key without failsafe mode', () => {
      openwhiskInfo.failsafe = false;
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      sandbox.stub(openwhiskInfo.client.routes, 'list').returns(BbPromise.reject(new Error('status code 400 blah blah expired')));

      return expect(openwhiskInfo.showRoutesInfo())
        .to.eventually.be.rejected;
    })
  })

  describe('#showWebActionsInfo()', () => {
    it('should show web action routes returned', () => {
      const apihost = 'openwhisk.ng.bluemix.net'
      openwhiskInfo.provider = { props: () => Promise.resolve({ apihost }) }
      const log = sandbox.stub(openwhiskInfo, 'consoleLog')
      openwhiskInfo._actions = [
        {name: 'first', namespace: 'user_name', annotations: [{key: 'web-export', value: true}, {key: 'a', value: 'b'}]}, 
        {name: 'second', namespace: 'user_name', annotations: [{key: 'web-export', value: false}]}, 
        {name: 'third'},
        {name: 'fourth', namespace: 'user_name', annotations: [{key: 'web-export', value: true}]}, 
        {name: 'fifth', annotations: []},
        {name: 'sixth', namespace: 'user_name/custom_package', annotations: [{key: 'web-export', value: true}]},
      ];

      return expect(openwhiskInfo.showWebActionsInfo().then(() => {
        expect(log.callCount).to.be.equal(4);
        expect(log.args[0][0].match(/endpoints \(web actions\):/)).to.be.ok;
        expect(log.args[1][0].match(/https:\/\/openwhisk.ng.bluemix.net\/api\/v1\/web\/user_name\/default\/first/)).to.be.ok;
        expect(log.args[2][0].match(/https:\/\/openwhisk.ng.bluemix.net\/api\/v1\/web\/user_name\/default\/fourth/)).to.be.ok;
        expect(log.args[3][0].match(/https:\/\/openwhisk.ng.bluemix.net\/api\/v1\/web\/user_name\/custom_package\/sixth/)).to.be.ok;
      }));
    })
  })
});
