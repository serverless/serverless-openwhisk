

# Serverless OpenWhisk Plugin

This plugin enables support for the [OpenWhisk platform](http://openwhisk.org/) within the Serverless Framework.

## Getting Started

### Register account with OpenWhisk

Before you can deploy your service to OpenWhisk, you need to have an account registered with the platform.

- *Want to run the platform locally?* Please read the project's [*Quick Start*](https://github.com/openwhisk/openwhisk#quick-start) guide for deploying it locally.
- *Want to use a hosted provider?* Please sign up for an account with [IBM Bluemix](https://console.ng.bluemix.net/) and then follow the instructions for getting access to [OpenWhisk on Bluemix](https://console.ng.bluemix.net/openwhisk/). 

### Set up account credentials

Account credentials for OpenWhisk can be provided through a configuration file or environment variables. This plugin requires the API endpoint, namespace and authentication credentials.

**Do you want to use a configuration file for storing these values?** Please [follow the instructions](https://console.ng.bluemix.net/openwhisk/cli) for setting up the OpenWhisk command-line utility. This tool stores account credentials in the `.wskprops` file in the user's home directory. The plugin automatically extracts credentials from this file at runtime.  No further configuration is needed.

**Do you want to use environment variables for credentials?** Use the following environment variables to be pass in account credentials. These values override anything extracted from the configuration file.

- *OW_APIHOST* - Platform endpoint, e.g. `openwhisk.ng.bluemix.net`
- *OW_AUTH* - Authentication key, e.g. `xxxxxx:yyyyy`

### Download boilerplate

Retrieve the [boilerplate repository](https://github.com/jthomas/serverless-openwhisk-boilerplate) from Github.

```
$ git clone https://github.com/jthomas/serverless-openwhisk-boilerplate
$ cd serverless-openwhisk-boilerplate
```

### Install Project Dependencies

*Due to an [outstanding issue](https://github.com/serverless/serverless/issues/2895) with provider plugins, the [OpenWhisk provider](https://github.com/serverless/serverless-openwhisk) must be installed as a global module.*

```
$ sudo npm install --global serverless serverless-openwhisk
$ npm install
```

### Deploy Service

The boilerplate includes an example that can be deployed without modification.

```shell
serverless deploy
```

If the deployment succeed, the following messages will be printed to the console.

```sh
$ serverless deploy
Serverless: Packaging service...
Serverless: Compiling Functions...
Serverless: Compiling Rules...
Serverless: Compiling Triggers & Feeds...
Serverless: Deploying Functions...
Serverless: Deploying Triggers...
Serverless: Deploying Rules...
Serverless: Deployment successful!
```

### Test Service

Use the `invoke` command to test your newly deployed service.

```shell
$ serverless invoke --function my_function
{
    "payload": "Hello, World!"
}
$ serverless invoke --function my_function --data '{"name": "OpenWhisk"}'
{
    "payload": "Hello, OpenWhisk!"
}
```

## Writing Functions

Here's an `index.js` file containing an example handler function.

```javascript
function main(params) {
  const name = params.name || 'World';
  return {payload:  'Hello, ' + name + '!'};
};

exports.main = main;
```

Modules [should return the function handler](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#packaging-an-action-as-a-nodejs-module) as a custom property on the global `exports` object. 

In the `serverless.yaml` file, the `handler` property is used to denote the source file and module property containing the serverless function.

```yaml
functions:
  my_function:
    handler: index.main
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, an object [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```javascript
function main(params) {
  const parameter = params.parameter_name;
  ...
};
```

### Function Return Values

The handler must return an object from the function call. Returning `undefined` or `null` will result in an error. If the handler is carrying out an [asynchronous task](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#creating-asynchronous-actions), it can return a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). 

```javascript
// synchronous return
function main () {
  return { payload: "..." }
}

// asychronous return
function main(args) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      resolve({ done: true });
     }, 2000);
  })
}
```

If you want to return an error message, return an object with an `error` property with the message. Promise values that are rejected will be interpreted as runtime errors.

```javascript
// synchronous return
function main () {
  return { error: "..." }
}

// asychronous return
function main(args) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject("error message");
     }, 2000);
  })
}
```

### Using NPM Modules

NPM modules must be [installed locally](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#packaging-an-action-as-a-nodejs-module) in the `node_modules` directory before deployment. This directory will be packaged up in the deployment artefact. Any dependencies included in `node_modules` will be available through `require()` in the runtime environment.

OpenWhisk provides a number of popular NPM modules in the runtime environment. Using these modules doesn't require them to be included in the deployment package. See [this list](https://github.com/openwhisk/openwhisk/blob/master/docs/reference.md#javascript-runtime-environments) for full details of which modules are available.

```javascript
const leftPad = require("left-pad")

function pad_lines(args) {
    const lines = args.lines || [];
    return { padded: lines.map(l => leftPad(l, 30, ".")) }
};

exports.handler = pad_lines;
```

### Configuration Properties

The following configuration properties are supported in the `serverless.yaml` file.

```yaml
functions:
  my_function:
    handler: file_name.handler_func
    namespace: "..." // defaults to user-provided credentials
    memory: 256 // 128 to 512 (MB).
    timeout: 60 // 0.1 to 600 (seconds)
    runtime: 'nodejs:default'
```

## Writing Sequences

OpenWhisk supports a special type of serverless function called [sequences](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#creating-action-sequences).

These functions are defined from a list of other serverless functions. Upon invocation, the platform executes each function in series. Request parameters are passed into the first function in the list. Each subsequent function call is passed the output from the previous step as input parameters. The last function's return value is returned as the response result.

Here's an example of the configuration to define a sequence function, composed of three other functions.

```yaml
functions:
  my_function:
    sequence:
      - parse_input
      - do_some_algorithm
      - construct_output
