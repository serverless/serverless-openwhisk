'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Java = require('../java');
const JSZip = require('jszip');
const fs = require('fs-extra');

describe('Java', () => {
  let serverless;
  let java;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = { classes: { Error }, service: {}, getProvider: sandbox.spy() };
    serverless.service.provider = { name: 'openwhisk' };
    java = new Java(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(java.match({ runtime: 'java', handler: 'file.func' })).to.equal(true);
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'java';
      expect(java.match({ handler: 'file.func' })).to.equal(true);
    });

    it('should not match when wrong explicit runtime', () => {
      expect(java.match({ runtime: 'python', handler: 'file.func' })).to.equal(false);
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'python';
      expect(java.match({ handler: 'file.func' })).to.equal(false);
    });

    it('should not match when missing handler', () => {
      expect(java.match({})).to.equal(false);
    });
  });

  describe('#calculateFunctionMain()', () => {
    it('should return Main when no main class is defined', () => {
      expect(java.calculateFunctionMain({})).to.equal('Main');
    });
    it('should return the provided class when a main class is defined', () => {
      expect(
        java.calculateFunctionMain({ annotations: { main_class: 'my.main.class.Name' } })
      ).to.equal('my.main.class.Name');
    });
    it('should return Main when main class is empty', () => {
      expect(java.calculateFunctionMain({ annotations: { main_class: '' } })).to.equal('Main');
    });
  });

  describe('#exec()', () => {
    it('should return java exec definition', () => {
      const fileContents = 'some file contents';
      const handler = 'target/my-jar.jar';

      const exec = { main: 'Main', kind: 'java:default', code: new Buffer(fileContents) };
      sandbox.stub(java, 'generateActionPackage', functionObj => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(java.exec({ handler, runtime: 'java' })).to.eventually.deep.equal(exec);
    });

    it('should return java exec definition with custom image', () => {
      const fileContents = 'some file contents';
      const handler = 'target/my-jar.jar';

      const exec = {
        main: 'Main',
        kind: 'blackbox',
        image: 'foo',
        code: new Buffer(fileContents),
      };
      sandbox.stub(java, 'generateActionPackage', functionObj => {
        expect(functionObj.handler).to.equal(handler);
        return Promise.resolve(new Buffer(fileContents));
      });
      return expect(java.exec({ handler, runtime: 'java', image: 'foo' })).to.eventually.deep.equal(
        exec
      );
    });
  });

  describe('#convertHandlerToPath()', () => {
    it('should return file path passed in', () => {
      expect(java.convertHandlerToPath('target/my-jar.jar')).to.be.equal('target/my-jar.jar');
    });
  });

  describe('#generateActionPackage()', () => {
    it('should throw error for missing handler file', () => {
      expect(() => java.generateActionPackage({ handler: './does_not_exist/my-jar.jar' })).to.throw(
        Error,
        'Function handler (./does_not_exist/my-jar.jar) does not exist.'
      );
    });

    it('should create zip file with the Java jar file for the action', () => {
      java.serverless.service.package = { artifact: '/path/to/zip_file.zip' };
      java.isValidFile = () => true;
      const zip = new JSZip();
      const source = 'binary file contents';
      zip.file('target/my-jar.jar', source);
      return zip.generateAsync({ type: 'nodebuffer' }).then(zipped => {
        sandbox.stub(fs, 'readFile', (path, cb) => {
          cb(null, zipped);
        });
        return java.generateActionPackage({ handler: 'target/my-jar.jar' }).then(data =>
          JSZip.loadAsync(new Buffer(data, 'base64')).then(zip =>
            zip
              .file('target/my-jar.jar')
              .async('string')
              .then(contents => {
                expect(contents).to.be.equal(source);
              })
          )
        );
      });
    });
  });
});
