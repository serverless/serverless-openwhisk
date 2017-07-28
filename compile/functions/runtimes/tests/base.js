'use strict';

const expect = require('chai').expect;

const BaseRuntime = require('../base');

describe('Base', () => {
  const base = new BaseRuntime();
  base.extension = '.js';

  describe('#calculateFunctionMain()', () => {
    it('should extract the main function for a given file handler', () => {
      const functionObject = { handler: 'index.main' };
      const result = base.calculateFunctionMain(functionObject);
      expect(result).to.equal('main');
    });
    it('should return the input for a given file handler without exported function', () => {
      const functionObject = { handler: 'index' };
      const result = base.calculateFunctionMain(functionObject);
      expect(result).to.equal(functionObject);
    });
    it('should extract the main function for a given path handler', () => {
      const functionObject = { handler: 'myFunction@0.1.0/index.main' };
      const result = base.calculateFunctionMain(functionObject);
      expect(result).to.equal('main');
    });
    it('should extract the main function for a given relative path handler', () => {
      const functionObject = { handler: '../myFunction/index.main' };
      const result = base.calculateFunctionMain(functionObject);
      expect(result).to.equal('main');
    });
  });

  describe('#convertHandlerToPathInZip()', () => {
    it('should extract the path in zip for a given file handler', () => {
      const result = base.convertHandlerToPathInZip('index.main');
      expect(result).to.equal('index.js');
    });

    it('should return the input for a given file handler without exported function', () => {
      const result = base.convertHandlerToPathInZip('index');
      expect(result).to.equal('index');
    });

    it('should extract the path in zip for a given path handler', () => {
      const result = base.convertHandlerToPathInZip('myFunction@0.1.0/index.main');
      expect(result).to.equal('myFunction@0.1.0/index.js');
    });

    it('should extract the path in zip for a given relative path handler', () => {
      const result = base.convertHandlerToPathInZip('../myFunction@0.1.0/index.main');
      expect(result).to.equal('myFunction@0.1.0/index.js');
    });
  });

  describe('#convertHandlerToPath()', () => {
    it('should extract the path for a given file handler', () => {
      const result = base.convertHandlerToPath('index.main');
      expect(result).to.equal('index.js');
    });

    it('should return the input for a given file handler without exported function', () => {
      const result = base.convertHandlerToPath('index');
      expect(result).to.equal('index');
    });

    it('should extract the path for a given path handler', () => {
      const result = base.convertHandlerToPath('myFunction@0.1.0/index.main');
      expect(result).to.equal('myFunction@0.1.0/index.js');
    });

    it('should extract the path for a given relative path handler', () => {
      const result = base.convertHandlerToPath('../myFunction@0.1.0/index.main');
      expect(result).to.equal('../myFunction@0.1.0/index.js');
    });
  });
});
