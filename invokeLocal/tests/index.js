'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const path = require('path');
const OpenWhiskInvokeLocal = require('../index');
const OpenWhiskProvider = require('../../provider/openwhiskProvider');
const BbPromise = require('bluebird');
const os = require('os');
const crypto = require('crypto');

const getTmpDirPath = () => path.join(os.tmpdir(),
  'tmpdirs-serverless', 'serverless', crypto.randomBytes(8).toString('hex'));

const getTmpFilePath = (fileName) => path.join(getTmpDirPath(), fileName);

describe('OpenWhiskInvokeLocal', () => {
  const CLI = function () { this.consoleLog = function () {};};
  const serverless = {
    config: () => {}, 
    utils: {},
    pluginManager: { getPlugins: () => []}, 
    classes: {Error, CLI}, 
    service: {
      environment: {},
      getFunction: () => {}, 
      provider: {}, 
      defaults: {namespace: ''}, 
      resources: {}, 
      getAllFunctions: () => []
    }
  };
  serverless.setProvider = () => {}
  const provider = new OpenWhiskProvider(serverless)
  serverless.getProvider = () => provider;

  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first',
  };
  const openwhiskInvokeLocal = new OpenWhiskInvokeLocal(serverless, options);

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskInvokeLocal.hooks).to.be.not.empty);

    it('should set the provider variable to an instance of OpenWhiskProvider', () =>
      expect(openwhiskInvokeLocal.provider).to.be.instanceof(OpenWhiskProvider));

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskInvokeLocal, 'validate').returns(BbPromise.resolve());
      const loadEnvVarsStub = sinon
        .stub(openwhiskInvokeLocal, 'loadEnvVars').returns(BbPromise.resolve());
      const invokeLocalStub = sinon
        .stub(openwhiskInvokeLocal, 'invokeLocal').returns(BbPromise.resolve());


      return openwhiskInvokeLocal.hooks['invoke:local:invoke']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
        expect(loadEnvVarsStub.calledAfter(validateStub)).to.be.equal(true);
        expect(invokeLocalStub.calledAfter(loadEnvVarsStub)).to.be.equal(true);

        openwhiskInvokeLocal.validate.restore();
        openwhiskInvokeLocal.loadEnvVars.restore();
        openwhiskInvokeLocal.invokeLocal.restore();
      });
    });

    it('should set an empty options object if no options are given', () => {
      const openwhiskInvokeWithEmptyOptions = new OpenWhiskInvokeLocal(serverless);

      expect(openwhiskInvokeWithEmptyOptions.options).to.deep.equal({});
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
      openwhiskInvokeLocal.options.data = null;
      openwhiskInvokeLocal.options.path = false;
    });

    it('should keep data if it is a simple string', () => {
      openwhiskInvokeLocal.options.data = 'simple-string';

      return openwhiskInvokeLocal.validate().then(() => {
        expect(openwhiskInvokeLocal.options.data).to.equal('simple-string');
      });
    });

    it('should parse data if it is a json string', () => {
      openwhiskInvokeLocal.options.data = '{"key": "value"}';

      return openwhiskInvokeLocal.validate().then(() => {
        expect(openwhiskInvokeLocal.options.data).to.deep.equal({ key: 'value' });
      });
    });

    it('it should parse file if relative file path is provided', () => {
      serverless.config.servicePath = getTmpDirPath();
      const data = {
        testProp: 'testValue',
      };
      serverless.utils.fileExistsSync = () => true;
      serverless.utils.readFileSync = path => data;
      openwhiskInvokeLocal.options.path = 'data.json';

      return openwhiskInvokeLocal.validate().then(() => {
        expect(openwhiskInvokeLocal.options.data).to.deep.equal(data);
      });
    });

    it('it should parse file if absolute file path is provided', () => {
      serverless.config.servicePath = getTmpDirPath();
      const data = {
        event: {
          testProp: 'testValue',
        },
      };
      serverless.utils.fileExistsSync = () => true;
      serverless.utils.readFileSync = path => data;
      const dataFile = path.join(serverless.config.servicePath, 'data.json');
      openwhiskInvokeLocal.options.path = dataFile;

      return openwhiskInvokeLocal.validate().then(() => {
        expect(openwhiskInvokeLocal.options.data).to.deep.equal(data);
      });
    });

    it('it should throw error if service path is not set', () => {
      serverless.config.servicePath = false;
      expect(() => openwhiskInvokeLocal.validate()).to.throw(Error);
    });

    it('it should reject error if file path does not exist', () => {
      serverless.config.servicePath = getTmpDirPath();
      openwhiskInvokeLocal.options.path = 'some/path';

      return openwhiskInvokeLocal.validate().catch((err) => {
        expect(err).to.be.instanceOf(Error);
      });
    });

    it('should resolve if path is not given', (done) => {
      openwhiskInvokeLocal.options.path = false;

      openwhiskInvokeLocal.validate().then(() => done());
    });
  });

  describe('#loadEnvVars()', () => {
    beforeEach(() => {
      serverless.config.servicePath = true;
      serverless.service.provider = {
        namespace: 'testing_ns',
        environment: {
          providerVar: 'providerValue',
        },
      };

      openwhiskInvokeLocal.options = {
        region: 'us-east-1',
        functionObj: {
          name: 'serviceName-dev-hello',
          environment: {
            functionVar: 'functionValue',
          },
        },
      };
      serverless.getProvider()._props = {apihost: 'endpoint', auth: 'user:pass'}
    });

    it('it should expected env vars', () => openwhiskInvokeLocal
      .loadEnvVars().then(() => {
        expect(process.env.__OW_API_KEY).to.equal('user:pass');
        expect(process.env.__OW_API_HOST).to.equal('endpoint');
        expect(process.env.__OW_ACTION_NAME).to.equal('/testing_ns/serviceName-dev-hello');
        expect(process.env.__OW_NAMESPACE).to.equal('testing_ns');
      })
    );
  });

  describe('#invokeLocal()', () => {
    let invokeLocalNodeJsStub;

    beforeEach(() => {
      invokeLocalNodeJsStub =
        sinon.stub(openwhiskInvokeLocal, 'invokeLocalNodeJs').returns(BbPromise.resolve());

      openwhiskInvokeLocal.serverless.service.service = 'new-service';
      openwhiskInvokeLocal.options = {
        stage: 'dev',
        function: 'first',
        functionObj: {
          handler: 'handler.hello',
          name: 'hello',
        },
        data: {},
      };
    });

    afterEach(() => {
      invokeLocalNodeJsStub.restore();
    });

    it('should call invokeLocalNodeJs when no runtime is set', () => openwhiskInvokeLocal.invokeLocal()
      .then(() => {
        expect(invokeLocalNodeJsStub.calledOnce).to.be.equal(true);
        expect(invokeLocalNodeJsStub.calledWithExactly(
          'handler',
          'hello',
          {}
        )).to.be.equal(true);
        openwhiskInvokeLocal.invokeLocalNodeJs.restore();
      })
    );

    it('throw error when using runtime other than Node.js', () => {
      openwhiskInvokeLocal.options.functionObj.runtime = 'python';
      expect(() => openwhiskInvokeLocal.invokeLocal()).to.throw(Error);
      delete openwhiskInvokeLocal.options.functionObj.runtime;
    });
  });

  describe('#invokeLocalNodeJs', () => {
    beforeEach(() => {
      openwhiskInvokeLocal.options = {
        functionObj: {
          name: '',
        },
      };

      serverless.cli = new CLI(serverless);
      sinon.stub(serverless.cli, 'consoleLog');
    });

    afterEach(() => {
      serverless.cli.consoleLog.restore();
    });

    it('should print message for non-promise return', () => {
      openwhiskInvokeLocal.serverless.config.servicePath = __dirname;
      return openwhiskInvokeLocal.invokeLocalNodeJs('fixture/handlerWithError', 'withObj').then(() => {
        expect(serverless.cli.consoleLog.lastCall.args[0]).to.contain('"message": "hello"');
      })
    });

    it('should print message for promise return', () => {
      openwhiskInvokeLocal.serverless.config.servicePath = __dirname;
      return openwhiskInvokeLocal.invokeLocalNodeJs('fixture/handlerWithError', 'withPromise').then(() => {
        expect(serverless.cli.consoleLog.lastCall.args[0]).to.contain('"message": "hello"');
      })
    });



    it('should exit with error exit code for thrown errors', () => {
      process.exitCode = -1
      openwhiskInvokeLocal.serverless.config.servicePath = __dirname;
      openwhiskInvokeLocal.invokeLocalNodeJs('fixture/handlerWithError', 'withError');

      expect(process.exitCode).to.be.equal(1);
      expect(serverless.cli.consoleLog.lastCall.args[0]).to.contain('"errorMessage": "failed"');
    });

    it('should exit with error exit code for rejected promises', () => {
      process.exitCode = -1
      openwhiskInvokeLocal.serverless.config.servicePath = __dirname;
      return openwhiskInvokeLocal.invokeLocalNodeJs('fixture/handlerWithError', 'withRejectedPromise').then(() => {
        expect(process.exitCode).to.be.equal(1);
        expect(serverless.cli.consoleLog.lastCall.args[0]).to.contain('errorMessage');
      }) 
    });
  });
});
