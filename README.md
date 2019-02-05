# Serverless OpenWhisk Plugin
[![Build Status](https://travis-ci.org/serverless/serverless-openwhisk.svg?branch=master)](https://travis-ci.org/serverless/serverless-openwhisk)
[![codecov](https://codecov.io/gh/serverless/serverless-openwhisk/branch/master/graph/badge.svg)](https://codecov.io/gh/serverless/serverless-openwhisk)

This plugin enables support for the [OpenWhisk platform](http://openwhisk.org/) within the Serverless Framework.

## Getting Started

### Register account with OpenWhisk

Before you can deploy your service to OpenWhisk, you need to have an account registered with the platform.

- *Want to run the platform locally?* Please read the project's [*Quick Start*](https://github.com/openwhisk/openwhisk#quick-start) guide for deploying it locally.
- *Want to use a hosted provider?* Please sign up for a free account with [IBM Cloud](https://console.ng.bluemix.net/) and then follow the instructions for getting access to [OpenWhisk on Bluemix](https://console.ng.bluemix.net/openwhisk/).

### Set up account credentials

Account credentials for OpenWhisk can be provided through a configuration file or environment variables. This plugin requires the API endpoint, namespace and authentication credentials.

**Do you want to use a configuration file for storing these values?** Please [follow the instructions](https://console.ng.bluemix.net/openwhisk/cli) for setting up the OpenWhisk command-line utility. This tool stores account credentials in the `.wskprops` file in the user's home directory. The plugin automatically extracts credentials from this file at runtime.  No further configuration is needed.

**Do you want to use environment variables for credentials?** Use the following environment variables to be pass in account credentials. These values override anything extracted from the configuration file.

- *OW_APIHOST* - Platform endpoint, e.g. `openwhisk.ng.bluemix.net`
- *OW_AUTH* - Authentication key, e.g. `xxxxxx:yyyyy`
- *OW_APIGW_ACCESS_TOKEN* - API gateway access token (optional)

### Install Serverless Framework

```shell
$ npm install --global serverless
```

**_This framework plugin requires Node.js runtime version 6.0 or above._**

### Create Service From Template

Using the `create` command, you can create an example service from the [following template](https://github.com/serverless/serverless/tree/master/lib/plugins/create/templates/openwhisk-nodejs).

```shell
serverless create --template openwhisk-nodejs --path my_service
cd my_service
npm install
```

More service examples are available in the [`serverless-examples`](https://github.com/serverless/examples) repository.

**Using a self-hosted version of the platform?**

Ensure you set the `ignore_certs` option in the serverless.yaml prior to deployment.

```
provider:
  name: openwhisk
  ignore_certs: true
```

### Deploy Service

The sample service from the template can be deployed without modification.

```shell
serverless deploy
```

If the deployment succeeds, the following messages will be printed to the console.

```sh
$ serverless deploy
Serverless: Packaging service...
Serverless: Compiling Functions...
Serverless: Compiling API Gateway definitions...
Serverless: Compiling Rules...
Serverless: Compiling Triggers & Feeds...
Serverless: Deploying Functions...
Serverless: Deployment successful!

Service Information
platform:	openwhisk.ng.bluemix.net
namespace:	_
service:	my_service

actions:
my_service-dev-hello

triggers:
**no triggers deployed***

rules:
**no rules deployed**

endpoints:
**no routes deployed**

web-actions:
**no web actions deployed**
```

### Test Service

Use the `invoke` command to test your newly deployed service.

```shell
$ serverless invoke --function hello
{
    "payload": "Hello, World!"
}
$ serverless invoke --function hello --data '{"name": "OpenWhisk"}'
{
    "payload": "Hello, OpenWhisk!"
}
```

*Add the `-v` or `--verbose` flag to show more [invocation details](https://github.com/apache/incubator-openwhisk/blob/master/docs/annotations.md#annotations-specific-to-activations), e.g. activation id and duration details.*

```shell
$ serverless invoke --function hello -v
=> action (<ACTION_NAME>) activation (<ID>) duration: 96ms (init: 83ms, wait: 35ms)
{
    "payload": "Hello, OpenWhisk!"
}
```

## Writing Functions - Node.js

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

## Writing Functions - PHP

Here's an `index.php` file containing an example handler function.

```php
<?php
function main(array $args) : array
{
    $name = $args["name"] ?? "stranger";
    $greeting = "Hello $name!";
    echo $greeting;
    return ["greeting" => $greeting];
}
```

In the `serverless.yaml` file, the `handler` property is used to denote the source file and function name of the serverless function.

```yaml
functions:
  my_function:
    handler: index.main
    runtime: php
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, an associative array [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```php
function main(array $args) : array
{
    $name = $args["name"] ?? "stranger";
    ...
}
```

### Function Return Values

The handler must return  an associative array from the function call.

```php
func main(args: [String:Any]) -> [String:Any] {
	...
    return ["foo" => $bar];
}
```

If you want to return an error message, return an object with an `error` property with the message.

## Writing Functions - Python

Here's an `index.py` file containing an example handler function.

```python
def endpoint(params):
    name = params.get("name", "stranger")
    greeting = "Hello " + name + "!"
    print(greeting)
    return {"greeting": greeting}
```

In the `serverless.yaml` file, the `handler` property is used to denote the source file and module property containing the serverless function.

```yaml
functions:
  my_function:
    handler: index.endpoint
    runtime: python
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, a dictionary [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```python
def endpoint(params):
    name = params.get("name", "stranger")
    ...
```

### Function Return Values

The handler must return a dictionary from the function call.

```python
def endpoint(params):
    ...
    return {"foo": "bar"}
```

If you want to return an error message, return an object with an `error` property with the message.

## Writing Functions - Ruby

Here's an `hello.rb` file containing an example handler function.

```ruby
def main(args)
  name = args["name"] || "stranger"
  greeting = "Hello #{name}!"
  puts greeting
  { "greeting" => greeting }
end
```

In the `serverless.yaml` file, the `handler` property is used to denote the source file and function name of the serverless function.

```yaml
functions:
  my_function:
    handler: hello.main
    runtime: ruby
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, which is a hash [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```ruby
def main(args)
  name = args["name"] || "stranger"
  ...
```

### Function Return Values

The handler must return a hash from the function call.

```ruby
def main(args)
  ...
  { "greeting" => greeting }
end
```

If you want to return an error message, return an `error` property string in the return hash.

## Writing Functions - Swift

Here's an `index.swift` file containing an example handler function.

```swift
func main(args: [String:Any]) -> [String:Any] {
    if let name = args["name"] as? String {
      return [ "greeting" : "Hello \(name)!" ]
    } else {
      return [ "greeting" : "Hello stranger!" ]
    }
}
```

In the `serverless.yaml` file, the `handler` property is used to denote the source file and module property containing the serverless function.

```yaml
functions:
  my_function:
    handler: index.main
    runtime: swift
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, a dictionary [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```swift
func main(args: [String:Any]) -> [String:Any] {
    let prop = args["prop"] as? String
}
```

### Function Return Values

The handler must return a dictionary from the function call.

```swift
func main(args: [String:Any]) -> [String:Any] {
	...
    return ["foo": "bar"]
}
```

If you want to return an error message, return an object with an `error` property with the message.

### Codable Support

Swift 4 runtimes support [Codable types](https://developer.apple.com/documentation/swift/codable) to handle the converting between JSON input parameters and response types to native Swift types.

```swift
struct Employee: Codable {
  let id: Int?
  let name: String?
}
// codable main function
func main(input: Employee, respondWith: (Employee?, Error?) -> Void) -> Void {
    // For simplicity, just passing same Employee instance forward
    respondWith(input, nil)
}
```

### Pre-Compiled Swift Binaries

OpenWhisk supports creating Swift actions from a pre-compiled binary. This reduces startup time for Swift actions by removing the need for a dynamic compilation step.

In the `serverless.yaml` file, the `handler` property can refer to the zip file containing a binary file produced by the build.

```yaml
functions:
  hello:
    handler: action.zip
```

Compiling a single Swift file to a binary can be handled using this Docker command with the OpenWhisk Swift runtime image. `main.swift` is the file containing the swift code and `action.zip` is the zip archive produced.

```
docker run -i openwhisk/action-swift-v4.2 -compile main < main.swift > action.zip
```

Swift packages containing multiple source files with a package descriptor (`Package.swift` ) can be built using the following command.

```
zip - -r * | docker run -i openwhisk/action-swift-v4.2 -compile main > action.zip
```

## Writing Functions - Java

Here's an `src/main/java/HelloWorld.java` file containing an example handler function.

```java
import com.google.gson.JsonObject;

public class HelloWorld {

  public static JsonObject main(JsonObject args) throws Exception {

    final String name = args.getAsJsonPrimitive("name").getAsString();

    final JsonObject response = new JsonObject();
    response.addProperty("greeting", "Hello " + name + "!");

    return response;
  }
}
```

Here is a simple `pom.xml` file that will allow you to use Maven to build it. You will notice that `gson` is excluded from the uberjar. That is because OpenWhisk already provides this dependency.

```xml
<project>
 <modelVersion>4.0.0</modelVersion>
 <groupId>hello</groupId>
 <artifactId>hello-world</artifactId>
 <version>1.0</version>

 <dependencies>
  <dependency>
    <groupId>com.google.code.gson</groupId>
    <artifactId>gson</artifactId>
    <version>2.8.2</version>
  </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-shade-plugin</artifactId>
        <version>3.1.0</version>
        <executions>
          <execution>
            <phase>package</phase>
            <goals>
              <goal>shade</goal>
            </goals>
            <configuration>
              <minimizeJar>true</minimizeJar>
              <artifactSet>
                <excludes>
                  <exclude>com.google.code.gson:gson</exclude>
                </excludes>
              </artifactSet>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
 </project>
```

In the `serverless.yaml` file (see below), the `handler` property is the uberjar produced by calling `mvn clean package`, a colon, and then the fully qualified class name of the class with the main function. If you do not provide a class name after the jar, it will look for a class in the default package called `Main`.

```yaml
service: my-java-service
provider:
  name: openwhisk
  runtime: java
functions:
  hello:
    handler: target/hello-world-1.0.jar:HelloWorld
plugins:
  - serverless-openwhisk
```

### Request Properties

OpenWhisk executes the handler function for each request. This function is called with a single argument, a `com.google.gson.JsonObject` [containing the request properties](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md#passing-parameters-to-an-action).

```java
import com.google.gson.JsonObject;

public class MyActionClass {
  public static JsonObject main(JsonObject args) throws Exception
  {
    final String name = args.getAsJsonPrimitive("name").getAsString();
    ...
  }
}
```

### Function Return Values

The handler must return an `com.google.gson.JsonObject` from the function call.

```java
import com.google.gson.JsonObject;

public class MyActionClass {
  public static JsonObject main(JsonObject args) throws Exception
  {
    ...
    final JsonObject response = new JsonObject();
    response.addProperty("greeting", "Hello " + name + "!");

    return response;
  }
}
```

If you want to return an error message, throw an exception.

## Writing Functions - Binary

OpenWhisk supports executing a compiled binary for the function handler. Using a Python wrapper, the file will be invoked within the `openwhisk/dockerskeleton` Docker container.

The binary must be compiled for the correct platform architecture and only link to shared libraries installed in the `openwhisk/dockerskeleton` runtime.

In the `serverless.yaml` file, the `handler` property is used to denote the binary file to upload.

```yaml
functions:
  my_function:
    handler: bin_file
    runtime: binary
```

### Request Properties

OpenWhisk executes the binary file for each request. Event parameters are streamed to `stdio` as a JSON object string.

### Function Return Values

The handler must write a JSON object string with the response parameters to `stdout` before exiting.

If you want to return an error message, return an object with an `error` property with the message.

## Custom Runtime Images

OpenWhisk actions can use [custom Docker images as the runtime environment](https://medium.com/openwhisk/large-applications-on-openwhisk-bcf15bff94ec). This allows extra packages, libraries or tools to be pre-installed in the runtime environment. Using a custom runtime image, with extra libraries and dependencies built-in, is useful for overcoming the [maximum deployment size](https://github.com/apache/incubator-openwhisk/blob/master/docs/reference.md#system-limits) on actions.

*Images must implement the [API used by the platform](http://jamesthom.as/blog/2017/01/16/openwhisk-docker-actions/) to interact with runtime environments. Images must also be available on Docker Hub. OpenWhisk does not support private Docker registries.*

OpenWhisk publishes the [existing runtime images on Docker Hub](https://hub.docker.com/r/openwhisk/). Using these images in the `FROM` directive in the `Dockerfile` is an easy way to [create new images](https://docs.docker.com/engine/reference/commandline/build/) compatible with the platform.

In the `serverless.yaml` file, the `image` property is used to denote the custom runtime image.

```yaml
functions:
  my_function:
    handler: source.js
    runtime: nodejs
    image: dockerhub_user/image_name
```

*Node.js, Swift, Python and Binary runtimes support using a custom image property.*

## Writing Functions - Docker

OpenWhisk supports creating actions from public images on Docker Hub without handler files. These images are expected to support the platform API used to instantiate and invoke serverless functions.

All necessary files for execution must be provided within the image. Local source files will not be uploaded to the runtime environment.

In the `serverless.yaml` file, the `handler` property is used to denote the image label.

```yaml
functions:
  my_function:
    handler: repo/image_name
    runtime: docker
```

## Working With Packages

OpenWhisk provides a concept called "packages" to manage related actions. Packages can contain multiple actions under a common identifier in a namespace. Configuration values needed by all actions in a package can be set as default properties on the package, rather than individually on each action.

*Packages are identified using the following format:* `/namespaceName/packageName/actionName`.

***Rules and triggers can not be created within packages.***

### Implicit Packages

Actions can be assigned to packages by setting the function `name` with a package reference.

```yaml
functions:
  foo:
    handler: handler.foo
    name: "myPackage/foo"
  bar:
    handler: handler.bar
    name: "myPackage/bar"
```

In this example, two new actions (`foo` & `bar`) will be created using the `myPackage` package.

Packages which do not exist will be automatically created during deployments. When using the `remove` command, any packages referenced in the `serverless.yml` will be deleted.

### Explicit Packages

Packages can also be defined explicitly to set shared configuration parameters. Default package parameters are merged into event parameters for each invocation.

```yaml
functions:
  foo:
    handler: handler.foo
    name: "myPackage/foo"

resources:
  packages:
    myPackage:
      name: optionalCustomName
      parameters:
        hello: world
```

*Explicit packages support the following properties: `name`, `parameters`, `annotations`, `services` and `shared`.*

### Binding Packages

OpenWhisk also supports "binding" external packages into your workspace. Bound packages can have default parameters set for shared actions.

For example, binding the `/whisk.system/cloudant` package into a new package allows you to set default values for the `username`, `password` and `dbname` properties. Actions from this package can then be invoked with having to pass these parameters in.

Define packages explicitly with a `binding` parameter to use this behaviour.

```yaml
resources:
  packages:
    mySamples:
      binding: /whisk.system/cloudant
      parameters:
        username: bernie
        password: sanders
        dbname: vermont
```

For more details on package binding, please see the documentation [here](https://github.com/apache/incubator-openwhisk/blob/master/docs/packages.md#creating-and-using-package-bindings).

## Binding Services (IBM Cloud Functions)

***This feature requires the [IBM Cloud CLI](https://console.bluemix.net/docs/cli/reference/bluemix_cli/download_cli.html#download_install) and [IBM Cloud Functions plugin](https://console.bluemix.net/openwhisk/learn/cli) to be installed.***

IBM Cloud Functions supports [automatic binding of service credentials](https://console.bluemix.net/docs/openwhisk/binding_services.html#binding_services) to actions using the CLI.

Bound service credentials will be passed as the `__bx_creds` parameter in the invocation parameters.

This feature is also available through the `serverless.yaml` file using the `bind` property for each function.

```yaml
functions:
  my_function:
    handler: file_name.handler    
    bind:
      - service:
          name: cloud-object-storage
          instance: my-cos-storage
```

The `service` configuration supports the following properties.

- `name`: identifier for the cloud service
- `instance`: instance name for service (*optional*)
- `key`: key name for instance and service (*optional*)

*If the `instance` or `key` properties are missing, the first available instance and key found will be used.*

Binding services removes the need to manually create default parameters for service keys from platform services.

More details on binding service credentials to actions can be found in the [official documentation](https://console.bluemix.net/docs/openwhisk/binding_services.html#binding_services) and [this blog post](http://jamesthom.as/blog/2018/06/05/binding-iam-services-to-ibm-cloud-functions/).

Packages defined in the `resources` section can bind services using the same configuration properties.

```yaml
resources:
  packages:
    myPackage:
      bind:
        - service:
            name: cloud-object-storage
            instance: my-cos-storage
```

## Runtime Configuration Properties

The following OpenWhisk configuration properties are supported for functions defined in
the `serverless.yaml` file.

```yaml
functions:
  my_function:
    handler: file_name.handler_func
    name: "custom_function_name"
    runtime: 'runtime_label' // defaults to nodejs:default
    namespace: "..." // defaults to user-provided credentials
    memory: 256 // 128 to 512 (MB).
    timeout: 60 // 0.1 to 600 (seconds)
    concurrency: 1 // 1 to 500, default is 1
    parameters:
      foo: bar // default parameters
    annotations:
      foo: bar // action annotations
    bind:
      - service:
          name: cloud-object-storage
          instance: my-cos-storage
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

HTTP event configuration also supports using explicit parameters.

- `method` - HTTP method (mandatory).
- `path` - URI path for API gateway (mandatory).
- `resp` - controls [web action content type](https://github.com/apache/incubator-openwhisk/blob/master/docs/webactions.md#additional-features), values include: `json`, `html`, `http`, `svg`or `text` (optional, defaults to `json`).

```yaml
functions:
  my_function:
    handler: index.main
    events:
      - http:
          method: GET
          path: /api/greeting
          resp: http
```

API Gateway hosts serving the API endpoints will be shown during deployment.

```shell
$ serverless deploy
...
endpoints:
GET https://xxx-gws.api-gw.mybluemix.net/service_name/api/greeting --> service_name-dev-my_function
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

Functions exposed through the API Gateway service are automatically converted into Web Actions during deployment. The framework [secures Web Actions for HTTP endpoints](https://github.com/apache/incubator-openwhisk/blob/master/docs/webactions.md#securing-web-actions) using the `require-whisk-auth` annotation. If the `require-whisk-auth` annotation is manually configured, the existing annotation value is used, otherwise a random token is automatically generated.

### URL Path Parameters

The API Gateway service [supports path parameters]() in user-defined HTTP paths. This allows functions to handle URL paths which include templated values, like resource identifiers.

Path parameters are identified using the `{param_name}` format in the URL path. The API Gateway sends the full matched path value in the `__ow_path` field of the event parameters.

```yaml
functions:
  retrieve_users:
    handler: users.get
    events:
      - http:
          method: GET
          path: /users/{id}
          resp: http
```

This feature comes with the following restrictions:

- *Path parameters are only supported when `resp` is configured as`http`.*
- *Individual path parameter values are not included as separate event parameters. Users have to manually parse values from the full `__ow_path` value.*

### CORS Support

API Gateway endpoints automatically include CORS headers for all endpoints under the service base path. This property can be disabled by manually configuring the `resources.apigw.cors` property.

```yaml
resources:
    apigw:
        cors: false
```

### Application Authentication

API endpoints can be protected by API keys with a secret or API keys alone.

Setting the HTTP headers used to pass keys and secrets automatically enables API Gateway authentication.

This parameter configures the HTTP header containing the API key. Without the additional secret header, authentication uses an API key alone.

```yaml
resources:
    apigw:
        auth:
            key: API-Key-Header
```

Adding the secret header parameter enables authentication using keys with secrets.

```yaml
resources:
    apigw:
        auth:
            key: API-Key-Header
            secret: API-Key-Secret-Header
```

*See the API Gateway [configuration panel](https://cloud.ibm.com/openwhisk/apimanagement) to manage API keys and secrets after authentication is enabled.* 

### Application Authentication with OAuth

API endpoints can also be protected by an external OAuth providers. 

OAuth tokens must be included as the Authorization header of each API request. Token will be validated with the specified token provider. If the token is invalid, requests are rejected with response code 401.

The following OAuth providers are supported: *[IBM Cloud App ID](https://cloud.ibm.com/catalog/services/app-id), Google, Facebook and Github.*

```yaml
resources:
  apigw:
    oauth:
      provider: app-id || google || facebook || github
```

If the `app-id` provider is selected, the tenant identifier must be provided as an additional configuration token. This can be retrieved from the `tenantId` property of provisioned service credentials for the instance

```yaml
resources:
  apigw:
    oauth:
      provider: app-id
      tenant: uuid
```

*Application Authentication with keys (and secrets) and OAuth support are mutually exclusive configuration options.*

### Rate Limiting

API Gateways endpoints support rate limiting to reject excess traffic. When rate limiting is enabled,  API calls falling outside of the limit will be rejected and response code 429 will be returned.

**Rate limiting is on a per-key basis and application authentication (without oauth) must be enabled.**

The  leaky bucket algorithm is used to prevent sudden bursts of invocations of APIs. If the limit is set as 10 calls per minute, users will be restricted to 1 call every 6 seconds (60/10 = 6).

```yaml
resources:
  apigw:
    rate_limit:
      rate: 100
      unit: minute || second || hour || day
```

- `rate`: number of API calls per unit of time.
- `unit`: unit of time (*minute, second, hour, day*) used to threshold API calls with rate.

### Base Path

All API Gateway endpoints defined as HTTP events in the `serverless.yml` are deployed under the default base path (`/`). This basepath can be configured explicitly using the following parameter.

```yaml
resources:
  apigw:
    basepath: /api
```

### API Name

The service name is used as the API identifier in the API Gateway swagger files. This can be configured explicitly using the following parameter.

```yaml
resources:
  apigw:
    name: my-api-name
```

## Exporting Web Actions

Functions can be turned into "*web actions*" which return HTTP content without use of an API Gateway. This feature is enabled by setting an annotation (`web-export`) in the configuration file.

```yaml
functions:
  my_function:
    handler: index.main
    annotations:
      web-export: true
```

Functions with this annotation can be invoked through a URL template with the following parameters.

```
https://{APIHOST}/api/v1/web/{USER_NAMESPACE}/{PACKAGE}/{ACTION_NAME}.{TYPE}
```

- *APIHOST* - platform endpoint e.g. *openwhisk.ng.bluemix.net.*
- *USER_NAMESPACE* - this must be an explicit namespace and cannot use the default namespace (_).
- *PACKAGE* - action package or `default`.
- *ACTION_NAME* - default form `${servicename}-${space}-${name}`.
- *TYPE* - `.json`, `.html`, `.text` or `.http`.

Return values from the function are used to construct the HTTP response. The following parameters are supported.

1. `headers`: a JSON object where the keys are header-names and the values are string values for those headers (default is no headers).
2. `code`: a valid HTTP status code (default is 200 OK).
3. `body`: a string which is either plain text or a base64 encoded string (for binary data).

Here is an example of returning HTML content:

```
function main(args) {
    var msg = "you didn&#39;t tell me who you are."
    if (args.name) {
        msg = `hello ${args.name}!`
    }
    return {body:
       `<html><body><h3><center>${msg}</center></h3></body></html>`}
}
```

Here is an example of returning binary data:

```
function main() {
   let png = <base 64 encoded string>
   return {
      headers: { "Content-Type": "image/png" },
      body: png };
}
```

Functions can access request parameters using the following environment variables.

1. `__ow_method` - HTTP method of the request.
2. `__ow_headers` - HTTP request headers.
3. `__ow_path` - Unmatched URL path of the request.
4. `__ow_body` - Body entity from request.
5. `__ow_query` - Query parameters from the request.

**Full details on this feature are available in this [here](https://github.com/apache/incubator-openwhisk/blob/master/docs/webactions.md).**

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

## IBM Message Hub Events

IBM Bluemix provides an "Apache Kafka"-as-a-Service called IBM Message Hub. Functions can be connected to fire when messages arrive on Kafka topics.

IBM Message Hub instances can be provisioned through the IBM Bluemix platform. OpenWhisk on Bluemix will export Message Hub service credentials bound to a package with the following name:

```
/${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
```

Rather than having to manually define all the properties needed by the Message Hub trigger feed, you can reference a package to use instead. Credentials from the referenced package will be used when executing the trigger feed.

Developers only need to add the topic to listen to for each trigger.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - message_hub:
                package: /${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
                topic: my_kafka_topic

```

The plugin will create a trigger called `${serviceName}_${fnName}_messagehub_${topic}` and a rule called `${serviceName}_${fnName}_messagehub_${topic}_rule` to bind the function to the message hub events.

The trigger and rule names created can be set explicitly using the `trigger` and`rule` parameters.

Other functions can bind to the same trigger using the inline `trigger` event referencing this trigger name.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - message_hub:
                package: /${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
                topic: my_kafka_topic
                trigger: log_events
                rule: connect_index_to_kafka
     another:
        handler: users.another
        events:
            - trigger: log_events
```

### Using Manual Parameters

Parameters for the Message Hub event source can be defined explicitly, rather than using pulling credentials from a package.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - message_hub:
                topic: my_kafka_topic
                brokers: afka01-prod01.messagehub.services.us-south.bluemix.net:9093
                user: USERNAME
                password: PASSWORD
                admin_url:  https://kafka-admin-prod01.messagehub.services.us-south.bluemix.net:443
                json: true
                binary_key: true
                binary_value: true
```

`topic`, `brokers`, `user`, `password` and `admin_url` are mandatory parameters.

## Cloudant DB Events

IBM Cloudant provides a hosted NoSQL database, based upon CouchDB, running on IBM Bluemix. Functions can be connected to events fired when the database is updated. These events use the [CouchDB changes feed](http://guide.couchdb.org/draft/notifications.html) to follow database modifications.

IBM Cloudant instances can be provisioned through the IBM Bluemix platform. OpenWhisk on Bluemix will export Cloudant service credentials bound to a package with the following name:

```
/${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
```

Rather than having to manually define all the properties needed by the [Cloudant trigger feed](https://github.com/openwhisk/openwhisk-package-cloudant#using-the-cloudant-package), you can reference a package to use instead. Credentials from the referenced package will be used when executing the trigger feed.

Developers only need to add the database name to follow for modifications.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant:
                package: /${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
                db: my_db_name

```

The plugin will create a trigger called `${serviceName}_${fnName}_cloudant_${topic}` and a rule called `${serviceName}_${fnName}_cloudant_${topic}_rule` to bind the function to the Cloudant update events.

The trigger and rule names created can be set explicitly using the `trigger` and`rule` parameters.

Other functions can bind to the same trigger using the inline `trigger` event referencing this trigger name.

### Using Manual Parameters

Parameters for the Cloudant event source can be defined explicitly, rather than using pulling credentials from a package.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant: // basic auth example
                host: xxx-yyy-zzz-bluemix.cloudant.com
                username: USERNAME
                password: PASSWORD
                db: db_name
			- cloudant: // iam auth example
                host: xxx-yyy-zzz-bluemix.cloudant.com
                iam_api_key: IAM_API_KEY
                db: db_name
```

 `username` and `password` or `iam_api_key` parameters can be used for authentication.

### Adding Optional Parameters

The following optional feed parameters are also supported:

* `max` - Maximum number of triggers to fire. Defaults to infinite.
* `filter` - Filter function defined on a design document.
* `query` - Optional query parameters for the filter function.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant:
                ...
                max: 10000
                query:
                   status: new
                filter: mailbox/by_status
```

## Custom Event Triggers

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

- `deploy` - [Deploy functions, triggers and rules for service](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/deploy/).
- `invoke`- [Invoke deployed serverless function and show result](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/invoke/).
- `invokeLocal`- [Invoke serverless functions locally and show result](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/invoke#invoke-local).
- `remove` - [Remove functions, triggers and rules for service](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/remove/).
- `logs` - [Display activation logs for deployed function](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/logs/).
- `info` - [Display details on deployed functions, triggers and rules](https://serverless.com/framework/docs/providers/openwhisk/cli-reference/info/).