```

*Sequence functions do not have a handler file defined. If you want to refer to functions not defined in the serverless project, use the fully qualified identifier e.g. /namespace/package/action_name*

## Connecting HTTP Endpoints

Functions can be bound to public URL endpoints using the [API Gateway service](https://github.com/openwhisk/openwhisk/blob/master/docs/apigateway.md). HTTP requests to configured endpoints will invoke functions on-demand. Requests parameters are passed as function arguments. Function return values are serialised as the JSON response body.

HTTP endpoints for functions can be configured through the `serverless.yaml` file.

```yaml
functions:
  my_function:
    handler: index.main
    events:
      - http: GET /api/greeting
```

API Gateway hosts serving the API endpoints will be shown during deployment.

```shell
$ serverless deploy
...
endpoints:
GET https://xxx-gws.api-gw.mybluemix.net/service_name/api/path --> service_name-dev-my_function
```

Calling the configured API endpoints will execute the deployed functions.

````shell
$ http get https://xxx-gws.api-gw.mybluemix.net/api/greeting?user="James Thomas"
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8
Date: Mon, 19 Dec 2016 15:47:53 GMT

{
    "message": "Hello James Thomas!"
}
````

_**IMPORTANT: [API Gateway support](https://github.com/openwhisk/openwhisk/blob/master/docs/apigateway.md) is currently experimental and may be subject to breaking changes.**_

## Scheduled Invocations

Functions can be set up to fire automatically using the [alarm package](https://github.com/openwhisk/openwhisk/blob/master/docs/catalog.md#using-the-alarm-package). This allows you to invoke functions with preset parameters at specific times (*12:00 each day*) or according to a schedule (*every ten minutes*).

Scheduled invocation for functions can be configured through the `serverless.yaml` file.

The `schedule` event configuration is controlled by a string, based on the UNIX crontab syntax, in the format `cron(X X X X X)`. This can either be passed in as a native string or through the `rate` parameter.

```yaml
functions:
  my_function:
    handler: index.main
    events: 
      - schedule: cron(* * * * *) // fires each minute.
```

This above example generates a new trigger (`${service}_crawl_schedule_trigger`) and rule (`${service}_crawl_schedule_rule`) during deployment.

Other `schedule` event parameters can be manually configured, e.g trigger or rule names.

```yaml
functions:
  aggregate:
    handler: statistics.handler
    events:
      - schedule:
          rate: cron(0 * * * *) // call once an hour
          trigger: triggerName
          rule: ruleName
          max: 10000 // max invocations, default: 1000, max: 10000
          params: // event params for invocation
            hello: world
```

## Connecting Events

Functions are connected to event sources in OpenWhisk [using triggers and rules](https://github.com/openwhisk/openwhisk/blob/master/docs/triggers_rules.md). Triggers create a named event stream within the system. Triggers can be fired manually or connected to external data sources, like databases or message queues. 

Rules set up a binding between triggers and serverless functions. With an active rule, each time a trigger is fired, the function will be executed with the trigger payload.

Event binding for functions can be configured through the `serverless.yaml` file.

```yaml
functions:
  my_function:
    handler: index.main
    events:
      - trigger: my_trigger
```
This configuration will create a trigger called `servicename-my_trigger` with an active rule binding `my_function` to this event stream. 

### Customising Rules

Rule names default to the following format `servicename-trigger-to-action`. These names be explicitly set through configuration.

```yaml
functions:
  my_function:
    handler: index.main
    events:
      - trigger:
        name: "my_trigger"
        rule: "rule_name"
```

### Customing Triggers

Triggers can be defined as separate resources in the `serverless.yaml` file. This allows you to set up trigger properties like default parameters.

```yaml
functions:
  my_function:
    handler: index.main
    events:
      - trigger: my_trigger
      
resources:
  triggers:
    my_trigger:
      parameters: 
        hello: world            
```

### Trigger Feeds

Triggers can be bound to external event sources using the `feed` property. OpenWhisk [provides a catalogue](https://github.com/openwhisk/openwhisk/blob/master/docs/catalog.md) of third-party event sources bundled as [packages](https://github.com/openwhisk/openwhisk/blob/master/docs/packages.md#creating-and-using-trigger-feeds).

This example demonstrates setting up a trigger which uses the `/whisk.system/alarms/alarm` feed. The `alarm` feed will fire a trigger according to a user-supplied cron schedule.

```yaml
resources:
  triggers:
    alarm_trigger:
      parameters: 
        hello: world
      feed: /whisk.system/alarms/alarm
      feed_parameters: 
        cron: '*/8 * * * * *'
```

## Commands

The following serverless commands are currently implemented for the OpenWhisk provider.

- `deploy` - [Deploy functions, triggers and rules for service](https://serverless.com/framework/docs/providers/aws/cli-reference/deploy/).
- `invoke`- [Invoke deployed serverless function and show result](https://serverless.com/framework/docs/providers/aws/cli-reference/invoke/).
- `invokeLocal`- [Invoke serverless functions locally and show result](https://serverless.com/framework/docs/providers/aws/cli-reference/invoke#invoke-local).
- `remove` - [Remove functions, triggers and rules for service](https://serverless.com/framework/docs/providers/aws/cli-reference/remove/).
- `logs` - [Display activation logs for deployed function](https://serverless.com/framework/docs/providers/aws/cli-reference/logs/). 
- `info` - [Display details on deployed functions, triggers and rules](https://serverless.com/framework/docs/providers/aws/cli-reference/info/).
