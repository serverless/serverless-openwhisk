'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Binary = require('../binary');
const JSZip = require("jszip");
const fs = require('fs-extra');

describe('Binary', () => {
  let serverless;
  let node;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    node = new Binary(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({runtime: 'binary', handler: 'bin_file'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'binary';
      expect(node.match({handler: 'bin_file'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(node.match({runtime: 'nodejs', handler: 'bin_file'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(node.match({handler: 'bin_file'})).to.equal(false)
    });

    it('should not match default runtime', () => {
      expect(node.match({handler: 'bin_file'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(node.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return binary exec definition', () => {
      const fileContents = 'zip file contents';
      const handler = 'bin_file';

      const exec = { image: 'openwhisk/dockerskeleton', kind: 'blackbox', code: new Buffer(fileContents) };
      sandbox.stub(node, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(node.exec({ handler, runtime: 'binary'}))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => node.generateActionPackage({handler: 'does_not_exist'}))
        .to.throw(Error, 'Function handler (does_not_exist) does not exist.');
    })

    it('should read service artifact and add package.json for handler', () => {
      node.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      node.isValidFile = () => true
      const zip = new JSZip();
      zip.file("handler", "blah blah blah");
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage({handler: 'handler'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler")).to.be.equal(null)
            return zip.file("exec").async("string").then(code => {
              expect(code).to.be.equal('blah blah blah')
            })
          })
        })
      });
    })

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler', package: { artifact: '/path/to/zip_file.zip'}}
      node.serverless.service.package = {individually: true};
      node.isValidFile = () => true

      const zip = new JSZip();
      zip.file("handler", "blah blah blah");
      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return node.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler")).to.be.equal(null)
            return zip.file("exec").async("string").then(code => {
              expect(code).to.be.equal('blah blah blah')
            })
          })
        })
      });
    })
  })
});
