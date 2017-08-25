# Cloudant Events

This plugins compiles the `cloudant` events in `serverless.yaml` to corresponding [OpenWhisk Cloudant Trigger Feeds](https://github.com/openwhisk/openwhisk-package-cloudant) definitions.

## How it works

`Compile Cloudant` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all schedule event which are defined in `serverless.yaml`.

### Using Package Parameters 

IBM Cloudant instances can be provisioned through the IBM Bluemix platform. OpenWhisk on Bluemix will export Cloudant service credentials bound to a package with the following name:

```
/${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
```

Rather than having to manually define all the properties needed by the Cloudant trigger feed, you can reference a package to use instead. Credentials from the referenced package will be used when executing the trigger feed.

Developers only need to add the database to listen to for each trigger.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant: 
                package: /${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
                db: db_name
 
```

The plugin will create a trigger called `${serviceName}_${fnName}_cloudant_${db}` and a rule called `${serviceName}_${fnName}_cloudant_${db}_rule` to bind the function to the database update events.

The trigger and rule names created can be set explicitly using the `trigger` and `rule` parameters.

Other functions can bind to the same trigger using the inline `trigger` event referencing this trigger name.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant: 
                package: /${BLUEMIX_ORG}_${BLUEMIX_SPACE}/Bluemix_${SERVICE_NAME}_Credentials-1
                db: my_db
                trigger: db_events
                rule: connect_index_to_db 
     another:
        handler: users.another
        events:
            - trigger: db_events 
```

### Using Manual Parameters

Trigger feed parameters for the Cloudant event source can be defined explicitly, rather than using pulling credentials from a package.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.main
        events:
            - cloudant: 
                host: xxx-yyy-zzz-bluemix.cloudant.com
                username: USERNAME
                password: PASSWORD
                db: db_name               
```

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

