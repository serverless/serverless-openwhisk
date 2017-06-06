# Compile Functions

This plugins compiles the functions in `serverless.yaml` to corresponding [OpenWhisk Action](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md)
definitions.

## How it works

`Compile Functions` hooks into the [`package:compileFunctions`](/lib/plugins/deploy) lifecycle.

It loops over all functions which are defined in `serverless.yaml`.

Inside the function loop it creates corresponding OpenWhisk Action definition based on the settings
(e.g. function `name` property or service `defaults`) which are provided in the `serverless.yaml` file.

The function will be called `<serviceName>_<functionName>` by default but you
can specify an alternative name with the help of the functions `name` property.
The Action namespace defaults to the service provider namespace but can be set
manually, using the `namespace` parameter.

The functions `MemorySize` is set to `256`, `Timeout to `60` and `Runtime` to `nodejs`. You can overwrite those defaults by setting
corresponding entries in the function definition or server provider properties.

At the end all OpenWhisk Action definitions are merged inside the `serverless.service.actions` section.

### Action Rules

Action [Rules](https://github.com/openwhisk/openwhisk/blob/master/docs/triggers_rules.md), binding Actions to [Triggers](https://github.com/openwhisk/openwhisk/blob/master/docs/triggers_rules.md), can be defined using the `events` property.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - triggers: 
                trigger: "myTriggerName"
```

This definition will create a new Rule, which binds the configured Action to the
Trigger.

More documentation on the Rules configuration can be found in the [`compileRules` plugin](../rules). 
