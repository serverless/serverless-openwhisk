# Compile Triggers

This plugins compiles the schedule events in `serverless.yaml` to corresponding [OpenWhisk Alarm Trigger Feeds](https://github.com/openwhisk/openwhisk/blob/master/docs/actions.md)
definitions.

## How it works

`Compile Schedule` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all schedule event which are defined in `serverless.yaml`.

### Implicit Schedule Definition

Alarm triggers referenced in the function event configuration don't have to
explicitly defined the triggers and rules in the `resources` section. The plugin
will set up these resources for creation without any further configuration.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - schedule: cron(* * * * *) // fires every minute 
```

The plugin will create a trigger called `${serviceName}_${fnName}_alarmTrigger`
and a rule called `${serviceName}_${fnName}_alarmRule` to bind the function to
the cron events.

### Explicit Schedule Definition

Adding extra properties for the alarm event can be handled by defining an object
as the `schedule` value rather than the cron string.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - schedule:
              rate: cron(* * * * *)
              trigger: custom_trigger_name
              rule: custom_rule_name
              max: 10000 // maximum event fires, defaults to 1000
              params: 
                hello: world

```

`rate` is the only mandatory property. 

All OpenWhisk Schedule events are merged inside the `serverless.service.triggers` and `serverless.service.rules` section.
