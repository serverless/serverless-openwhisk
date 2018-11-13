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

  describe('#renameManifestPackages()', () => {
    it('should handle config without resource packages', () => {
      openwhiskCompilePackages.serverless.service.resources = null
      openwhiskCompilePackages.renameManifestPackages();
      openwhiskCompilePackages.serverless.service.resources = {}
      openwhiskCompilePackages.renameManifestPackages();
      openwhiskCompilePackages.serverless.service.resources.packages = {}
      openwhiskCompilePackages.renameManifestPackages();
    })

    it('should rename packages with explicit names', () => {
      openwhiskCompilePackages.serverless.service.resources.packages = {
        'first' : { name: 'firstchanged', parameters: { hello: 'world first' } },
        'second' : { parameters: { hello: 'world second' } }
      };

      const expected = {
        'firstchanged' : { name: 'firstchanged', parameters: { hello: 'world first' } },
        'second' : { parameters: { hello: 'world second' } }
      };

      openwhiskCompilePackages.renameManifestPackages();
      expect(openwhiskCompilePackages.serverless.service.resources.packages)
        .to.deep.equal(expected);

    })
  })

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

  describe('#calculatePackageName()', () => {
    it('should return package name from object key', () => {
      expect(openwhiskCompilePackages.calculatePackageName('a', { parameters: 'p' })).to.equal('a');
    })

    it('should return package name from name property', () => {
      expect(openwhiskCompilePackages.calculatePackageName('a', { name: 'b' })).to.equal('b');
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
      const pkge = { shared: true, overwrite: false, namespace: 'another_ns', annotations: { foo: 'bar' }, parameters: { hello: 'world' } };
      const expected = {
        name: 'sample',
        overwrite: false,
        namespace: 'another_ns',
        package: {
          publish: true,
          parameters: [{ key: 'hello', value: 'world' }],
          annotations: [{ key: 'foo', value: 'bar' }]
        },
      };
      openwhiskCompilePackages.serverless.service.resources.packages = { sample: pkge };
      return expect(openwhiskCompilePackages.compilePackages().then(() =>
        expect(openwhiskCompilePackages.serverless.service.packages)
          .to.deep.equal({ sample: expected })
      )).to.eventually.be.fulfilled;
    });

    it('should merge packages with explicit names', () => {
      openwhiskCompilePackages.serverless.service.resources.packages = {
        'first' : { name: 'firstchanged', parameters: { hello: 'world first' } },
        'second' : { parameters: { hello: 'world second' } }
      };

      sandbox.stub(openwhiskCompilePackages, 'getActionPackages', () => ['firstchanged', 'second', 'third']);

      const expected = {
        firstchanged: {
          name: 'firstchanged',
          overwrite: true,
          package: { parameters: [{ key: 'hello', value: 'world first' }] },
          namespace: 'testing'
        },
        second: {
          name: 'second',
          overwrite: true,
          package: { parameters: [{ key: 'hello', value: 'world second' }] },
          namespace: 'testing'
        },
        third: {
          name: 'third',
          overwrite: true,
          package: {},
          namespace: 'testing'
        }
      };

      // Simulate hooks
      openwhiskCompilePackages.setup();
      openwhiskCompilePackages.renameManifestPackages();
      openwhiskCompilePackages.mergeActionPackages();

      return expect(openwhiskCompilePackages.compilePackages().then(() => {
        expect(openwhiskCompilePackages.serverless.service.packages)
          .to.deep.equal(expected)
      })).to.eventually.be.fulfilled;
    });
  });
  describe('#compilePackage()', () => {
    it('should define packages without a body', () => {
      const testing = { name: 'testing', namespace: 'testing', overwrite: true, package: {} };
      const result = openwhiskCompilePackages.compilePackage('testing', {});
      return expect(result).to.deep.equal(testing);
    });

    it('should define packages with manifest params', () => {
      const params = { shared: true, overwrite: false, namespace: 'another_ns', annotations: { foo: 'bar' }, parameters: { hello: 'world' }, binding: '/whisk.system/utils' };
      const expected = {
        name: 'testing',
        overwrite: false,
        namespace: 'another_ns',
        package: { 
          publish: true,
          annotations: [{ key: 'foo', value: 'bar' }],
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

    it('should rename packages when name parameter is present', () => {
      const params = { name: 'customname', shared: true, overwrite: false, namespace: 'another_ns', parameters: { hello: 'world' } };
      const expected = {
        name: 'customname',
        overwrite: false,
        namespace: 'another_ns',
        package: {
          publish: true,
          parameters: [{ key: 'hello', value: 'world' }]
        },
      };
      const result = openwhiskCompilePackages.compilePackage('testing', params);
      return expect(result).to.deep.equal(expected);
    });
  });
});
