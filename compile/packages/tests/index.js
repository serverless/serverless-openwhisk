'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompilePackages = require('../index');

describe('OpenWhiskCompilePackages', () => {
  let serverless;
  let sandbox;
  let openwhiskCompilePackages;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompilePackages = new OpenWhiskCompilePackages(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { consoleLog: () => {}, log: () => {} };
    openwhiskCompilePackages.setup();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#getActionPackages()', () => {
    it('should return no package names for functions without name property', () => {
      const service = openwhiskCompilePackages.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({})
      service.getFunction = handler;

      expect(openwhiskCompilePackages.getActionPackages()).to.deep.equal([])
    })

    it('should return no package names for functions with name missing package', () => {
      const service = openwhiskCompilePackages.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({name: "foo"})
      service.getFunction = handler;

      expect(openwhiskCompilePackages.getActionPackages()).to.deep.equal([])
    })

    it('should return package names for functions with name including package', () => {
      const service = openwhiskCompilePackages.serverless.service;
      service.getAllFunctions = () => ["first", "second", "third"];
      const handler = name => ({name: `${name}/${name}`})
      service.getFunction = handler;

      expect(openwhiskCompilePackages.getActionPackages()).to.deep.equal(["first", "second", "third"])

      service.getAllFunctions = () => ["first", "first", "first"];
      expect(openwhiskCompilePackages.getActionPackages()).to.deep.equal(["first"])
    })
  })

  describe('#mergeActionPackages()', () => {
    it('should set up packages from action names', () => {
      openwhiskCompilePackages.serverless.service.resources = {};

      const output = {first: {}, second: {}, third: {}};
      sandbox.stub(openwhiskCompilePackages, 'getActionPackages', () => ["first", "second", "third"]);
      openwhiskCompilePackages.mergeActionPackages();
      expect(openwhiskCompilePackages.serverless.service.resources.packages).to.deep.equal(output)
    });

    it('should ignore packages already defined in resources', () => {
      const packages = {first: 1, second: 2, third: 3};
      openwhiskCompilePackages.serverless.service.resources = { packages };

      sandbox.stub(openwhiskCompilePackages, 'getActionPackages', () => ["first", "second", "third"]);
      openwhiskCompilePackages.mergeActionPackages();
      expect(openwhiskCompilePackages.serverless.service.resources.packages).to.deep.equal(packages)
    })
  })

  describe('#compilePackages()', () => {
    it('should throw an error if the resource section is not available', () => {
      openwhiskCompilePackages.serverless.service.packages = null;
      expect(() => openwhiskCompilePackages.compilePackages())
        .to.throw(Error, /Missing Packages section/);
    });

    it('should return empty packages if manifest has no packages', () =>
      expect(openwhiskCompilePackages.compilePackages()).to.eventually.fulfilled
    );

    it('should call compilePackage for each package definition', () => {
      const packages = { a: {}, b: {}, c: {} };
      const stub = sinon.stub(openwhiskCompilePackages, 'compilePackage');
      openwhiskCompilePackages.serverless.service.resources.packages = packages;
      openwhiskCompilePackages.serverless.service.packages = {};
      return expect(openwhiskCompilePackages.compilePackages().then(() => {
        expect(stub.calledThrice).to.be.equal(true);
        Object.keys(packages).forEach(
          key => expect(stub.calledWith(key, packages[key])).to.be.equal(true)
        );
      })).to.eventually.be.fulfilled;
    });

    it('should update package definitions from manifest values', () => {
      const pkge = { overwrite: false, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        name: 'sample',
        overwrite: false,
        namespace: 'another_ns',
        package: { parameters: [{ key: 'hello', value: 'world' }] },
      };
      openwhiskCompilePackages.serverless.service.resources.packages = { sample: pkge };
      return expect(openwhiskCompilePackages.compilePackages().then(() =>
        expect(openwhiskCompilePackages.serverless.service.packages)
          .to.deep.equal({ sample: expected })
      )).to.eventually.be.fulfilled;
    });
  });
  describe('#compilePackage()', () => {
    it('should define packages without a body', () => {
      const testing = { name: 'testing', namespace: 'testing', overwrite: true, package: {} };
      const result = openwhiskCompilePackages.compilePackage('testing', {});
      return expect(result).to.deep.equal(testing);
    });

    it('should define packages with manifest params', () => {
      const params = { overwrite: false, namespace: 'another_ns', parameters: { hello: 'world' }, binding: '/whisk.system/utils' };
      const expected = {
        name: 'testing',
        overwrite: false,
        namespace: 'another_ns',
        package: { 
          parameters: [{ key: 'hello', value: 'world' }],
          binding: { namespace: 'whisk.system', name: 'utils' }
        },
      };
      const result = openwhiskCompilePackages.compilePackage('testing', params);
      return expect(result).to.deep.equal(expected);
    });

    it('should throw an error for invalid binding identifier', () => {
      const params = { binding: 'external_ns/external_package' };
      expect(() => openwhiskCompilePackages.compilePackage('testing', params))
        .to.throw(Error, /Invalid Package Binding/);
      params.binding = 'incorrect';
      expect(() => openwhiskCompilePackages.compilePackage('testing', params))
        .to.throw(Error, /Invalid Package Binding/);
    });

    it('should log packages to console when verbose flag is set', () => {
      openwhiskCompilePackages.options.verbose = true;
      const log = sandbox.stub(openwhiskCompilePackages.serverless.cli, 'log');
      sandbox.stub(openwhiskCompilePackages.serverless.cli, 'consoleLog');
      const params = {
        name: 'myPackage',
        overwrite: true,
        namespace: 'testing'
      };
      const result = openwhiskCompilePackages.compilePackage('myPackage', params);
      expect(log.calledOnce).to.be.equal(true);
      expect(log.args[0][0]).to.be.equal(`Compiled Package (myPackage): ${JSON.stringify(result)}`);
    });
  });
});
