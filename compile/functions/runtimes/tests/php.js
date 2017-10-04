'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Php = require('../php');
const JSZip = require("jszip");
const fs = require('fs-extra');

describe('Php', () => {
  let serverless;
  let php;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    php = new Php(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(php.match({runtime: 'php', handler: 'file.func'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'php';
      expect(php.match({handler: 'file.func'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(php.match({runtime: 'python', handler: 'file.func'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(php.match({handler: 'file.func'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(php.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return php exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'php:default', code: new Buffer(fileContents) };
      sandbox.stub(php, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(php.exec({ handler, runtime: 'php'}))
        .to.eventually.deep.equal(exec);
    })

    it('should support using custom image', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', image: 'blah', kind: 'blackbox', code: new Buffer(fileContents) };
      sandbox.stub(php, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(php.exec({ handler, image: 'blah', runtime: 'php:7.1' }))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => php.generateActionPackage({handler: 'does_not_exist.main'}))
        .to.throw(Error, 'Function handler (does_not_exist.php) does not exist.');
    })

    it('should read service artifact and add index.php for handler', () => {
      php.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      php.isValidFile = () => true
      const zip = new JSZip();
      const source = '<?php\nfunction main(array $args) : array\n{\nreturn [];\n}'
      zip.file("handler.php", source);

      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return php.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.php")).to.be.equal(null)
            return zip.file("index.php").async("string").then(main => {
              expect(main).to.be.equal(source)
            })
          })
        })
      });
    })

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', package: { artifact: '/path/to/zip_file.zip'}}
      php.serverless.service.package = {individually: true};
      php.isValidFile = () => true

      const zip = new JSZip();
      const source = '<?php\nfunction main(array $args) : array\n{\nreturn [];\n}'
      zip.file("handler.php", source);

      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return php.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.php")).to.be.equal(null)
            return zip.file("index.php").async("string").then(main => {
              expect(main).to.be.equal(source)
            })
          })
        })
      });
    });
  })
});
