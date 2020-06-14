# up9-node

Traffic monitoring kit for use with UP9

## Installing

Using npm:

```bash
npm install up9-node
```

Using yarn:

```bash
yarn add up9-node
```

## Usage

With Express:

```javascript
var express = require("express");
var app = express();

var up9Monitor = require("up9-node")({
    "up9Server": "up9.app",
    "serviceName": "your-service-name",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "hostnameOverrides": {"https://your-external-dns-address": "your-service-name"}
});

app.use(up9Monitor.express());
```

A complete example app can be seen [here](https://github.com/RamiBerm/up9-node-example/)