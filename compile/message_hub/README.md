# Compile Triggers

This plugins compiles the `message_hub` events in `serverless.yaml` to corresponding [OpenWhisk Message Hub Trigger Feeds](https://github.com/openwhisk/openwhisk-package-kafka) definitions.

## How it works

`Compile Message Hub` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all schedule event which are defined in `serverless.yaml`.

### Using Package Parameters 

IBM Message Hub instances can be provisioned through the IBM Bluemix platform.
OpenWhisk on Bluemix will export Message Hub service credentials bound to a
package with the following name:
```
/${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
```

Rather than having to manually define all the properties needed by the Message
Hub trigger feed, you can reference a package to use instead. Credentials from
the referenced package will be used when executing the trigger feed.

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

The plugin will create a trigger called `${serviceName}_${fnName}_messagehub_${topic}`
and a rule called `${serviceName}_${fnName}_messagehub_${topic}_rule` to bind the function to
the message hub events.

The trigger and rule names created can be set explicitly using the `trigger` and
`rule` parameters.

Other functions can bind to the same trigger using the inline `trigger` event
referncing this trigger name.

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

Trigger feed parameters for the Message Hub event source can be defined
explicitly, rather than using pulling credentials from a package.

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
