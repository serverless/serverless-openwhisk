'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Python = require('../python');
const JSZip = require("jszip");
const fs = require('fs-extra');

describe('Python', () => {
  let serverless;
  let node;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    node = new Python(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({runtime: 'python', handler: 'file.func'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(node.match({handler: 'file.func'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(node.match({runtime: 'nodejs', handler: 'file.func'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({handler: 'file.func'})).to.equal(false)
    });

    it('should not match default runtime', () => {
      expect(node.match({handler: 'file.func'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(node.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return python exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'python', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, runtime: 'python'}))
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
      return expect(node.exec({ handler, image: 'blah', runtime: 'python' }))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => node.generateActionPackage({handler: 'does_not_exist.main'}))
        .to.throw(Error, 'Function handler (does_not_exist.py) does not exist.');
    })

    it('should read service artifact and add __main__.py for handler', () => {
      node.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      node.isValidFile = () => true
      const zip = new JSZip();
      zip.file("handler.py", "def main(dict):\n\treturn {}");
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.py")).to.be.equal(null)
            return zip.file("__main__.py").async("string").then(package_json => {
              expect(package_json).to.be.equal('def main(dict):\n\treturn {}')
            })
          })
        })
      });
    })

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', package: { artifact: '/path/to/zip_file.zip'}}
      node.serverless.service.package = {individually: true};
      node.isValidFile = () => true

      const zip = new JSZip();
      zip.file("handler.py", "def main(dict):\n\treturn {}");
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.py")).to.be.equal(null)
            return zip.file("__main__.py").async("string").then(package_json => {
              expect(package_json).to.be.equal('def main(dict):\n\treturn {}')
            })
          })
        })
      });
    })
  })
});
