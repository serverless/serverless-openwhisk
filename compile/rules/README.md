# Compile Rules

This plugins compiles the triggers bound to functions in `serverless.yaml` to
corresponding [OpenWhisk Rules](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md)
definitions.

## How it works

`Compile Rules` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all functions which are defined in `serverless.yaml` looking for
the defined events. For each `trigger` event defined for the function, the
corresponding `rule` will be created.

## Examples

```yaml
# serverless.yaml
functions:
    index:
        handler: users.handler
        events:
            - trigger: "my_trigger"
```

This definition will create a new Rule, called `my-service_my_trigger_to_index`,
which binds the configured Action (index) to the Trigger (my_trigger).

Triggers can be defined within the `serverless.yaml` file, see the documentation
in the [`compileTriggers` plugin](../triggers). Triggers that aren't explicitly
defined will be automatically created.

If the event trigger value is a string, containing the trigger name, the rule
name will be automatically generated in the form: `servicename-trigger-to-action`.

If the trigger event value is an object, you can set the rule name explicitly.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.handler
        events:
          - trigger:
              name: "my_trigger"
              rule: "rule_name"
```

At the end all OpenWhisk Rule definitions are merged inside the `serverless.service.rules` section.
