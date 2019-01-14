'use strict';

const BbPromise = require('bluebird');
const chalk = require('chalk');

class OpenWhiskInfo {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'info:info': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.info),
      'after:deploy:deploy': () => BbPromise.bind(this)
        .then(() => {
          if (this.options.noDeploy) {
            return BbPromise.resolve();
          }
          this.consoleLog('');
          this.failsafe = true;
          return BbPromise.bind(this)
            .then(this.validate)
            .then(this.info)
        })
    };
  }

  validate() {
    if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    return this.provider.props().then(props => {
      this.props = props;
      return this.provider.client();
    }).then(client => {
      this.client = client;
    })
  }

  info () {
    this.consoleLog(`${chalk.yellow.underline('Service Information')}`);

    return BbPromise.bind(this)
      .then(this.showServiceInfo)
      .then(this.showPackagesInfo)
      .then(this.showActionsInfo)
      .then(this.showTriggersInfo)
      .then(this.showRulesInfo)
      .then(this.showRoutesInfo)
      .then(this.showWebActionsInfo);
  }

  showServiceInfo () {
    this.consoleLog(`platform:\t${this.props.apihost}`);
    this.consoleLog(`namespace:\t${this.props.namespace || '_'}`);
    this.consoleLog(`service:\t${this.serverless.service.service}\n`);
  }

  showActionsInfo () {
    this.consoleLog(`${chalk.yellow('actions:')}`);
    return this.client.actions.list().then(actions => {
      this._actions = actions;
      if (!actions.length) return console.log('**no actions deployed**\n');
      const names = actions.map(action => {
        const pkge = action.namespace.match(/\/(.+)/)
        if (!pkge) return action.name
        return `${pkge[1]}/${action.name}`
      }).join('    ');
      this.consoleLog(names + '\n')
    })
  }

  showWebActionsInfo () {
    this.consoleLog(`${chalk.yellow('endpoints (web actions):')}`);
    const web_actions = this._actions.filter(action => {
      const annotations = action.annotations || []
      return annotations.some(a => a.key === 'web-export' && a.value === true)
    })
    if (!web_actions.length) {
      this.consoleLog('**no web actions deployed**\n');
      return Promise.resolve();
    }

    const extractNsAndPkge = id => {
      let [ns, pkge] = id.split('/')
      pkge = pkge || 'default'
      return  { ns, pkge }
    }

    return this.provider.props().then(props => {
      web_actions.forEach(action => {
        const nsPkge = extractNsAndPkge(action.namespace)
        this.consoleLog(`https://${props.apihost}/api/v1/web/${nsPkge.ns}/${nsPkge.pkge}/${action.name}`)
      })
    })
  }

  showResourcesInfo (resource) {
    this.consoleLog(`${chalk.yellow(`${resource}:`)}`);
    return this.client[resource].list().then(resources => {
      if (!resources.length) return console.log(`**no ${resource} deployed**\n`);
      const names = resources.map(r => r.name).join('    ');
      this.consoleLog(names + '\n')
    })
  }

  showPackagesInfo () {
    return this.showResourcesInfo('packages')
  }

  showTriggersInfo () {
    return this.showResourcesInfo('triggers')
  }

  showRulesInfo () {
    return this.showResourcesInfo('rules')
  }

  showRoutesInfo () {
    this.consoleLog(`${chalk.yellow('endpoints (api-gw):')}`)
    let operation = this.client.routes.list().then(routes => {
      if (!routes.apis.length) return console.log('**no routes deployed**\n')
      routes.apis.forEach(api => this.logApiEndPoints(api.value))
      this.consoleLog('')
    })
      
    operation = operation.catch(err => {
      this.consoleLog(`${chalk.red('**failed to fetch routes**')}`)
      if(err.message.match(/status code 400/) && err.message.match(/expired/)) {
        this.consoleLog(`${chalk.red('**api gateway key is wrong or has expired! if it has expired, please refresh with wsk bluemix login**\n')}`)
      }

      if (!this.failsafe) throw err
    })

    return operation
  }

  logEndPoint (baseUrl, path, method, actionName) {
    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, baseUrl.length - 1)
    }

    this.consoleLog(`${method.toUpperCase()} ${baseUrl}${path} --> ${actionName}`)
  }

  logApiEndPoints (api) {
    const paths = api.apidoc.paths
    Object.keys(paths).forEach(path => {
      const methods = Object.keys(paths[path])
      methods.forEach(method => {
        const operation = paths[path][method]
        let actionName = 'unknown'
        if (operation.hasOwnProperty('x-openwhisk')) {
          actionName = operation['x-openwhisk'].action;
        } else if (operation.hasOwnProperty('x-ibm-op-ext')) {
          actionName = operation['x-ibm-op-ext'].actionName;
        }
        this.logEndPoint(api.gwApiUrl, path, method, actionName)
      })
    })
  }

  consoleLog (message) {
    console.log(message)
  }
}

module.exports = OpenWhiskInfo;
