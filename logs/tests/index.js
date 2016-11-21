'use strict';

const expect = require('chai').expect;
const chaiAsPromised = require('chai-as-promised');
const sinon = require('sinon');
const path = require('path');
const os = require('os');
const OpenWhiskLogs = require('../');
const Serverless = require('serverless');
const BbPromise = require('bluebird');

require('chai').use(chaiAsPromised);

describe('OpenWhiskLogs', () => {
  let sandbox;

  const serverless = new Serverless();
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

  describe('#retrieveLogs()', () => {
    let activationsStub;
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          namespace: 'sample',
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };

      openwhiskLogs.client = { activations: { list: () => {} } };
    });

    afterEach(() => {
      activationsStub.restore();
    });

    it('should invoke with correct params', () => {
      activationsStub = sinon.stub(openwhiskLogs.client.activations, 'list')
        .returns(BbPromise.resolve());
      return openwhiskLogs.retrieveInvocationLogs().then(() => {
        expect(activationsStub.calledOnce).to.be.equal(true);
        expect(activationsStub.args[0][0]).to.be.deep.equal({
          docs: true,
          limit: 100,
          namespace: 'sample'
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
          namespace: 'sample',
          handler: true,
        },
      };

      openwhiskLogs.serverless.service.service = 'new-service';
      openwhiskLogs.options = {
        function: 'first'
      };
    });

    it('should filter out different function logs', () => {
      const logs = [{name: "new-service_first"}, {name: "new-service_first"}, {name: "new-service_second"}, {name: "new-service_third"}, {name: "new-service_first"}]
      return openwhiskLogs.filterFunctionLogs(logs).then(logs => {
        expect(logs.length).to.be.equal(3)
        logs.forEach(log => expect(log.name).to.be.equal('new-service_first'))
      })
    });
  });

  describe('#showFunctionLogs()', () => {
    let logStub
    beforeEach(() => {
      openwhiskLogs.serverless.service.functions = {
        first: {
          namespace: 'sample',
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

    it('should return no logs message for zero activations', () => {
      logStub = sinon.stub(openwhiskLogs, 'consoleLog')
      const activation = { activationId: 12345, logs: [
        "2016-11-21T11:08:05.980285407Z stdout: this is the message",
        "2016-11-21T11:08:05.980285407Z stderr: this is an error"
      ]}

      return openwhiskLogs.showFunctionLogs([activation]).then(() => {
        expect(logStub.calledTwice).to.be.equal(true);
        expect(logStub.args[0][0]).to.be.deep.equal('12345 2016-11-21T11:08:05.980285407Z this is the message');
        expect(logStub.args[1][0]).to.be.deep.equal('12345 2016-11-21T11:08:05.980285407Z this is an error');
      });
    });
  });
});
