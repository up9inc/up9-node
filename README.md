# up9-sdk

Traffic monitoring kit for use with UP9

## Installing

Using npm:

```bash
npm install up9-sdk
```

Using yarn:

```bash
yarn add up9-sdk
```

## Usage

With Express:

```javascript
var express = require("express");
var app = express();

var up9Monitor = require("up9-sdk")({
    "up9Server": "up9.app",
    "serviceName": "your-service-name",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "hostnameOverrides": {"https://your-external-dns-address": "your-service-name"}
});

app.use(up9Monitor.express());
```