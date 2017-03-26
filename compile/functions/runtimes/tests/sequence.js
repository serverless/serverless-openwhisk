'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Sequence = require('../sequence');

describe('Sequence', () => {
  let serverless;
  let sequence;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    sequence = new Sequence(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match function object with sequence property', () => {
      expect(sequence.match({sequence: true})).to.equal(true)
    });
    it('should ignore function object without sequence property', () => {
      expect(sequence.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return sequence definition for sequence function', () => {
      const exec = { kind: 'sequence', components: ["/_/one", "/a/two", "/a/b/three"] };

      sequence.serverless.service.getFunction = () => ({name: 'one'});
      sequence.serverless.service.provider.namespace = 'namespace';
      expect(sequence.exec({
        sequence: ["one", "/a/two", "/a/b/three"]
      })).to.deep.equal(exec);
    });
  });
});
