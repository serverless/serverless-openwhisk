'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const fs = require('fs-extra');
const chaiAsPromised = require('chai-as-promised');
const CliTokenManager = require('../cliTokenManager.js');

require('chai').use(chaiAsPromised);

describe('CliTokenManager', () => {
  describe('#getAuthHeader()', () => {
    it('should return bearer token from configuration', () => {
      const cliTokenManager = new CliTokenManager()
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJiMDhmODZhZi0zNWRhLTQ4ZjItOGZhYi1jZWYzOTA0NjYwYmQifQ.-xN_h82PHVTCMA9vdoHrcZxH-x5mb11y1537t3rGzcM'
      cliTokenManager.readTokenFromConfig = () => token
      cliTokenManager.isTokenExpired = () => false
      const header = `Bearer ${token}`
      return cliTokenManager.getAuthHeader().then(result => {
        expect(result).to.equal(header);
      })
    });

    it('should return refreshed bearer token when token is expired', () => {
      const cliTokenManager = new CliTokenManager()
      const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJiMDhmODZhZi0zNWRhLTQ4ZjItOGZhYi1jZWYzOTA0NjYwYmQifQ.-xN_h82PHVTCMA9vdoHrcZxH-x5mb11y1537t3rGzcM'
      cliTokenManager.readTokenFromConfig = () => null
      cliTokenManager.isTokenExpired = () => true 
      cliTokenManager.refreshToken = () => Promise.resolve(token)
      const header = `Bearer ${token}`
      return cliTokenManager.getAuthHeader().then(result => {
        expect(result).to.equal(header);
      })
    });
  })

  describe('#readTokenFromConfig()', () => {
    it('should return bearer token from default configuration file', () => {
      const readFile = (path, format) => {
        expect(path).to.equal(config_path)
        expect(format).to.equal('utf-8')
        return JSON.stringify({ IAMToken: `Bearer ${config_token}`}) 
      }

      const cliTokenManager = new CliTokenManager(null, readFile)
      const config_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJiMDhmODZhZi0zNWRhLTQ4ZjItOGZhYi1jZWYzOTA0NjYwYmQifQ.-xN_h82PHVTCMA9vdoHrcZxH-x5mb11y1537t3rGzcM'
      const config_path = `~/.bluemix/config.json`
      const token = cliTokenManager.readTokenFromConfig(config_path)
      expect(token).to.equal(config_token)
    });
  });

  describe('#isTokenExpired()', () => {
    it('should return true for expired JWT tokens', () => {
      const cliTokenManager = new CliTokenManager()
      // created from http://jwtbuilder.jamiekurtz.com/
      // JWT expired in 2000.
      const expired_token = 'eyJraWQiOiIyMDE5MDIwNCIsImFsZyI6IlJTMjU2In0.eyJpYW1faWQiOiJJQk1pZC0yNzAwMDJQUzIxIiwiaWQiOiJJQk1pZC0yNzAwMDJQUzIxIiwicmVhbG1pZCI6IklCTWlkIiwiaWRlbnRpZmllciI6IjI3MDAwMlBTMjEiLCJnaXZlbl9uYW1lIjoiSmFtZXMiLCJmYW1pbHlfbmFtZSI6IlRob21hcyIsIm5hbWUiOiJKYW1lcyBUaG9tYXMiLCJlbWFpbCI6ImphbWVzLnRob21hc0B1ay5pYm0uY29tIiwic3ViIjoiamFtZXMudGhvbWFzQHVrLmlibS5jb20iLCJhY2NvdW50Ijp7InZhbGlkIjp0cnVlLCJic3MiOiI4ZDYzZmIxY2M1ZTk5ZTg2ZGQ3MjI5ZGRkZmExNjY0OSJ9LCJpYXQiOjE1NjM0NDAyMzEsImV4cCI6MTU2MzQ0MzgzMSwiaXNzIjoiaHR0cHM6Ly9pYW0uY2xvdWQuaWJtLmNvbS9pZGVudGl0eSIsImdyYW50X3R5cGUiOiJwYXNzd29yZCIsInNjb3BlIjoiaWJtIG9wZW5pZCIsImNsaWVudF9pZCI6ImJ4IiwiYWNyIjoxLCJhbXIiOlsicHdkIl19.DhgBTV_dxtSirpSoe-H_xXfxBKYIrxFqiu4eVluTq78Sqp9FCCQoMSuJBD0ysHsD-0sIp5yHq03-0DnAdldnD2YkFRwrDXY-9uG5cJGB1vH3l6X6BaWprGG-AcswqeTklnjCrRqIiUr5EU9odZAfwbDPYdoE21gudS2kMZoVgezJsUtYz2tJH-I-1JfbBPuTLLuhWVr4ZPP2GzOvI7xpWBVwMYmUviLrxD_-Gq2vJyly1rNBYA4VZKf1G46yT790EqRz9N3o18bmKUxDCP6ur2oVHwGNQy15fn8LsiylHf4s9p9yPuLtgExN6FcdMfPU8hUT1UWfaWssjpetk3crjA'
      const expired = cliTokenManager.isTokenExpired(expired_token)
      expect(expired).to.equal(true)
    });
    
    it('should return false for non-expired JWT tokens', () => {
      const cliTokenManager = new CliTokenManager()
      // created from http://jwtbuilder.jamiekurtz.com/ - example JWT expires in 2100.
      // I won't be around when this unit test starts failing...
      const expired_token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE1NjM0NTM2OTYsImV4cCI6NDExOTUxMTI5NiwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSIsIkdpdmVuTmFtZSI6IkpvaG5ueSIsIlN1cm5hbWUiOiJSb2NrZXQiLCJFbWFpbCI6Impyb2NrZXRAZXhhbXBsZS5jb20iLCJSb2xlIjpbIk1hbmFnZXIiLCJQcm9qZWN0IEFkbWluaXN0cmF0b3IiXX0.WNqaMqKIqkKXT731uGV8jnJmNj74qYUSiZeLLYl6ME0'
      const expired = cliTokenManager.isTokenExpired(expired_token)
      expect(expired).to.equal(false)
    });
  });

  describe('#configFilePath()', () => {
    it('should return default config location', () => {
      const default_path = `${process.env['HOME']}/.bluemix/config.json`
      expect(CliTokenManager.configFilePath()).to.equal(default_path)
    });
  });

  describe('#refreshToken()', () => {
    it('should return current token once command has executed', () => {
      const cliTokenManager = new CliTokenManager()
      const token = 'eyj0exaioijkv1qilcjhbgcioijiuzi1nij9.eyj1c2vyswqioijimdhmodzhzi0znwrhltq4zjitogzhyi1jzwyzota0njywymqifq.-xn_h82phvtcma9vdohrczxh-x5mb11y1537t3rgzcm'
      cliTokenManager.readTokenFromConfig = () => token
      cliTokenManager.exec = (cmd, cb) => {
        expect(cmd).to.equal(cliTokenManager.refresh_command)
        setTimeout(() => cb(), 0)
      }
     
      return cliTokenManager.refreshToken().then(_token => {
        expect(_token).to.equal(token)
      })
    });

    it('should throw error when refresh token command fails', () => {
      const cliTokenManager = new CliTokenManager()
      cliTokenManager.exec = (_, cb) => {
        setTimeout(() => cb(new Error("cmd failed")), 0)
      }
     
      return expect(cliTokenManager.refreshToken()).to.eventually.be.rejectedWith(/^IAM token from IBM Cloud CLI/);
    });
  });
});
