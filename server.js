var request = require("request"),
	cheerio = require("cheerio"),
    express = require("express");
var app     = express();
var path = require ('path');
var atomParser = require('./AtomParser.js');

// set the view engine to ejs
app.set('view engine', 'ejs');

app.get('/',function(req,res){
     res.render('index');
});

app.get('/results',function(req, res){
    var dataString = "";
    
    // download that page
    request(req.query.url, function (error, response, body) {
        if (error) {
            console.log("Couldn’t get page because of error: " + error);
            return;
        }

        // load the page into cheerio
        var $page = cheerio.load(body),
            text = $page("body").text();

        //get the data to display        
        var sentenceData = atomParser.getSentenceData(text);
        var userData = atomParser.getUserInfo(text);
        var summaryData = atomParser.getSummarizedText(sentenceData);
        
        res.render('results', {
            sentenceData: sentenceData,
            newPostLines: userData.newPostLines,
            hiddenLines: summaryData.hiddenLines,
            firstSentence: summaryData.firstSentence,
            notFstSentence: summaryData.notFstSentence,
        });
    });
});

app.listen(3000);

console.log("Running at Port 3000");