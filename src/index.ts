import {getExpressMiddleware} from "./plugins/express-plugin";
import {lowerCaseObjectKeys} from "./utils";
import {UP9HttpConnector} from "./http-connector";

const POLL_INTERVAL_MS = 5000;
class UP9Monitor {
    private env: any;
    private serviceName: any;
    private tappingSourceId: string;
    private httpConnector: any;
    private ownState: any;
    private isDebug: boolean;
    private blacklist: any;
    private hostnameOverrides: any;

    constructor(options) {
        this.env = options.up9Server;
        this.serviceName = options.serviceName;
        this.tappingSourceId = "nodejs-" + this.serviceName;
        this.httpConnector = new UP9HttpConnector(this.env, options.clientId, options.clientSecret);
        this.isDebug = options.isDebug ?? false;
        this.hostnameOverrides = options.hostnameOverrides ?? {};
        setInterval(this.poll, POLL_INTERVAL_MS);

        this.requestLogger(require("http"), "http");
        this.requestLogger(require("https"), "https");
    }

    poll = async () => {
        try {
            await this.httpConnector.postTappingSource(this.tappingSourceId);
            const state = await this.httpConnector.getTappingState();
            this.ownState = state.filter(s => s.id == this.tappingSourceId)[0];
            if (this.ownState?.shouldTap && this.ownState.model) {
                this.blacklist = await this.httpConnector.getModelBlacklist(this.ownState.model);
            } else {
                this.blacklist = [];
            }
            if (this.isDebug)
                console.log(`blacklist = ${this.blacklist}`);
        } catch (e) {
            if (this.isDebug)
                console.error("error polling", e);
        }
    }

    sendMessage = async (message) => {
        try {
            if (this.ownState?.shouldTap && this.ownState.model) {
                message = this.replaceOverridenUrlsInMessage(message);
                if (!this.isRequestUrlBlacklisted(message.request.request_url))
                    await this.httpConnector.sendTrafficMessage(this.ownState.model, message);
                else if (this.isDebug)
                    console.log(`ignoring blacklisted request to ${message.request.request_url}`);
            }
        } catch (e) {
            if (this.isDebug)
                console.error("error sending message to dumper", e, message, this.ownState);
        }

    }

    private isRequestUrlBlacklisted = (url: string) => {
        for (const blacklistRegex of this.blacklist ?? []) {
            try {
                if (url.match(blacklistRegex)) {
                    return true;
                }
            } catch (e) {
                if (this.isDebug)
                    console.error(`encountered bad blacklist regex: ${blacklistRegex}`, e);
            }
        }
        return false;
    }

    express = () => {
        return getExpressMiddleware(this.sendMessage, this.serviceName);
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

    private replaceOverridenUrlsInMessage(message) {
        const requestOverrideHostname = this.hostnameOverrides[message.request.hostname];
        if (requestOverrideHostname) {
            message.request.hostname = requestOverrideHostname;
            const parsedUrl = new URL(message.request.request_url);
            parsedUrl.hostname = requestOverrideHostname;
            message.request.request_url = parsedUrl.href;
        }
        message.response.hostname = this.hostnameOverrides[message.response.hostname] ?? message.response.hostname;
        return message;
    }

    private processOutgoingMessage = (request, response, responseBody, protocol, startUnixTimestamp, requestDuration) => {
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
                    headers: lowerCaseObjectKeys(requestHeaders),
                    body: {
                        "truncated": false,
                        "as_bytes": requestBody ? Buffer.from(requestBody).toString('base64') : ""
                    },
                    request_url: url,
                    hostname: request.hostname,
                    started_at_unix: startUnixTimestamp / 1000
                },
                response: {
                    headers: lowerCaseObjectKeys({...response.headers, ":status": response.statusCode.toString(), 'duration_ms': requestDuration.toString()}),
                    body: {
                        "truncated": false,
                        "as_bytes": responseBody ? Buffer.from(responseBody).toString('base64') : ""
                    },
                    duration_ms: requestDuration,
                    hostname: this.serviceName
                },
            };
            this.sendMessage(message);
        }
    }
}

module.exports = (options) => new UP9Monitor(options);