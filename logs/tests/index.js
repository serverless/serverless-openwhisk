'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const OpenWhiskLogs = require('../');
const BbPromise = require('bluebird');
const chalk = require('chalk');
const moment = require('moment');

require('chai').use(chaiAsPromised);

describe('OpenWhiskLogs', () => {
  let sandbox;

     const CLI = function () { this.log = function () {};};
  const serverless = {config: () => {}, pluginManager: { getPlugins: () => []}, classes: {Error, CLI}, service: {getFunction: name => (serverless.service.functions[name]), provider: {}, resources: {}, getAllFunctions: () => []}, getProvider: sinon.spy()};
  const options = {
    stage: 'dev',
    region: 'us-east-1',
    function: 'first',
  };
  const openwhiskLogs = new OpenWhiskLogs(serverless, options);

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor()', () => {
    it('should have hooks', () => expect(openwhiskLogs.hooks).to.be.not.empty);

    it('should run promise chain in order', () => {
      const validateStub = sinon
        .stub(openwhiskLogs, 'validate').returns(BbPromise.resolve());
      const retrieveInvocationLogsStub = sinon
        .stub(openwhiskLogs, 'retrieveInvocationLogs').returns(BbPromise.resolve());
      const filterFunctionLogsStub = sinon
        .stub(openwhiskLogs, 'filterFunctionLogs').returns(BbPromise.resolve());
      const showFunctionLogsStub = sinon
        .stub(openwhiskLogs, 'showFunctionLogs').returns(BbPromise.resolve());

      return openwhiskLogs.hooks['logs:logs']().then(() => {
        expect(validateStub.calledOnce).to.be.equal(true);
        expect(retrieveInvocationLogsStub.calledAfter(validateStub)).to.be.equal(true);
        expect(filterFunctionLogsStub.calledAfter(retrieveInvocationLogsStub)).to.be.equal(true);
        expect(showFunctionLogsStub.calledAfter(filterFunctionLogsStub)).to.be.equal(true);

        openwhiskLogs.validate.restore();
        openwhiskLogs.retrieveInvocationLogs.restore();
        openwhiskLogs.filterFunctionLogs.restore();
        openwhiskLogs.showFunctionLogs.restore();
      });
    });
  });

  describe('#functionLogs', () => {
    let clock;
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };

      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      clock.restore();
    });

    it('should not tail logs unless option is set', () => {
      const retrieveInvocationLogsStub = sinon
        .stub(openwhiskLogs, 'retrieveInvocationLogs').returns(BbPromise.resolve([]));

      return openwhiskLogs.functionLogs().then(() => {
        expect(clock.timers).to.be.equal(undefined)
        openwhiskLogs.retrieveInvocationLogs.restore();
      });
    })

    it('should support tailing logs', () => {
      const retrieveInvocationLogsStub = sinon
        .stub(openwhiskLogs, 'retrieveInvocationLogs').returns(BbPromise.resolve([]));
      openwhiskLogs.options.tail = true
      openwhiskLogs.options.interval = 100

      return openwhiskLogs.functionLogs().then(() => {
        expect(clock.timers['1'].createdAt).to.be.equal(0)
        expect(clock.timers['1'].delay).to.be.equal(100)
        openwhiskLogs.retrieveInvocationLogs.restore();
      });
    })
  })

  describe('#retrieveLogs()', () => {
    let activationsStub, clock;
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };

      openwhiskLogs.client = { activations: { list: () => {} } };
      clock = sinon.useFakeTimers();
    });

    afterEach(() => {
      activationsStub.restore();
      clock.restore();
    });

    it('should invoke with correct params', () => {
      activationsStub = sinon.stub(openwhiskLogs.client.activations, 'list')
        .returns(BbPromise.resolve());
      return openwhiskLogs.retrieveInvocationLogs().then(() => {
        expect(activationsStub.calledOnce).to.be.equal(true);
        expect(activationsStub.args[0][0]).to.be.deep.equal({
          docs: true,
          limit: 100,
          namespace: '_'
        });
      });
    }
    );

    it('should reject when sdk client fails', () => {
      activationsStub = sinon.stub(openwhiskLogs.client.activations, 'list').returns(BbPromise.reject());
      return expect(openwhiskLogs.retrieveInvocationLogs()).to.be.eventually.rejected;
    });
  });

  describe('#filterFunctionLogs()', () => {
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };
    });

    it('should filter out different function logs', () => {
      const logs = [
        { name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first'} ] },
        { name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first'} ] },
        { name: "new-service_second", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_second'} ] },
        { name: "new-service_third", annotations: [ {key: "path", value: "user@host.com_dev/new-second_third"} ] },
        { name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first'} ] }
    ]
      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(3)
        logs.forEach(log => expect(log.name).to.be.equal('new-service_first'))
      })
    });

    it('should filter out different function logs with package function', () => {
      openwhiskLogs.serverless.service.functions.first.name = 'packagename/funcname'
      const logs = [
        { name: "funcname", annotations:[{ key:"path", value:"user@host.com_dev/packagename/funcname"} ]},
        { name: "funcname", annotations:[{ key:"path", value:"user@host.com_dev/packagename/funcname"} ]},
        { name: "new-service_second", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_second'} ] },
        { name: "new-service_third", annotations: [ {key: "path", value: "user@host.com_dev/new-second_third"} ] },
        { name: "funcname", annotations:[{ key:"path", value:"user@host.com_dev/packagename/funcname"} ]}
      ]

      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(3)
        logs.forEach(log => expect(log.name).to.be.equal('funcname'))
      })
    });


    it('should filter out logs lines based upon contents', () => {
      openwhiskLogs.options.startTime = moment('2001-01-01')
      const logs = [{name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }], logs: ["2001-01-02 matching line", "2001-01-01 another matching line", "2000-12-31 should not match"]}]
      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(1)
        expect(logs[0].logs).to.be.deep.equal(["2001-01-02 matching line"])
        delete openwhiskLogs.options.startTime
      })
    });

    it('should filter out logs lines based upon contents', () => {
      openwhiskLogs.options.filter = new RegExp('matching', 'i')
      const logs = [
        {name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }], logs: ["matching line", "another matching line", "should not match"]},
        {name: "new-service_first", annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }], logs: ["does not match"]}
      ]

      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(2)
        expect(logs[0].logs).to.be.deep.equal(["matching line", "another matching line"])
        expect(logs[1].logs).to.be.deep.equal([])
        delete openwhiskLogs.options.filter
      })
    });

    it('should filter already seen log messages', () => {
      openwhiskLogs.previous_activations = new Set([1, 2, 3, 4, 5])
      const logs = [
        {activationId: 1, annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }], name: "new-service_first"},
        {activationId: 5, annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }],  name: "new-service_first"},
        {activationId: 6, annotations: [ {key: "path", value: 'user@host.com_dev/new-service_first' }],  name: "new-service_first"}
      ]

      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(1)
        expect(logs[0].name).to.be.equal('new-service_first')
        expect(logs[0].activationId).to.be.equal(6)
      })
    });
  });

  describe('#showFunctionLogs()', () => {
    let logStub
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };
    });

    afterEach(() => {
      logStub.restore();
    })

    it('should return no logs message for zero activations', () => {
      logStub = sinon.stub(openwhiskLogs, 'consoleLog')

      return openwhiskLogs.showFunctionLogs([]).then(() => {
        expect(logStub.calledOnce).to.be.equal(true);
        expect(logStub.args[0][0]).to.be.deep.equal(`There's no log data for function "first" available right now…`);
      });
    });

    it('should return log messages for activations', () => {
      logStub = sinon.stub(openwhiskLogs, 'consoleLog')
      openwhiskLogs.previous_activations = new Set()
      const activation = { activationId: 12345, logs: [
        "2016-11-21T11:08:05.980285407Z stdout: this is the message",
        "2016-11-21T11:08:05.980285407Z stderr: this is an error"
      ]}

      return openwhiskLogs.showFunctionLogs([activation]).then(() => {
        expect(logStub.calledThrice).to.be.equal(true);
        expect(logStub.args[0][0]).to.be.deep.equal(`${chalk.blue('activation')} (${chalk.yellow(12345)}):`);
        expect(logStub.args[1][0]).to.be.deep.equal(`${chalk.green('2016-11-21 11:08:05.980')} this is the message`);
        expect(logStub.args[2][0]).to.be.deep.equal(`${chalk.green('2016-11-21 11:08:05.980')} ${chalk.red('this is an error')}`);
        expect(openwhiskLogs.previous_activations.size).to.be.equal(1)
        expect(openwhiskLogs.previous_activations.has(12345)).to.be.equal(true)
      });
    });
  });
});
