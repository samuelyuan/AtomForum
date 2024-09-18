var cheerio = require("cheerio");
var path = require('path');

import axios, { AxiosResponse } from "axios";
import express from "express";

import { AtomParser } from "./AtomParser.js";

var app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

//use bootstrap
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public/fonts')));

app.get('/', function (req: express.Request, res: express.Response) {
    res.render('index');
});

app.get('/results', function (req: express.Request, res: express.Response) {
    var atomParser = new AtomParser();

    // download that page
    axios.get(req.query.url as string)
        .then(function (response: AxiosResponse) {
            console.log("Status: " + response.status);
            const body = response.data;

            // load the page into cheerio
            var $page = cheerio.load(body),
                text = $page("body").text();

            //get the data to display
            var displayData = atomParser.getDisplayData(text);

            res.render('results', {
                displayData: displayData
            });
        })
        .catch(function (error: Error) {
            console.log("Couldn't get page because of error: " + error);
            return;
        });
});

app.listen(3000);

console.log("Running at Port 3000");
