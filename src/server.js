var axios = require("axios");
var cheerio = require("cheerio");
var express = require("express");
var path = require('path');

var atomParser = require('./AtomParser.js');

var app = express();

// set the view engine to ejs
app.set('view engine', 'ejs');

//use bootstrap
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public/fonts')));

app.get('/', function(req, res) {
    res.render('index');
});

app.get('/results', function(req, res) {
    var dataString = "";

    // download that page
    axios.get(req.query.url)
        .then(function(response) {
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
        .catch(function(error) {
            console.log("Couldn’t get page because of error: " + error);
            return;
        });
});

app.listen(3000);

console.log("Running at Port 3000");
