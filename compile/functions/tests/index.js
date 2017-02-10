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

  it('should return Promise that resolves with file contents', () => {
    const contents = 'some file contents';
    sandbox.stub(fs, 'readFile', (path, encoding, cb) => {
      expect(path).to.equal('handler.js');
      expect(encoding).to.equal('utf8');
      cb(null, contents);
    });
    return expect(openwhiskCompileFunctions.readFunctionSource('handler.function'))
      .to.eventually.equal(contents);
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


  describe('#generateActionPackage()', () => {
    it('should read service artifact and add package.json for handler', () => {
      openwhiskCompileFunctions.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      const zip = new JSZip();
      zip.file("handler.js", "function main() { return {}; }");
      zip.file("package.json", '{"main": "index.js"}')
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return openwhiskCompileFunctions.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            return zip.file("package.json").async("string").then(package_json => {
              expect(package_json).to.be.equal('{"main":"handler.js"}')
            })
          })
        })
      });
    })
  
    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', artifact: '/path/to/zip_file.zip'}
      openwhiskCompileFunctions.serverless.service.package = {individually: true};

      const zip = new JSZip();
      zip.file("handler.js", "function main() { return {}; }");
      zip.file("package.json", '{"main": "index.js"}')
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return openwhiskCompileFunctions.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            return zip.file("package.json").async("string").then(package_json => {
              expect(package_json).to.be.equal('{"main":"handler.js"}')
            })
          })
        })
      });
    })
  })

  describe('#compileFunction()', () => {
    it('should return sequence definition for sequence function', () => {
      const newFunction = {
        actionName: 'serviceName_functionName',
        namespace: 'namespace',
        overwrite: true,
        action: {
          exec: { kind: 'sequence', components: ["/_/one", "/a/two", "/a/b/three"] },
          limits: { timeout: 60 * 1000, memory: 256 },
          parameters: [],
          annotations: []
        },
      };
     
      openwhiskCompileFunctions.serverless.service.getFunction = () => ({name: 'one'});
      openwhiskCompileFunctions.serverless.service.provider.namespace = 'namespace';
      return expect(openwhiskCompileFunctions.compileFunction('functionName', {
        sequence: ["one", "/a/two", "/a/b/three"]
      })).to.eventually.deep.equal(newFunction);
    });

    it('should return default function instance for handler', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const newFunction = {
        actionName: 'serviceName_functionName',
        namespace: 'namespace',
        overwrite: true,
        action: {
          exec: { main: 'some_func', kind: 'nodejs:default', code: new Buffer(fileContents) },
          limits: { timeout: 60 * 1000, memory: 256 },
          parameters: [],
          annotations: []
        },
      };
      sandbox.stub(openwhiskCompileFunctions, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      openwhiskCompileFunctions.serverless.service.provider.namespace = 'namespace';
      return expect(openwhiskCompileFunctions.compileFunction('functionName', {
        handler,
      })).to.eventually.deep.equal(newFunction);
    });

    it('should allow manifest parameters to override defaults', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_function';
      const name = 'serviceName_functionName';
      const namespace = 'testing_namespace';
      const mem = 100;
      const timeout = 10;
      const runtime = 'runtime';
      const overwrite = false;
      const parameters = {
        foo: 'bar',
      };
      const annotations = {
        foo: 'bar',
      };

      const newFunction = {
        actionName: name,
        namespace: 'testing_namespace',
        overwrite: false,
        action: {
          exec: { main: 'some_function', kind: runtime, code: new Buffer(fileContents) },
          limits: { timeout: timeout * 1000, memory: mem },
          parameters: [
            { key: 'foo', value: 'bar' },
          ],
          annotations: [
            { key: 'foo', value: 'bar'},
          ]
        },
      };
      sandbox.stub(openwhiskCompileFunctions, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      openwhiskCompileFunctions.serverless.service.provider.namespace = 'namespace';
      return expect(
        openwhiskCompileFunctions.compileFunction('functionName', {
          actionName: name,
          namespace,
          timeout,
          memory: mem,
          overwrite,
          runtime,
          handler,
          parameters,
          annotations
        })).to.eventually.deep.equal(newFunction);
    });

    it('should allow provider default parameters to override defaults', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_function';
      const name = 'serviceName_functionName';
      const namespace = 'testing_namespace';
      const mem = 100;
      const timeout = 10;
      const runtime = 'runtime';
      const overwrite = false;

      const newFunction = {
        actionName: name,
        namespace: 'testing_namespace',
        overwrite: false,
        action: {
          exec: { main: 'some_function', kind: runtime, code: new Buffer(fileContents) },
          limits: { timeout: timeout * 1000, memory: mem },
          parameters: [],
          annotations: []
        },
      };
      sandbox.stub(openwhiskCompileFunctions, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });

      openwhiskCompileFunctions.serverless.service.provider = {
        memory: mem, timeout, overwrite, namespace: 'namespace', runtime,
      };
      return expect(
        openwhiskCompileFunctions.compileFunction('functionName', {
          actionName: name,
          namespace,
          handler,
        })).to.eventually.deep.equal(newFunction);
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
