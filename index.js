const httpConnector = require("./http-connector");
const expressConnector = require("./plugins/express-plugin");
const utils = require("./utils");

const POLL_INTERVAL_MS = 5000;
class UP9Monitor {
    constructor(options) {
        this.env = options.up9Server;
        this.serviceName = options.serviceName;
        this.tappingSourceId = "nodejs-" + this.serviceName;
        this.httpConnector = httpConnector(this.env, options.clientId, options.clientSecret);
        setInterval(this.poll, POLL_INTERVAL_MS);

        this.requestLogger(require("http"), "http");
        this.requestLogger(require("https"), "https");
    }

    poll = async () => {
        try {
            await this.httpConnector.postTappingSource(this.tappingSourceId);
            const state = await this.httpConnector.getTappingState();
            this.ownState = state.filter(s => s.id == this.tappingSourceId)[0];
        } catch (e) {
            console.error("error polling", e);
        }

    }

    sendMessage = async (message) => {
        try {
            if (this.ownState && this.ownState.shouldTap && this.ownState.model) {
                await this.httpConnector.sendTrafficMessage(this.ownState.model, message);
            }
        } catch (e) {
            console.error("error sending message to dumper", e, message, this.ownState);
        }

    }

    express = () => {
        return expressConnector(this.sendMessage);
    }

    requestLogger = (httpModule, protocol) => {
        let original = httpModule.request
        httpModule.request = (request, callback) => {
            const startUnixTimestamp = + new Date();
            return original(request, (response) => {
                let body = "";
                response.on('readable', () => {
                    body += response.read();
                });
                response.on('end', () => {
                    const requestDuration = (+ new Date()) - startUnixTimestamp;
                    this.processOutgoingMessage(request, response, body, protocol, startUnixTimestamp, requestDuration);
                });
                if (callback)
                    callback(response);
            })
        }
    }

    processOutgoingMessage = (request, response, responseBody, protocol, startUnixTimestamp, requestDuration) => {
        let url = "";
        if (request.protocol)
            url = `${request.protocol}//${request.hostname}${request.path}`;
        else {
            url = request.href;
        }
        if (url.indexOf(this.env) == -1) {
            const requestHeaders = {...request.headers};
            requestHeaders[':method'] = request.method;
            requestHeaders[':path'] = request.path;
            requestHeaders[':authority'] = request.hostname;
            requestHeaders[':scheme'] = protocol;
            requestHeaders['x-up9-destination'] = this.serviceName;
            const requestBody = request.body;
            const message = {
                request: {
                    headers: utils.lowerCaseObjectKeys(requestHeaders),
                    body: {
                        "truncated": false,
                        "as_bytes": requestBody ? Buffer.from(requestBody).toString('base64') : ""
                    },
                    request_url: url,
                    hostname: request.hostname,
                    started_at_unix: startUnixTimestamp / 1000
                },
                response: {
                    headers: utils.lowerCaseObjectKeys({...response.headers, ":status": response.statusCode.toString(), 'duration_ms': requestDuration.toString()}),
                    body: {
                        "truncated": false,
                        "as_bytes": responseBody ? Buffer.from(responseBody).toString('base64') : ""
                    },
                    duration_ms: requestDuration,
                    hostname: this.serviceName
                },
            };
            //this.sendMessage(message);
        }
    }
}

module.exports = (options) => new UP9Monitor(options);