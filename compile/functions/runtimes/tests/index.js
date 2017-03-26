'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Runtimes = require('../index');

describe('Runtimes', () => {
  let serverless;
  let runtimes;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    runtimes = new Runtimes(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#exec()', () => {
    it('should throw error for unknown runtime', () => {
      expect(() => runtimes.exec({}))
        .to.throw(Error, /This runtime is not currently supported/);
    });

    it('should execute and return thenable exec for thenable matching runtime', () => {
      const result = { foo: 'bar' }
      const match = sinon.stub().returns(true)
      const exec = sinon.stub().returns(Promise.resolve(result))
      runtimes.runtimes = [{ match, exec }]

      return runtimes.exec({}).then(resp => {
        expect(resp).to.deep.equal(result)
        expect(match.called).to.equal(true)
        expect(exec.called).to.equal(true)
      })
    });

    it('should execute and return thenable exec for non-thenable matching runtime', () => {
      const result = { foo: 'bar' }
      const match = sinon.stub().returns(true)
      const exec = sinon.stub().returns(result)
      runtimes.runtimes = [{ match, exec }]

      return runtimes.exec({}).then(resp => {
        expect(resp).to.deep.equal(result)
        expect(match.called).to.equal(true)
        expect(exec.called).to.equal(true)
      })
    });
  });
});
