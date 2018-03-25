# Compile Packages

This plugins compiles the packages in `serverless.yaml` to corresponding [OpenWhisk Packages](https://github.com/openwhisk/openwhisk/blob/master/docs/packages.md)
definitions.

## How it works

`Compile Packages` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all packages which are defined in `serverless.yaml`.

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
      parameters:
        hello: world 
```

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