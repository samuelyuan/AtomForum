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

    // Initialize the AtomParser (which includes loading the summarizer)
    atomParser.init().then(() => {
        // Proceed with the axios request only after the summarizer is loaded
        axios.get(req.query.url as string)
            .then(async function (response: AxiosResponse) {  // Make the callback async
                console.log("Status: " + response.status);
                const body = response.data;

                // Load the page into cheerio
                const $page = cheerio.load(body);
                const text = $page("body").text();

                try {
                    // Await the asynchronous function to get the display data
                    const displayData = await atomParser.getDisplayData(text);

                    // Render the results with the awaited displayData
                    res.render('results', {
                        displayData: displayData
                    });
                } catch (error) {
                    console.log("Error processing display data: ", error);
                    res.status(500).send("Error processing display data");
                }
            })
            .catch(function (error: Error) {
                console.log("Couldn't get page because of error: " + error);
                res.status(500).send("Couldn't fetch the page");
            });
    }).catch((error: Error) => {
        console.log("Error initializing AtomParser: ", error);
        res.status(500).send("Error initializing summarizer");
    });
});

app.listen(3000);

console.log("Running at Port 3000");
