'use strict';

const BbPromise = require('bluebird');

class OpenWhiskCompilePackages {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:package:compileEvents': () => BbPromise.bind(this)
        .then(this.setup)
        .then(this.renameManifestPackages)
        .then(this.mergeActionPackages),
      'package:compileEvents': this.compilePackages.bind(this),
    };
  }

  setup() {
    // This object will be used to store the Packages resource, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.packages = {};
  }

  renameManifestPackages() {
    const resources = this.serverless.service.resources
    if (!resources || !resources.packages) return;

    const manifestPackages = resources.packages;

    Object.keys(manifestPackages).forEach(packageKey => {
      const pack = manifestPackages[packageKey];

      if (pack.name && pack.name !== packageKey) {
        // move the package under the new name
        manifestPackages[pack.name] = pack;
        delete manifestPackages[packageKey];
      }
    })
  }

  mergeActionPackages() {
    const actionPackages = this.getActionPackages();
    if (!actionPackages.length) return;

    if (!this.serverless.service.resources) {
      this.serverless.service.resources = {};
    }

    if (!this.serverless.service.resources.packages) {
      this.serverless.service.resources.packages = {};
    }

    const manifestPackages = this.serverless.service.resources.packages;

    actionPackages.forEach(pkge => {
      manifestPackages[pkge] = manifestPackages[pkge] || {}
    })
  }

  getActionPackages() {
    const actionPackages = new Set();

    this.serverless.service.getAllFunctions()
      .map(name => this.serverless.service.getFunction(name))
      .filter(func => func.name)
      .forEach(func => {
        const id = func.name.match(/^(.+)\/.+$/)
        if (id) actionPackages.add(id[1])
      });

    return [...actionPackages];
  }

  calculatePackageName(packageName, packageObject) {
    return packageObject.name || packageName;
  }

  compilePackage(name, params) {
    const effectiveName = this.calculatePackageName(name, params);
    const pkge = { name: effectiveName, overwrite: true, package: {} };

    pkge.namespace = params.namespace
      || this.serverless.service.provider.namespace;

    if (params.hasOwnProperty('overwrite')) {
      pkge.overwrite = params.overwrite;
    } else if (this.serverless.service.provider.hasOwnProperty('overwrite')) {
      pkge.overwrite = params.overwrite;
    }

    if (params.hasOwnProperty('shared')) {
      pkge.package.publish = params.shared;
    }

    if (params.parameters) {
      pkge.package.parameters = Object.keys(params.parameters).map(
        key => ({ key, value: params.parameters[key] })
      );
    }

    if (params.annotations) {
      pkge.package.annotations = Object.keys(params.annotations).map(
        key => ({ key, value: params.annotations[key] })
      );
    }

    if (params.binding) {
      // package identifier must be in format: /namespace/package
      const to_bind = params.binding.match(/^\/(.+)\/(.+)$/)
      if (!to_bind) {
        throw new this.serverless.classes.Error(`Invalid Package Binding (${params.binding}). Must be in form: /namespace/package`);
      }
      pkge.package.binding = { name: to_bind[2], namespace: to_bind[1] }
    }

    if (this.options.verbose) {
      this.serverless.cli.log(`Compiled Package (${name}): ${JSON.stringify(pkge)}`);
    }

    return pkge;
  }

  compilePackages() {
    this.serverless.cli.log('Compiling Packages...');

    const manifestResources = this.serverless.service.resources;
    const owPackages = this.serverless.service.packages;

    if (!owPackages) {
      throw new this.serverless.classes.Error(
        'Missing Packages section from OpenWhisk Resource Manager template');
    }

    if (manifestResources && manifestResources.packages) {
      Object.keys(manifestResources.packages).forEach(pkge => {
        owPackages[pkge] = this.compilePackage(pkge, manifestResources.packages[pkge]);
      });
    }

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskCompilePackages;
