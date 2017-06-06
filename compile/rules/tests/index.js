'use strict';

const BbPromise = require('bluebird');
const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileRules = require('../index');

describe('OpenWhiskCompileRules', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileRules;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileRules = new OpenWhiskCompileRules(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { consoleLog: () => {}, log: () => {} };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#setup()', () => {
    it('should not call provider props if namespace in defaults', () => {
      openwhiskCompileRules.serverless.getProvider = () => ({props: sinon.assert.fail});
      openwhiskCompileRules.setup();
    })

    it('should use provider props if namespace available', () => {
      openwhiskCompileRules.serverless.service.provider.namespace = null;
      const props = () => BbPromise.resolve({namespace: 'sample_ns'})
      openwhiskCompileRules.provider = { props };
      return openwhiskCompileRules.setup().then(() => {
        expect(openwhiskCompileRules.serverless.service.provider.namespace).to.equal("sample_ns")
      });
    })

    it('should use default namespace if provider namespace missing', () => {
      openwhiskCompileRules.serverless.service.provider.namespace = null;
      const props = () => BbPromise.resolve({})
      openwhiskCompileRules.provider = { props };
      return openwhiskCompileRules.setup().then(() => {
        expect(openwhiskCompileRules.serverless.service.provider.namespace).to.equal("_")
      });
    })
  });

  describe('#compileRules()', () => {
    beforeEach(() => {
      openwhiskCompileRules.setup();
    });

    it('should throw an error if the resource section is not available', () => {
      openwhiskCompileRules.serverless.service.rules = null;
      expect(() => openwhiskCompileRules.compileRules())
        .to.throw(Error, /Missing Rules section/);
    });

    it('should return empty rules if functions has no triggers', () =>
      expect(openwhiskCompileRules.compileRules().then(() => {
        expect(openwhiskCompileRules.serverless.service.rules).to.deep.equal({});
      })).to.eventually.be.fulfilled
    );

    it('should call compileFunctionRule and update rules for each function with events', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileFunctionRules').returns([{ruleName: 'ruleName'}]);
      openwhiskCompileRules.serverless.service.rules = {};

      sandbox.stub(openwhiskCompileRules.serverless.service, 'getAllFunctions', () => ["first", "second", "third"]);

      const handler = name => ({events: {}})
      openwhiskCompileRules.serverless.service.getFunction = handler;

      return expect(openwhiskCompileRules.compileRules().then(() => {
        expect(openwhiskCompileRules.serverless.service.rules).to.deep.equal({
          'ruleName': {ruleName: 'ruleName'}
        });
        expect(stub.calledThrice).to.be.equal(true);
      })).to.eventually.be.fulfilled;
    });
  });

  describe('#compileFunctionRules()', () => {
    beforeEach(() => {
      openwhiskCompileRules.setup();
    });

    it('should not call compileRule when events parameter is missing', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule')
      const rules = openwhiskCompileRules.compileFunctionRules('name', {})
      expect(rules).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })
    
    it('should not call compileRule when events list contains no triggers', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule')
      const rules = openwhiskCompileRules.compileFunctionRules('name', { events: [{"api": {}}] })
      expect(rules).to.deep.equal([]);
      expect(stub.called).to.be.equal(false);
    })

    it('should call compileRule when events list contains triggers', () => {
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule').returns({})
      const rules = openwhiskCompileRules.compileFunctionRules('name', { events: [
        {"trigger": {}},
        {"trigger": {}},
        {"trigger": {}},
      ] })
      expect(rules).to.deep.equal([{}, {}, {}]);
      expect(stub.calledThrice).to.be.equal(true);
    })

    it('should log rules when verbose flag is used', () => {
      openwhiskCompileRules.options.verbose = true
      const log = sandbox.stub(openwhiskCompileRules.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskCompileRules.serverless.cli, 'consoleLog')
      const stub = sinon.stub(openwhiskCompileRules, 'compileRule').returns({ foo: 'bar' })
      openwhiskCompileRules.compileFunctionRules('name', { events: [
        {"trigger": true},
        {"trigger": true},
        {"trigger": true}
      ] })

      expect(log.calledOnce).to.be.equal(true);
      const result = JSON.stringify([{foo: 'bar'}, {foo: 'bar'}, {foo: 'bar'}]);
      expect(log.args[0][0]).to.be.equal(`Compiled Rule (name): ${result}`);
    })

  });

  describe('#compileRule()', () => {
    beforeEach(() => {
      openwhiskCompileRules.setup();
    });

    it('should define rules from trigger string', () => {
      openwhiskCompileRules.serverless.service.service = 'my-service' 
      openwhiskCompileRules.serverless.service.provider = {namespace: "sample_ns"};
      const funcObj = {}
      const trigger = "some-trigger"
      const testing = {
        ruleName: 'my-service_some-trigger_to_action-name', 
        action: '/sample_ns/my-service_action-name',
        trigger: '/sample_ns/some-trigger',
        namespace: 'sample_ns', 
        overwrite: true
      };
      const result = openwhiskCompileRules.compileRule('action-name', {}, trigger);
      return expect(result).to.deep.equal(testing);
    });

    it('should define rules from trigger object', () => {
      openwhiskCompileRules.serverless.service.service = 'my-service' 
      openwhiskCompileRules.serverless.service.provider = {namespace: "sample_ns"};
      const funcObj = { namespace: 'custom_ns' }
      const trigger = {name: "custom_trigger_name", rule: "custom_rule_name", overwrite: false}
      const testing = {
        ruleName: 'custom_rule_name', 
        action: '/custom_ns/my-service_action-name',
        trigger: '/sample_ns/custom_trigger_name',
        namespace: 'custom_ns',
        overwrite: false 
      };
      const result = openwhiskCompileRules.compileRule('action-name', funcObj, trigger);
      return expect(result).to.deep.equal(testing);
    });

    it('should throw if trigger missing rule', () => {
      expect(() => openwhiskCompileRules.compileRule('', {}, {name: ''}))
        .to.throw(Error, /Missing mandatory rule property from Event Trigger/);
    });

    it('should throw if trigger missing name', () => {
      expect(() => openwhiskCompileRules.compileRule('', {}, {rule: ''}))
        .to.throw(Error, /Missing mandatory name property from Event Trigger/);
    });


    /*
    it('should define rules with manifest params', () => {
      const params = { overwrite: true, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        ruleName: 'testing',
        overwrite: true,
        namespace: 'another_ns',
        parameters: [{ key: 'hello', value: 'world' }],
      };
      const result = openwhiskCompileRules.compileRule('testing', params);
      return expect(result).to.deep.equal(expected);
    });

    it('should define rules with feed manifest params', () => {
      const feedName = '/ns/package/feed';
      const params = { feed: feedName, feed_parameters: { hello: 'world' } };
      const expected = {
        ruleName: 'myRule',
        overwrite: true,
        namespace: 'testing',
        feed: {
          feedName: 'package/feed',
          namespace: 'ns',
          rule: '/testing/myRule',
          params: params.feed_parameters,
        },
      };
      const result = openwhiskCompileRules.compileRule('myRule', params);
      return expect(result).to.deep.equal(expected);
    });
    */
  });
});
