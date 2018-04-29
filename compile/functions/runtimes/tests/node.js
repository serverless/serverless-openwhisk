'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Node = require('../node');
const BaseRuntime = require('../base');
const JSZip = require("jszip");
const fs = require('fs-extra');

describe('Node', () => {
  let serverless;
  let node;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    node = new Node(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(node.match({runtime: 'nodejs', handler: 'file.func'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({handler: 'file.func'})).to.equal(true)
    });

    it('should match with default runtime', () => {
      expect(node.match({handler: 'file.func'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(node.match({runtime: 'python', handler: 'file.func'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(node.match({handler: 'file.func'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(node.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return default nodejs exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'nodejs:default', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler }))
        .to.eventually.deep.equal(exec);
    })

    it('should return custom nodejs exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'nodejs:6', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, runtime: 'nodejs:6' }))
        .to.eventually.deep.equal(exec);
    })

    it('should support using custom image', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', image: 'blah', kind: 'blackbox', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, image: 'blah', runtime: 'nodejs:6' }))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#isValidTypeScriptFile()', () => {
    it('should report valid file path when a js path is passed that has a ts file instead', () => {
      //We need to mock the node's `super` call, which is why we're using BaseRuntime
      sandbox.stub(BaseRuntime.prototype, 'isValidFile', (path) => {
        expect(path).to.equal('valid_typescript_handler_wrong_extension.ts');
        return true;
      });
      expect(node.isValidTypeScriptFile('valid_typescript_handler_wrong_extension.js')).to.equal(true)
    });
  });

  describe('#isValidFile()', () => {
    it('should still allow a js file to be used for handler', () => {
      //We need to mock the node's `super` call, which is why we're using BaseRuntime
      sandbox.stub(BaseRuntime.prototype, 'isValidFile', (path) => {
        expect(path).to.equal('valid_js_handler.js');
        return true;
      });
      expect(node.isValidFile('valid_js_handler.js')).to.equal(true)
    });
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => node.generateActionPackage({handler: 'does_not_exist.main'}))
        .to.throw(Error, 'Function handler (does_not_exist.js) does not exist.');
    })

    it('should read service artifact and add package.json for handler', () => {
      node.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      node.isValidFile = () => true
      const zip = new JSZip();
      zip.file("handler.js", "function main() { return {}; }");
      zip.file("package.json", '{"main": "index.js"}')
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            return zip.file("package.json").async("string").then(package_json => {
              expect(package_json).to.be.equal('{"main":"handler.js"}')
            })
          })
        })
      });
    })

    it('should read service artifact and add package.json for relative path handler', () => {
      node.serverless.service.package = { artifact: '/path/to/zip_file.zip' };
      node.isValidFile = () => true;
      const zip = new JSZip();
      zip.file('folder/handler.js', 'function main() { return {}; }');
      zip.file('folder/package.json', '{"main": "index.js"}');
      return zip.generateAsync({ type: 'nodebuffer' }).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage({ handler: '../folder/handler.main' }).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(actionPackage => {
            return actionPackage.file('package.json').async('string').then(packageJson => {
              expect(packageJson).to.be.equal('{"main":"folder/handler.js"}');
            });
          });
        });
      });
    });

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', package: { artifact: '/path/to/zip_file.zip'}}
      node.serverless.service.package = {individually: true};
      node.isValidFile = () => true

      const zip = new JSZip();
      zip.file("handler.js", "function main() { return {}; }");
      zip.file("package.json", '{"main": "index.js"}')
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            return zip.file("package.json").async("string").then(package_json => {
              expect(package_json).to.be.equal('{"main":"handler.js"}')
            })
          })
        })
      });
    })
  })
});
