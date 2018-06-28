# Service Bindings

This plugin binds IBM Cloud platform service credentials to actions and packages in `serverless.yaml`.

## How it works

`Compile Service Bindings` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

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