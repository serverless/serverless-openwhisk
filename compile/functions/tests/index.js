'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const fs = require('fs-extra');
const OpenWhiskCompileFunctions = require('../index');
const JSZip = require("jszip");

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

    serverless.cli = { log: () => {} };

    openwhiskCompileFunctions.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

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

      const mock = openwhiskResourcesMockObject;
      sandbox.stub(
        openwhiskCompileFunctions, 'compileFunction', name => Promise.resolve(mock[name]));
      const f = openwhiskCompileFunctions.serverless.service.actions;

      return openwhiskCompileFunctions.compileFunctions().then(
        () => expect(f).to.deep.equal(openwhiskResourcesMockObject)
      );
    });
  });
});
