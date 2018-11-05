'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileFunctions = require('../index');

describe('OpenWhiskCompileFunctions', () => {
  let serverless;
  let openwhiskCompileFunctions;
  let sandbox;

  const openwhiskResourcesMockObject = {
    first: {
      actionName: 'first',
      namespace: '',
      action: {
        exec: { kind: 'nodejs:default', code: 'function main() {};' },
      },
    },
    second: {
      actionName: 'second',
      namespace: '',
      action: {
        exec: { kind: 'nodejs:default', code: 'function main() {};' },
      },
    },
  };

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    openwhiskCompileFunctions = new OpenWhiskCompileFunctions(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: '',
      apihost: '',
      auth: '',
    };
    serverless.service.provider = { name: 'openwhisk' };

    serverless.cli = { consoleLog: () => {}, log: () => {} };

    openwhiskCompileFunctions.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#disableSeqPackaging()', () => {
    it('should add disable flag to sequences', () => {
      const fns = {
        first: { handler: 'foo.js' },
        second: { handler: 'foo.js' },
        seq: { sequence: [ 'first', 'second' ] }
      }

      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => Object.keys(fns)
      openwhiskCompileFunctions.serverless.service.getFunction = name => fns[name];

      openwhiskCompileFunctions.disableSeqPackaging()
      expect(fns.seq.package.disable).to.be.true
    });
  });

  describe('#constructAnnotations()', () => {
    it('should handle missing annotations', () => {
      expect(openwhiskCompileFunctions.constructAnnotations())
        .to.deep.equal([]);
    })
    it('should handle empty annotations', () => {
      expect(openwhiskCompileFunctions.constructAnnotations({}))
        .to.deep.equal([]);
    })
    it('should handle annotations present', () => {
      expect(openwhiskCompileFunctions.constructAnnotations({
        hello: 'world', foo: 'bar'
      })).to.deep.equal([
        { key: 'hello', value: 'world' },
        { key: 'foo', value: 'bar' }
      ]);
    })
    it('should add final annotations if web-export is present', () => {
      expect(openwhiskCompileFunctions.constructAnnotations({
        hello: 'world', foo: 'bar', "web-export": true
      })).to.deep.equal([
        { key: 'hello', value: 'world' },
        { key: 'foo', value: 'bar' },
        { key: 'web-export', value: true },
        { key: 'final', value: true }
      ]);
    })
  })

  describe('#calculateFunctionNameSpace()', () => {
    it('should return namespace from function object', () => {
      expect(openwhiskCompileFunctions
        .calculateFunctionNameSpace('testing', { namespace: 'testing' })
      ).to.equal('testing');
    });

    it('should return namespace from service provider', () => {
      openwhiskCompileFunctions.serverless.service.provider = { namespace: 'testing' };
      expect(openwhiskCompileFunctions.calculateFunctionNameSpace('testing', {}))
        .to.equal('testing');
    });
  });

  describe('#logCompiledFunction()', () => {
    it('should log function contents with code to console.', () => {
      const log = sandbox.stub(openwhiskCompileFunctions.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskCompileFunctions.serverless.cli, 'consoleLog')

      openwhiskCompileFunctions.logCompiledFunction('first', openwhiskResourcesMockObject.first)
      expect(log.calledOnce).to.be.equal(true);
      const clone = JSON.parse(JSON.stringify(openwhiskResourcesMockObject.first))
      clone.action.exec.code = '<hidden>'
      expect(log.args[0][0]).to.be.equal(`Compiled Function (first): ${JSON.stringify(clone)}`) 
    });
  
    it('should log function contents without code to console.', () => {
      const log = sandbox.stub(openwhiskCompileFunctions.serverless.cli, 'log')
      const clog = sandbox.stub(openwhiskCompileFunctions.serverless.cli, 'consoleLog')

      const clone = JSON.parse(JSON.stringify(openwhiskResourcesMockObject.first))
      delete clone.action.exec.code
      openwhiskCompileFunctions.logCompiledFunction('first', clone)
      expect(log.calledOnce).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal(`Compiled Function (first): ${JSON.stringify(clone)}`) 
    });
  });

  describe('#compileFunctions()', () => {
    it('should throw an error if the resource section is not available', () => {
      openwhiskCompileFunctions.serverless.service.actions = null;
      expect(() => openwhiskCompileFunctions.compileFunctions())
        .to.throw(Error, /Missing Resources section/);
    });

    it('should throw an error if function definition has handler and sequence', () => {
      const f = { sequence: true, handler: true };
      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => ['service_name'];

      openwhiskCompileFunctions.serverless.service.getFunction = () => f;

      expect(() => openwhiskCompileFunctions.compileFunctions())
        .to.throw(Error, /both "handler" and "sequence" properties/);
    });

    it('should throw an error if function definition is missing a handler or sequence', () => {
      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => ['service_name'];

      openwhiskCompileFunctions.serverless.service.getFunction = () => ({});

      expect(() => openwhiskCompileFunctions.compileFunctions())
        .to.throw(Error, /Missing "handler" or "sequence"/);
    });

    it('should throw an error if unable to read function handler file', () => {
      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => ['service_name'];

      const missing = { handler: 'missing.handler' };

      openwhiskCompileFunctions.serverless.service.getFunction = () => missing;

      sandbox.stub(openwhiskCompileFunctions, 'compileFunction', () => Promise.reject());
      return expect(openwhiskCompileFunctions.compileFunctions()).to.be.rejected;
    });

    it('should create corresponding function resources', () => {
      const keys = Object.keys(openwhiskResourcesMockObject);
      const handler = function (name) {
        return { handler: `${name}.handler` };
      };
      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => keys;
      openwhiskCompileFunctions.serverless.service.getFunction = name => handler(name);
      const log = sandbox.stub(openwhiskCompileFunctions, 'logCompiledFunction')

      const mock = openwhiskResourcesMockObject;
      sandbox.stub(
        openwhiskCompileFunctions, 'compileFunction', name => Promise.resolve(mock[name]));
      const f = openwhiskCompileFunctions.serverless.service.actions;

      return openwhiskCompileFunctions.compileFunctions().then(() => { 
        expect(f).to.deep.equal(openwhiskResourcesMockObject) 
        expect(log.called).to.be.equal(false);
      });
    });

    it('should log compiled functions with verbose flag', () => {
      const keys = Object.keys(openwhiskResourcesMockObject);
      const handler = function (name) {
        return { handler: `${name}.handler` };
      };
      openwhiskCompileFunctions.options.verbose = true;
      openwhiskCompileFunctions.serverless.service.getAllFunctions = () => keys;
      openwhiskCompileFunctions.serverless.service.getFunction = name => handler(name);
      const log = sandbox.stub(openwhiskCompileFunctions, 'logCompiledFunction')

      const mock = openwhiskResourcesMockObject;
      sandbox.stub(
        openwhiskCompileFunctions, 'compileFunction', name => Promise.resolve(mock[name]));
      const f = openwhiskCompileFunctions.serverless.service.actions;

      return openwhiskCompileFunctions.compileFunctions().then(() => {
        expect(log.calledTwice).to.be.equal(true);
      });
    });
  });
});
