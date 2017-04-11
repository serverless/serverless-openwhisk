'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const Docker = require('../docker');

describe('Docker', () => {
  let serverless;
  let docker;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {}, getProvider: sandbox.spy()};
    serverless.service.provider = { name: 'openwhisk' };
    docker = new Docker(serverless);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#match()', () => {
    it('should match with explicit runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(docker.match({runtime: 'docker', handler: 'repo/image'})).to.equal(true)
    });

    it('should match with provider runtime', () => {
      serverless.service.provider.runtime = 'docker';
      expect(docker.match({handler: 'repo/image'})).to.equal(true)
    });

    it('should not match when wrong explicit runtime', () => {
      expect(docker.match({runtime: 'nodejs', handler: 'repo/image'})).to.equal(false)
    });

    it('should not match when wrong provider runtime', () => {
      serverless.service.provider.runtime = 'nodejs';
      expect(docker.match({handler: 'repo/image'})).to.equal(false)
    });

    it('should not match default runtime', () => {
      expect(docker.match({handler: 'repo/image'})).to.equal(false)
    });

    it('should not match when missing handler', () => {
      expect(docker.match({})).to.equal(false)
    });
  });

  describe('#exec()', () => {
    it('should return docker definition for docker image handler', () => {
      const handler = 'repo/image'
      const exec = { kind: 'blackbox', image: 'repo/image' };

      expect(docker.exec({ runtime: 'docker', handler })).to.deep.equal(exec);
    });
  });
});
