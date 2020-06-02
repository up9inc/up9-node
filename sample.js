const express = require("express");
const axios = require("axios");
const request = require("request");

const up9Monitor = require("./lib")({
    "up9Server": "rami-dev.dev.testr.io",
    "serviceName": "test",
    "clientId": "xXsb6OS9o83307lhIGRO1nd1V46Vx5CZ",
    "clientSecret": "IRr3Rbh-FTecTw5zKQdKE13IR4doXlMK",
    "isDebug": true
});


const app = express();
app.use(express.json());
app.use(up9Monitor.express());

let papersRouter = express.Router();

papersRouter.get('/', (req, res) => {
    // axios.get("https://httpbin.org/get?test=11111")
    //     .then(() => {
    //         // console.log(`sent request via axios to https://httpbin.org/get`);
    //     });
    // axios.post("https://httpbin.org/post", {test:"aaa", thing:5})
    //     .then(() => {
    //         // console.log(`sent request via axios to https://httpbin.org/post`);
    //     });

    res.status(200).send({"status": "good", someVal: Math.random() * 10000, lol: "aa"});
});
papersRouter.get('/test', (req, res) => {
    throw new Error("lol");
    res.status(200).send();
});

app.use(papersRouter);

function sendRequests() {
    request('http://www.google.com', {}, function (error, response, body) {
        //console.log('statusCode:', response && response.statusCode);
    });
    request.post('https://httpbin.org/status/500?test=lol', {},function (error, response, body) {
        //console.log('statusCode:', response && response.statusCode);
    });
    request.post('https://httpbin.org/post',{json: {lol:5}}, function (error, response, body) {
        //console.log('statusCode:', response && response.statusCode);
        //console.log('body:', body)
    });

    setTimeout(() => {sendRequests()}, 3000);
}
//sendRequests();

const appPort = 3000;



app.listen(appPort, () => console.log(`Running server on port ${appPort}`));


