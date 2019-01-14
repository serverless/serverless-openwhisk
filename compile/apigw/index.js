'use strict';

const BbPromise = require('bluebird');
const crypto = require('crypto');

class OpenWhiskCompileHttpEvents {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'before:package:compileEvents': this.setup.bind(this),
      'before:package:compileFunctions': this.addWebAnnotations.bind(this),
      'package:compileEvents': this.compileHttpEvents.bind(this)
    };
  }

  setup() {
    // This object will be used to store the endpoint definitions, passed directly to
    // the OpenWhisk SDK during the deploy process.
    this.serverless.service.apigw = {};

    // Actions and Triggers referenced by Rules must used fully qualified identifiers (including namespace).
    if (!this.serverless.service.provider.namespace) {
      return this.provider.props().then(props => {
        this.serverless.service.provider.namespace = props.namespace;
        this.serverless.service.provider.host = props.apihost;
      });
    }
  }

  generateAuthString() {
    return crypto.randomBytes(64).toString('hex')
  }

  // HTTP events need Web Actions enabled for those functions. Add
  // annotation 'web-export' if it is not already present.
  addWebAnnotations() {
    const names = Object.keys(this.serverless.service.functions)
    names.forEach(fnName => {
      const f = this.serverless.service.functions[fnName]
      const httpEvents = (f.events || []).filter(e => e.http)
      if (httpEvents.length) {
        if (!f.annotations) f.annotations = {}
        f.annotations['web-export'] = true

        if (!f.annotations.hasOwnProperty('require-whisk-auth')) {
          f.annotations['require-whisk-auth'] = this.generateAuthString()
        }
      }
    })

    return BbPromise.resolve();
  }

  calculateFunctionName(functionName, functionObject) {
    return functionObject.name || `${this.serverless.service.service}_${functionName}`;
  }

  calculateFunctionNameSpace(functionObject) {
    return functionObject.namespace
      || this.serverless.service.provider.namespace
      || '_';
  }

  retrieveAuthKey(functionObject) {
    const annotations = functionObject.annotations || {}
    return annotations['require-whisk-auth']
  }

  //
  // This method takes the rule definitions, parsed from the user's YAML file,
  // and turns it into the OpenWhisk Rule resource object.
  //
  // These resource objects are passed to the OpenWhisk SDK to create the associated Rules
  // during the deployment process.
  //
  // Parameter values will be parsed from the user's YAML definition, either as a value from
  // the rule definition or the service provider defaults.
  compileHttpEvent(funcName, funcObj, http) {
    const options = this.parseHttpEvent(http);
    options.namespace = this.calculateFunctionNameSpace(funcName, funcObj);

    const name = this.calculateFunctionName(funcName, funcObj).split('/');
    options.action = name.pop();
    options.pkge = name.pop() || "default";

    const secure_key = this.retrieveAuthKey(funcObj)
    if (secure_key) {
      options.secure_key = secure_key;
    }

    return options;
  }

  parseHttpEvent(httpEvent) {
    if (httpEvent.path && httpEvent.method) {
      return { relpath: httpEvent.path, operation: httpEvent.method, responsetype: httpEvent.resp || 'json' };
    } else if (typeof httpEvent === 'string') {
      const method_and_path = httpEvent.trim().split(' ');
      if (method_and_path.length !== 2) {
        throw new this.serverless.classes.Error(
          `Incorrect HTTP event parameter value (${httpEvent}), must be string in form: HTTP_METHOD API_PATH e.g. GET /api/foo`);
      }
      return { operation: method_and_path[0], relpath: method_and_path[1], responsetype: httpEvent.resp || 'json'  }
    } 

    throw new this.serverless.classes.Error(
      `Incorrect HTTP event parameter value (${httpEvent}), must be string ("GET /api/foo") or object ({method: "GET", path: "/api/foo"})`);
  }

  addAuthToSwagger(swagger, auth) {
    if (!auth.key && auth.secret) {
      throw new this.serverless.classes.Error(
        "Missing mandatory resources.apigw.auth.key parameter. Must be defined to enable authentication."
      )
    }
    swagger.security = [{ client_id: [] }]
    const client_id = {
      in: "header", name: auth.key,
      type: "apiKey", "x-key-type": "clientId"
    }
    swagger.securityDefinitions = { client_id }

    if (auth.secret) {
      swagger.security[0].client_secret = []
      swagger.securityDefinitions.client_secret = { 
        in: "header", name: auth.secret,
        type: "apiKey", "x-key-type": "clientSecret"
      }
    }
  }

  addOAuthToSwagger(swagger, oauth) {
    if (!oauth.provider) return

    const providers_urls = {
      google: "https://www.googleapis.com/oauth2/v3/tokeninfo",
      facebook: "https://graph.facebook.com/debug_token",
      github: "https://api.github.com/user",
    }

    if (oauth.provider !== 'app-id' && oauth.provider !== 'google'
      && oauth.provider !== 'facebook' && oauth.provider !== 'github') {
      throw new this.serverless.classes.Error(
        `OAuth defined with invalid provider (${oauth.provider}), must be: app-id, google, facebook, github.`
      )
    }

    const security = {}
    security[oauth.provider] = []
    swagger.security = [ security ]

    const definition = {
      flow: "application", tokenUrl: "", type: "oauth2",
      "x-provider": { name: oauth.provider },
      "x-tokenintrospect": { url: null }
    }

    if (oauth.provider === 'app-id') {
      if (!oauth.tenant) {
        throw new this.serverless.classes.Error(
          `OAuth provider app-id defined without tenant parameter`
        )
      }
      definition['x-provider'].params = { tenantId: oauth.tenant }
    } else {
      definition['x-tokenintrospect'].url = providers_urls[oauth.provider]
    }

    const securityDefinitions = {}
    securityDefinitions[oauth.provider] = definition
    swagger.securityDefinitions = securityDefinitions
  }

  addRateLimitToSwagger(swagger, rate_limit) {
    const rate = rate_limit.rate
    const unit = rate_limit.unit

    if (!rate) {
      throw new this.serverless.classes.Error(
        "Missing rate limit parameter: rate."
      )
    }
    if (!unit) {
      throw new this.serverless.classes.Error(
        "Missing rate limit parameter: unit."
      )
    }

    if (unit !== "minute" && unit !== "second" && unit !== "hour" && unit !== "day") {
      throw new this.serverless.classes.Error(
        "Invalid rate limit parameter: unit."
      )
    }
    swagger["x-ibm-rate-limit"] = [{
      rate: rate_limit.rate,
      unit: rate_limit.unit,
      units: 1
    }]
  }

  generateSwagger(service, host, options, httpEvents) {
    const paths = httpEvents.reduce((paths, httpEvent) => {
      const path = paths[httpEvent.relpath] || {}
      const operation = httpEvent.operation.toLowerCase()
      
      path[operation] = this.compileSwaggerPath(httpEvent, host)
      paths[httpEvent.relpath] = path

      return paths
    }, {})

    const cases = httpEvents.map(httpEvent => this.compileSwaggerCaseSwitch(httpEvent, host))
    const execute_body = { "operation-switch": { case: cases } }
    const enabled = options.hasOwnProperty('cors') ? options.cors : true

    const x_ibm_configuration = { 
      cors: { enabled },
      assembly: { execute: [ execute_body ] }
    }

    const swagger = {
      swagger: "2.0",
      basePath: options.basepath || "/",
      info: {
        title: options.name || service,
        version: "1.0"
      },
      paths,
      "x-ibm-configuration": x_ibm_configuration
    }

    if (options.auth) {
      this.addAuthToSwagger(swagger, options.auth)
    }

    if (options.oauth) {
      this.addOAuthToSwagger(swagger, options.oauth)
    }

    if (options.rate_limit) {
      this.addRateLimitToSwagger(swagger, options.rate_limit)
    }

    return swagger
  }

  compileSwaggerPath(httpEvent, host) {
    const operationId = this.operationId(httpEvent)
    const responses = { "200": { description: "A successful invocation response" } }
    const webaction_url = this.webActionUrl(httpEvent, host)

    const x_ow = {
      action: httpEvent.action, namespace: httpEvent.namespace,
      package: httpEvent.pkge, url: webaction_url
    }

    const swaggerPath = { operationId, responses, "x-openwhisk": x_ow }
    return swaggerPath
  }

  compileSwaggerCaseSwitch(httpEvent, host) {
    const webaction_url = this.webActionUrl(httpEvent, host)
    const operationId = this.operationId(httpEvent)

    const header = {
      set: "message.headers.X-Require-Whisk-Auth",
      value: httpEvent.secure_key
    }

    const execute = [
      { "set-variable": { actions: [ header ] } },
      { invoke: { "target-url": webaction_url, verb: "keep" } }
    ]
    const operations = [ operationId ]

    const swaggerCaseSwitch = { execute, operations }
    return swaggerCaseSwitch
  }

  webActionUrl(httpEvent, host) {
    return `https://${host}/api/v1/web/${httpEvent.namespace}/${httpEvent.pkge}/${httpEvent.action}.${httpEvent.responsetype}`
  }

  operationId(httpEvent) {
    return `${httpEvent.operation}-${httpEvent.relpath}`.toLowerCase()
  }

  compileFunctionHttpEvents(functionName, functionObject) {
    if (!functionObject.events) return []

    const events = functionObject.events
      .filter(e => e.http)
      .map(e => this.compileHttpEvent(functionName, functionObject, e.http))

    if (events.length && this.options.verbose) {
      this.serverless.cli.log(`Compiled API Gateway definition (${functionName}): ${JSON.stringify(events)}`);
    }

    return events
  }

  compileHttpEvents () {
    this.serverless.cli.log('Compiling API Gateway definitions...');

    const allFunctions = this.serverless.service.getAllFunctions()

    const httpEvents = allFunctions.map(
      functionName => this.compileFunctionHttpEvents(functionName, this.serverless.service.getFunction(functionName))
    ).reduce((a, b) => a.concat(b), [])

    if (httpEvents.length) {
      const service = this.serverless.service.service
      const host = this.serverless.service.provider.host
      const resources = this.serverless.service.resources || {}
      const options = resources.apigw || {}
      this.serverless.service.apigw.swagger = this.generateSwagger(service, host, options, httpEvents)
    }

    return BbPromise.resolve();
  }
}

module.exports = OpenWhiskCompileHttpEvents;
