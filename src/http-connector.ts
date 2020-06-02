const axios = require("axios");
const qs = require("querystring")


export class UP9HttpConnector {
    private envUrl: any;
    private trccUrl: string;
    private trafficDumperUrl: string;
    private clientId: any;
    private tokenUrl: string;
    private clientSecret: any;
    private token: any;
    private tokenExpiresAt: number;
    
    constructor(envUrl, clientId, clientSecret) {
        this.envUrl = envUrl;
        this.trccUrl = "https://trcc." + envUrl;
        this.trafficDumperUrl = "https://traffic." + envUrl;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.tokenUrl = `https://auth.${this.envUrl}/auth/realms/testr/protocol/openid-connect/token`;
    }

    async postTappingSource(tappingSourceId) {
        const url = this.trccUrl + "/tapping/state";
        const response = await axios.post(url, {data:[{
            id: tappingSourceId,
            instancesCount: 1,
            instance_id: tappingSourceId,
            type: "nodejs-sdk"
        }]}, {headers: await this.getRequestHeader()});
        return response.data;
    }

    getTappingState = async () => {
        const response = await axios.get(`${this.trccUrl}/tapping/state`, {headers: await this.getRequestHeader()});
        return response.data;
    }

    renewToken = async () => {
        const body = qs.stringify({grant_type: 'client_credentials', client_id: this.clientId, client_secret: this.clientSecret});
        const tokenResponse = (await axios.post(this.tokenUrl, body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })).data;
        this.token = tokenResponse.access_token;
        this.tokenExpiresAt = (+ new Date()) + (tokenResponse.expires_in * 1000) - 10000;
    }


    sendTrafficMessage = async (modelId, message) => {
        const messageBody = {
            type: 'collector',
            data: message
        }
        const response = await axios.post(`${this.trafficDumperUrl}/${modelId}`, messageBody, {headers: await this.getRequestHeader()});
        return response.data;
    };

    getRequestHeader = async () => {
        if (this.token == null || this.tokenExpiresAt > (+ new Date())) {
            await this.renewToken();
        }
        return {
            "Authorization": `bearer ${this.token}`
        };
    }
}