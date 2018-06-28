'use strict';

const BbPromise = require('bluebird');
const { spawn } = require('child_process');

module.exports = {
  configureServiceBinding(binding) {
    if (this.options.verbose) {
      this.serverless.cli.log(`Configuring Service Binding: ${JSON.stringify(binding)}`);
    }

    return new Promise((resolve, reject) => {
      const args = ['wsk', 'service', 'bind', binding.name, binding.action]

      if (binding.instance) {
        args.push("--instance", binding.instance)
      }

      if (binding.key) {
        args.push("--keyname", binding.key)
      }

      const bx = spawn('bx', args);

      const stdout = []
      const stderr = []

      bx.stdout.on('data', data => {
        stdout.push(data.toString())
      });

      bx.stderr.on('data', (data) => {
        stderr.push(data.toString())
      });

      bx.on('error', (err) => {
        if (err.code === 'ENOENT') {
          const err = new this.serverless.classes.Error(
            'Unable to execute `bx wsk service bind` command. Is IBM Cloud CLI installed?'
          )
          return reject(err)
        }
        reject(err.message)
      });

      bx.on('close', (code) => {
        if (code === 2) {
          const err = new this.serverless.classes.Error(
            'Unable to execute `bx wsk service bind` command. Is IBM Cloud Functions CLI plugin installed?'
          )
          return reject(err)
        }
        if (code > 0) {
          const errmsg = (stderr[0] || '').split('\n')[0]
          const err = new this.serverless.classes.Error(`Failed to configure service binding (${JSON.stringify(binding)})\n  ${errmsg}`);
          return reject(err)
        }
        if (this.options.verbose) {
          this.serverless.cli.log(`Configured Service Binding: ${JSON.stringify(binding)}`);
        }
        resolve()
      });
    });
  },

  configureServiceBindings() {
    const bindings = this.getServiceBindings();

    if (bindings.fns.length || bindings.packages.length) {
      this.serverless.cli.log('Configuring Service Bindings...');
    }

    return BbPromise.all(
      bindings.packages.map(sbs => BbPromise.mapSeries(sbs, sb => this.configureServiceBinding(sb)))
    ).then(() => BbPromise.all(
      bindings.fns.map(sbs => BbPromise.mapSeries(sbs, sb => this.configureServiceBinding(sb)))
    ));
  },

  getServiceBindings() {
    return this.serverless.service.bindings || { fns: [], packages: [] } ;
  }
};
