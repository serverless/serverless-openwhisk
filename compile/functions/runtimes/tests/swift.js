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
    it('should return swift exec with source file handler', () => {
      const fileContents = 'some file contents';
      const handler = 'handler.some_func';
      node.isValidFile = () => true
      sandbox.stub(fs, 'readFileSync', (path) => {
        expect(path).to.equal('handler.swift');
        return Buffer.from(fileContents)
      });

      const exec = { main: 'some_func', binary: false, kind: 'swift:default', code: fileContents };
      return expect(node.exec({ handler, runtime: 'swift'}))
        .to.eventually.deep.equal(exec);
    })

    it('should return swift exec with zip file handler', () => {
      const handler = 'my_file.zip';
      node.isValidFile = () => true

      const zip = new JSZip();
      const source = 'binary file contents' 
      zip.file("exec", source);

      return zip.generateAsync({type:"nodebuffer"}).then(zipped => {
        sandbox.stub(fs, 'readFileSync', (path) => {
          expect(path).to.equal(handler);
          return zipped
        });

      const b64 = zipped.toString('base64')
      const exec = { main: 'main', binary: true, kind: 'swift:default', code: b64 };
      return expect(node.exec({ handler, runtime: 'swift'}))
        .to.eventually.deep.equal(exec);
      })
    })
  });

  describe('#convertHandlerToPath()', () => {
    it('should return file path for swift function handlers', () => {
      expect(node.convertHandlerToPath('file.func')).to.be.equal('file.swift')
    })

    it('should return file path for zip files', () => {
      expect(node.convertHandlerToPath('my_file.zip')).to.be.equal('my_file.zip')
    })
  })
});
