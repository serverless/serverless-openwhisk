# Compile API Gateway Endpoints

This plugins compiles the HTTP events bound to functions in `serverless.yaml` to
corresponding [OpenWhisk API Gateway endpoint](https://github.com/openwhisk/openwhisk/blob/master/docs/apigateway.md)
definitions.

## How it works

`Compile HTTP` hooks into the [`package:compileEvents`](/lib/plugins/deploy) lifecycle.

It loops over all functions which are defined in `serverless.yaml` looking for
the defined events. For each `http` event defined for the function, the
corresponding API gateway endpoint definition will be created.

## Examples

```yaml
# serverless.yaml
functions:
    index:
        handler: users.handler
        events:
            - http: GET /api/greeting
```

This definition will create a new endpoint, which binds the configured Action
(index) to the URL path (/api/greeting) and HTTP method (GET).

HTTP operation and path parameters can also be passed object properties on the
event object.

```yaml
# serverless.yaml
functions:
    index:
        handler: users.handler
        events:
            - http: 
                method: GET 
                basepath: /mypath
                path: /api/greeting
                resp: json
```

During deployment the endpoint configuration file will be uploaded to OpenWhisk.
Each user has a unique hostname which provides access to the configured API
endpoints. Invoking the endpoints on the gateway host will execute functions
on-demand.

API Gateway hosts serving the API endpoints will be shown during deployment.

```shell
$ serverless deploy
...
endpoints:
GET https://xxx-gws.api-gw.mybluemix.net/api/greeting --> index
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
