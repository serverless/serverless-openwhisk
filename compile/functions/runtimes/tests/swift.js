'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Swift = require('../swift');
const JSZip = require("jszip");
const fs = require('fs-extra');

describe('Swift', () => {
  let serverless;
  let node;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    node = new Swift(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({runtime: 'swift', handler: 'file.func'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'swift';
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
    it('should return swift exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'swift:default', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, runtime: 'swift'}))
        .to.eventually.deep.equal(exec);
    })

    it('should return swift exec definition with custom image', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'blackbox', image: 'foo', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, runtime: 'swift', image: 'foo' }))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => node.generateActionPackage({handler: 'does_not_exist.main'}))
        .to.throw(Error, 'Function handler (does_not_exist.swift) does not exist.');
    })

    it('should read service artifact and add package.json for handler', () => {
      node.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      node.isValidFile = () => true
      const source = 'func main(args: [String:Any]) -> [String:Any] {\nreturn ["hello": "world"]\n}' 
      const zip = new JSZip();
      zip.file("handler.swift", source);
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.swift")).to.be.equal(null)
            return zip.file("main.swift").async("string").then(code => {
              expect(code).to.be.equal(source)
            })
          })
        })
      });
    })

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', artifact: '/path/to/zip_file.zip'}
      node.serverless.service.package = {individually: true};
      node.isValidFile = () => true

      const zip = new JSZip();
      const source = 'func main(args: [String:Any]) -> [String:Any] {\nreturn ["hello": "world"]\n}' 
      zip.file("handler.swift", source);
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.swift")).to.be.equal(null)
            return zip.file("main.swift").async("string").then(code => {
              expect(code).to.be.equal(source)
            })
          })
        })
      });
    })
  })
});
