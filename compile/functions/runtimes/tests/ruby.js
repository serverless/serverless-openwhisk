'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Ruby = require('../ruby');
const JSZip = require('jszip');
const fs = require('fs-extra');

describe('Ruby', () => {
  let serverless;
  let ruby;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    ruby = new Ruby(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(ruby.match({runtime: 'ruby', handler: 'file.func'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'ruby';
      expect(ruby.match({handler: 'file.func'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(ruby.match({runtime: 'python', handler: 'file.func'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(ruby.match({handler: 'file.func'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(ruby.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return ruby exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', kind: 'ruby:default', code: new Buffer(fileContents) };
      sandbox.stub(ruby, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(ruby.exec({ handler, runtime: 'ruby'}))
        .to.eventually.deep.equal(exec);
    })

    it('should support using custom image', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';

      const exec = { main: 'some_func', image: 'blah', kind: 'blackbox', code: new Buffer(fileContents) };
      sandbox.stub(ruby, 'generateActionPackage', (functionObj) => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(ruby.exec({ handler, image: 'blah', runtime: 'ruby:7.1' }))
        .to.eventually.deep.equal(exec);
    })
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => ruby.generateActionPackage({handler: 'does_not_exist.main'}))
        .to.throw(Error, 'Function handler (does_not_exist.rb) does not exist.');
    })

    it('should read service artifact and add main.rb for handler', () => {
      ruby.serverless.service.package = {artifact: '/path/to/zip_file.zip'};
      ruby.isValidFile = () => true
      const zip = new JSZip();
      const source = 'def main(args)\nname = args["name"] || "stranger"\ngreeting = "Hello #{name}!"\n{ "greeting" => greeting }\nend'
      zip.file("handler.rb", source);

      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return ruby.generateActionPackage({handler: 'handler.main'}).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.rb")).to.be.equal(null)
            return zip.file("main.rb").async("string").then(main => {
              expect(main).to.be.equal(source)
            })
          })
        })
      });
    })

    it('should handle service artifact for individual function handler', () => {
      const functionObj = {handler: 'handler.main', package: { artifact: '/path/to/zip_file.zip'}}
      ruby.serverless.service.package = {individually: true};
      ruby.isValidFile = () => true

      const zip = new JSZip();
      const source = 'def main(args)\nname = args["name"] || "stranger"\ngreeting = "Hello #{name}!"\n{ "greeting" => greeting }\nend'
      zip.file("handler.rb", source);

      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          expect(path).to.equal('/path/to/zip_file.zip');
          cb(null, zipped);
        });
        return ruby.generateActionPackage(functionObj).then(data => {
          return JSZip.loadAsync(new Buffer(data, 'base64')).then(zip => {
            expect(zip.file("handler.rb")).to.be.equal(null)
            return zip.file("main.rb").async("string").then(main => {
              expect(main).to.be.equal(source)
            })
          })
        })
      });
    });
  })
});
