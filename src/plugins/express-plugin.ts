import {formatRequestHeaders} from "../utils";

function getResponseHeaders(responseHeaderString) {
    let headers = {};
    const splitHeaderString = responseHeaderString.split("\r\n")
    for (const headerPairString of splitHeaderString.slice(1, splitHeaderString.length)) {
        const [headerName, headerValue] = headerPairString.split(": ");
        if (headerName)
            headers[headerName] = headerValue;
    }
    return headers;
}

const extractUp9MessageFromExpress = (req, res, responseContents, serviceName, startUnixTimestamp, requestDurationMs) => {
    const reqHeaders = {...req.headers};
    reqHeaders[':method'] = req.method;
    reqHeaders[':path'] = req.path;
    reqHeaders[':authority'] = req.hostname;
    reqHeaders[':scheme'] = req.protocol;
    reqHeaders['x-up9-destination'] = serviceName;
    const resHeaders = getResponseHeaders(res._header);
    resHeaders[':status'] = res.statusCode.toString();
    resHeaders['duration_ms'] = requestDurationMs.toString();
    return {
            request: {
                headers: formatRequestHeaders(reqHeaders),
                body: {
                    "truncated": false,
                    "as_bytes": req.body ? Buffer.from(JSON.stringify(req.body)).toString('base64') : ""
                },
                request_url: `${req.protocol}://${serviceName}${req.originalUrl}`,
                hostname: serviceName,
                started_at_unix: startUnixTimestamp / 1000
            },
            response: {
                headers: formatRequestHeaders(resHeaders),
                body: {
                    "truncated": false,
                    "as_bytes": responseContents
                },
                duration_ms: requestDurationMs,
                hostname: ""
            },
    };
}

const sendToUp9 = (req, res, responseContents, onRequestCallback, serviceName, startUnixTimestamp, requestDurationMs) => {
    const message = extractUp9MessageFromExpress(req, res, responseContents, serviceName, startUnixTimestamp, requestDurationMs);
    onRequestCallback(message);
}

export const getExpressMiddleware = (onRequestCallback, serviceName) => {
    return function (req, res, next) {
        const original_write = res.write;
        const original_end = res.end;
        const chunks = [];
        const startUnixTimestamp = + new Date();

        res.write = function(chunk) {
            chunks.push(chunk);
            original_write.apply(res, arguments);
        };
        res.end = function(chunk) {
            const requestDurationMs = (+ new Date()) - startUnixTimestamp
            if (chunk)
                chunks.push(chunk);
            original_end.apply(res, arguments);
            try {
                let responseContents;
                if (chunks.length > 0 && typeof chunks[0] == 'string') {
                    responseContents = Buffer.from(chunks.join("")).toString('base64');
                } else {
                    responseContents = Buffer.concat(chunks).toString('base64');
                }
                sendToUp9(req, res, responseContents, onRequestCallback, serviceName, startUnixTimestamp, requestDurationMs);
            } catch (error) {
                console.error('error sending to up9', error);
            }
        };
        next();
    }
}