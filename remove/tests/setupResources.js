'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const OpenWhiskRemove = require('../index');
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

describe('OpenWhiskRemove', () => {
  const CLI = function () { this.log = function () {};};
  const serverless = {setProvider: () => {}, config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => ({}), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
  let openwhiskRemove;
  let sandbox;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskRemove = new OpenWhiskRemove(serverless, options);
    openwhiskRemove.serverless.cli = new serverless.classes.CLI();
    openwhiskRemove.serverless.service.service = 'helloworld';
    openwhiskRemove.provider = {client: () => {}};
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#initializeRules()', () => {
    it('should set up empty rules when configuration missing', () => {
      openwhiskRemove.serverless.service.rules = null;
      const stub = sandbox.stub(openwhiskRemove.serverless.service, "getAllFunctions").returns([])
      openwhiskRemove.initializeRules();
      expect(stub.called).to.be.equal(true);
      expect(openwhiskRemove.serverless.service.rules).to.deep.equal([]);
    });

    it('should set up configured rules', () => {
      const rules = {
        "first": {events: [{trigger: 'trigger'}]},
        "second": {events: [{trigger: { name: 'trigger', rule: 'rule_name'}}]}
      }
      openwhiskRemove.serverless.service.rules = null;
      sandbox.stub(openwhiskRemove.serverless.service, "getAllFunctions").returns(["first", "second"])
      sandbox.stub(openwhiskRemove.serverless.service, "getFunction", id => rules[id])
      openwhiskRemove.initializeRules();
      expect(openwhiskRemove.serverless.service.rules).to.deep.equal(["helloworld_trigger_to_first", "rule_name"]);
    });
  });

  describe('#initializeTriggers()', () => {
    it('should set up triggers without configured rules', () => {
      openwhiskRemove.serverless.service.resources.triggers =  null
      sandbox.stub(openwhiskRemove, "getEventTriggers").returns([])
      openwhiskRemove.initializeTriggers();
      expect(openwhiskRemove.serverless.service.resources.triggers).to.deep.equal({});
    });
    it('should set up triggers', () => {
      openwhiskRemove.serverless.service.resources.triggers = {existing: {}};
      sandbox.stub(openwhiskRemove, "getEventTriggers").returns(["first", "second"])
      openwhiskRemove.initializeTriggers();
      expect(openwhiskRemove.serverless.service.resources.triggers).to.deep.equal({existing: {}, first: {}, second: {}});
    });
  });
});
