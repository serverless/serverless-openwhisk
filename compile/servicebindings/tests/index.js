'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');

require('chai').use(chaiAsPromised);

const sinon = require('sinon');
const OpenWhiskCompileServiceBindings = require('../index');

describe('OpenWhiskCompileServiceBindings', () => {
  let serverless;
  let sandbox;
  let openwhiskCompileServiceBindings;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    serverless = {classes: {Error}, service: {provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sandbox.spy()};
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    openwhiskCompileServiceBindings = new OpenWhiskCompileServiceBindings(serverless, options);
    serverless.service.service = 'serviceName';
    serverless.service.provider = {
      namespace: 'testing',
      apihost: '',
      auth: '',
    };

    serverless.cli = { consoleLog: () => {}, log: () => {} };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#parseServiceBindings()', () => {
    it('should return empty array when missing service bindings', () => {
      const action = 'fnName'
      expect(openwhiskCompileServiceBindings.parseServiceBindings(action, {})).to.deep.equal([])
      expect(openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: []})).to.deep.equal([])
      expect(openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: [{}]})).to.deep.equal([])
      expect(openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: [{blah: {}}]})).to.deep.equal([])
    })

    it('should return array with single service binding property', () => {
      const action = 'fnName'
      const service = { name: 'my-service', instance: 'my-instance', key: 'mykey' }
      const response = { action: `fnName`, name: 'my-service', instance: 'my-instance', key: 'mykey' }
      const result = openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: [{ service }]})
      expect(result).to.deep.equal([response])
    })

    it('should return array with multiple service binding properties', () => {
      const action = 'fnName'
      const service_a = { action: `serviceName_fnName`, name: 'my-service-a', instance: 'my-instance-a', key: 'mykey' }
      const service_b = { action: `serviceName_fnName`, name: 'my-service-b', instance: 'my-instance-b', key: 'mykey' }
      const service_c = { action: `serviceName_fnName`, name: 'my-service-c', instance: 'my-instance-c', key: 'mykey' }
      const services = [{ service: service_a }, { service: service_b }, { service: service_c } ]
      const result = openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: services})
      expect(result).to.deep.equal([service_a, service_b, service_c])
    })
   
    it('should throw an error if service binding is missing name', () => {
      const service = { instance: 'my-instance-a', key: 'mykey' }
      const action = 'fnName'
      const services = [{ service }]
      expect(() => openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: services}))
        .to.throw(Error, /service binding missing name parameter/);
    });
 
    it('should throw an error if multiple bindings for same service name', () => {
      const action = 'fnName'
      const service = { name: 'my-service', instance: 'my-instance-a', key: 'mykey' }
      const services = [{ service }, { service }]
      expect(() => openwhiskCompileServiceBindings.parseServiceBindings(action, {bind: services}))
        .to.throw(Error, /multiple bindings for same service not supported/);
    });
  })

  describe('#compileServiceBindings()', () => {
    it('should return service bindings for simple functions', () => {
      const fns = {
        a: { bind: [{ service: { name: 'service-name-a' } }] },
        b: { bind: [{ service: { name: 'service-name-b', instance: 'instance-name' } }] },
        c: { bind: [{ service: { name: 'service-name-a' } }, { service: { name: 'service-name-b' } }] },
        d: { },
      }

      const service = openwhiskCompileServiceBindings.serverless.service
      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name]

      const services = [
        [{ action: 'serviceName_a', name: 'service-name-a' }],
        [{ action: 'serviceName_b', name: 'service-name-b', instance: 'instance-name' }],
        [{ action: 'serviceName_c', name: 'service-name-a' }, { action: 'serviceName_c', name: 'service-name-b' }]
      ]
      return openwhiskCompileServiceBindings.compileServiceBindings().then(result => {
        expect(service.bindings.fns).to.deep.equal(services)
        expect(service.bindings.packages).to.deep.equal([])
      })
    })

    it('should return service bindings for functions with explicit name', () => {
      const fns = {
        a: { name: 'some_name', bind: [{ service: { name: 'service-name-a' } }] }
      }

      const service = openwhiskCompileServiceBindings.serverless.service
      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name]

      const services = [ [{ action: 'some_name', name: 'service-name-a' }] ]
      return openwhiskCompileServiceBindings.compileServiceBindings().then(result => {
        expect(service.bindings.fns).to.deep.equal(services)
        expect(service.bindings.packages).to.deep.equal([])
      })
    })


    it('should return service bindings for packages', () => {
      const service = openwhiskCompileServiceBindings.serverless.service
      service.resources.packages = {
        a: { bind: [{ service: { name: 'service-name-a' } }] },
        b: { bind: [{ service: { name: 'service-name-b', instance: 'instance-name' } }] },
        c: { bind: [{ service: { name: 'service-name-a' } }, { service: { name: 'service-name-b' } }] },
        d: { },
      }

      const services = [
        [{ action: 'a', name: 'service-name-a' }],
        [{ action: 'b', name: 'service-name-b', instance: 'instance-name' }],
        [{ action: 'c', name: 'service-name-a' }, { action: 'c', name: 'service-name-b' }]
      ]

      return openwhiskCompileServiceBindings.compileServiceBindings().then(() => {
        expect(service.bindings.packages).to.deep.equal(services);
        expect(service.bindings.fns).to.deep.equal([]);
      });
    });

    it('should return service bindings for functions & packages', () => {
      const service = openwhiskCompileServiceBindings.serverless.service;
      service.resources.packages = {
        a: { bind: [{ service: { name: 'service-name-a' } }] }
      };

      const fns = {
        b: { bind: [{ service: { name: 'service-name-b', instance: 'instance-name' } }] },
      }

      service.getAllFunctions = () => Object.keys(fns)
      service.getFunction = name => fns[name]

      const services = {
        packages: [[{ action: 'a', name: 'service-name-a' }]],
        fns: [[{ action: 'serviceName_b', name: 'service-name-b', instance: 'instance-name' }]]
      }

      return openwhiskCompileServiceBindings.compileServiceBindings().then(() => {
        expect(service.bindings).to.deep.equal(services);
      });

    })
  })
});
