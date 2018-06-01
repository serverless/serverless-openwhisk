'use strict';

const chalk = require('chalk');
const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const OpenWhiskInvoke = require('../');
const BbPromise = require('bluebird');
const fs = require('fs-extra');

require('chai').use(chaiAsPromised);

describe('OpenWhiskInvoke', () => {
  let sandbox;

  const CLI = function () { this.log = function () {};};
  const serverless = {config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: () => {}, provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};

  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first',
  };
  const openwhiskInvoke = new OpenWhiskInvoke(serverless, options);

  beforeEach(() => {
    openwhiskInvoke.provider = {client: () => Promise.resolve({})}
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskInvoke.hooks).to.be.not.empty);

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskInvoke, 'validate').returns(BbPromise.resolve());
      const invokeStub = sinon
        .stub(openwhiskInvoke, 'invoke').returns(BbPromise.resolve());
      const logStub = sinon
        .stub(openwhiskInvoke, 'log').returns(BbPromise.resolve());

      return openwhiskInvoke.hooks['invoke:invoke']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
        expect(invokeStub.calledAfter(validateStub)).to.be.equal(true);
        expect(logStub.calledAfter(invokeStub)).to.be.equal(true);

        openwhiskInvoke.validate.restore();
        openwhiskInvoke.invoke.restore();
        openwhiskInvoke.log.restore();
      });
    });
  });

  describe('#validate()', () => {
    beforeEach(() => {
      serverless.config.servicePath = true;
      serverless.service.environment = {
        vars: {},
        stages: {
          dev: {
            vars: {},
            regions: {
              'us-east-1': {
                vars: {},
              },
            },
          },
        },
      };
      serverless.service.functions = {
        first: {
          handler: true,
        },
      };
      serverless.service.getFunction = name => serverless.service.functions[name];
    });

    it('it should parse data parameter as JSON if provided', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      const data = {
        testProp: 'testValue',
      };
      openwhiskInvoke.options.data = '{"hello": "world"}';

      return openwhiskInvoke.validate().then(() => {
        expect(openwhiskInvoke.options.data).to.deep.equal({hello: "world"});
        openwhiskInvoke.options.data = null;
      });
    });

    it('it should parse stdin as JSON data without explicit options', () => {
      const data = '{"hello": "world"}';
      sinon.stub(openwhiskInvoke, 'getStdin').returns(BbPromise.resolve(data));

      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      return openwhiskInvoke.validate().then(() => {
        expect(openwhiskInvoke.options.data).to.deep.equal({hello: "world"});
        openwhiskInvoke.options.data = null;
      });
    });

    it('it should throw if file is not parsed as JSON object (invalid)', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      openwhiskInvoke.options.data = '{"hello": "world"';
      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('Error parsing')
    });

    it('it should throw if file is not parsed as JSON object (number)', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      openwhiskInvoke.options.data = '1';
      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('Error parsing')
    });

    it('it should parse file if file path is provided', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      const data = {
        testProp: 'testValue',
      };
      openwhiskInvoke.serverless.utils = {fileExistsSync: () => true};
      openwhiskInvoke.readFileSync = () => JSON.stringify(data);
      openwhiskInvoke.options.path = 'data.json';
      openwhiskInvoke.options.data = null;

      return openwhiskInvoke.validate().then(() => {
        expect(openwhiskInvoke.options.data).to.deep.equal(data);
        openwhiskInvoke.options.path = false;
        serverless.config.servicePath = true;
      });
    });

    it('it should throw if file is not parsed as JSON object', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      openwhiskInvoke.serverless.utils = {fileExistsSync: () => true};
      openwhiskInvoke.options.path = 'data.txt';
      openwhiskInvoke.readFileSync = () => 'testing';

      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('Error parsing')
    });

    it('it should throw if type parameter is not valid value', () => {
      openwhiskInvoke.options.type = 'random';
      openwhiskInvoke.options.path = null;
      openwhiskInvoke.options.data = null;
      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('blocking or nonblocking')
    });

    it('it should throw if log parameter is not valid value', () => {
      openwhiskInvoke.options.type = 'blocking';
      openwhiskInvoke.options.log = 'random';
      openwhiskInvoke.options.path = null;
      openwhiskInvoke.options.data = '{}';
      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('result or response')
    });

    it('it should throw error if service path is not set', () => {
      serverless.config.servicePath = false;
      expect(() => openwhiskInvoke.validate()).to.throw(Error);
    });

    it('it should throw error if file path does not exist', () => {
      serverless.config.servicePath = path.join(os.tmpdir(), (new Date).getTime().toString());
      openwhiskInvoke.serverless.utils = {fileExistsSync: () => false};
      openwhiskInvoke.options.path = 'some/path';
      openwhiskInvoke.options.data = null;

      return expect(openwhiskInvoke.validate()).to.eventually.be.rejectedWith('does not exist')
    });
  });

  describe('#invoke()', () => {
    let invokeStub;
    beforeEach(() => {
      openwhiskInvoke.serverless.service.functions = {
        first: {
          namespace: 'sample',
          handler: true,
        },
      };

      openwhiskInvoke.serverless.service.service = 'new-service';
      openwhiskInvoke.options = {
        stage: 'dev',
        function: 'first',
        data: { a: 1 },
      };

      openwhiskInvoke.client = { actions: { invoke: () => {} } };
    });

    afterEach(() => {
      invokeStub.restore();
    });

    it('should invoke with correct params', () => {
      invokeStub = sinon.stub(openwhiskInvoke.client.actions, 'invoke')
        .returns(BbPromise.resolve());
      return openwhiskInvoke.invoke().then(() => {
        expect(invokeStub.calledOnce).to.be.equal(true);
        expect(invokeStub.args[0][0]).to.be.deep.equal({
          actionName: 'new-service_first',
          blocking: false,
          namespace: 'sample',
          params: { a: 1 },
        });
      });
    }
    );


    it('should reject when sdk client fails', () => {
      invokeStub = sinon.stub(openwhiskInvoke.client.actions, 'invoke').returns(BbPromise.reject());
      return expect(openwhiskInvoke.invoke()).to.be.eventually.rejected;
    });
  });

  describe('#log()', () => {
    it('should log activation response result', () => {
      const log = sandbox.stub(openwhiskInvoke, 'consoleLog');
      openwhiskInvoke.options.log = 'result'
      openwhiskInvoke.options.type = 'blocking'

      const result = {success: true, result: { hello: "world"} };
      return openwhiskInvoke.log({response: result}).then(() => {
        expect(log.calledOnce).to.be.equal(true);
        const msg = chalk.white(JSON.stringify(result.result, null, 4));
        console.log(msg)
        expect(log.args[0][0]).to.be.equal(msg);
      });
    });

    it('should log verbose activation response result', () => {
      const log = sandbox.stub(openwhiskInvoke, 'consoleLog');
      openwhiskInvoke.options.log = 'result'
      openwhiskInvoke.options.type = 'blocking'
      openwhiskInvoke.options.v = true

      const input = {
        activationId: 12345,
        name: 'blah',
        namespace: 'workspace',
        duration: 100,
        annotations: [ { key: "waitTime", value: 33 } ],
        response: { success: true, result: { hello: "world"} }
      };
      return openwhiskInvoke.log(input).then(() => {
        expect(log.calledTwice).to.be.equal(true);
        const msg = chalk.white(JSON.stringify(input.response.result, null, 4));

        const field = (name, label) => `${chalk.blue(name)} (${chalk.yellow(label)})`
        const time = (name, value, color = 'blue') => `${chalk[color](name)}: ${chalk.green(value + 'ms')}`
      const duration = (duration, init = 0, wait) => `${time('duration', duration)} (${time('init', init, 'magenta')}, ${time('wait', wait, 'magenta')})`

        const output = `${chalk.green('=>')} ${field('action', '/workspace/blah')} ${field('activation', 12345)} ${duration(100, undefined, 33)}`

        expect(log.args[0][0]).to.be.equal(output);
        expect(log.args[1][0]).to.be.equal(msg);
      });
    });

    it('should log verbose activation coldstart response result', () => {
      const log = sandbox.stub(openwhiskInvoke, 'consoleLog');
      openwhiskInvoke.options.log = 'result'
      openwhiskInvoke.options.type = 'blocking'
      openwhiskInvoke.options.v = true

      const input = {
        activationId: 12345,
        name: 'blah',
        namespace: 'workspace',
        duration: 100,
        annotations: [ 
          { key: "waitTime", value: 33 },
          { key: "initTime", value: 63 }
        ],
        response: { success: true, result: { hello: "world"} }
      };
      return openwhiskInvoke.log(input).then(() => {
        expect(log.calledTwice).to.be.equal(true);
        const msg = chalk.white(JSON.stringify(input.response.result, null, 4));

        const field = (name, label) => `${chalk.blue(name)} (${chalk.yellow(label)})`
        const time = (name, value, color = 'blue') => `${chalk[color](name)}: ${chalk.green(value + 'ms')}`
      const duration = (duration, init = 0, wait) => `${time('duration', duration)} (${time('init', init, 'magenta')}, ${time('wait', wait, 'magenta')})`

        const output = `${chalk.green('=>')} ${field('action', '/workspace/blah')} ${field('activation', 12345)} ${duration(100, 63, 33)}`

        expect(log.args[0][0]).to.be.equal(output);
        expect(log.args[1][0]).to.be.equal(msg);
      });
    });



  });
});
