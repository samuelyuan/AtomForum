var request = require("request"),
	cheerio = require("cheerio"),
    express = require("express");
var app     = express();
var path = require ('path');
    
// set the view engine to ejs
app.set('view engine', 'ejs');

app.get('/',function(req,res){
     res.render('index');
});

var isWordInSentence = function(sentence, word)
{
    return sentence.toLowerCase().indexOf(word) > -1;
}

var getStartEndLines = function(text)
{
    var lineNumberProfile = 0;
    var startDisplayLine = 0;
    var endDisplayLine = 0;
        
    var isReddit = false;
    
    // split data into sentences using a period as a separator
    text.split(".").forEach(function (sentence) {
        sentence = sentence.replace(/\s+/g, " ")
                            .replace(/[^a-zA-Z0-9 ]/g, "");

        lineNumberProfile++;

        //For most online forums
        if (isWordInSentence(sentence, "profile"))
        {
            //The actual forum post data starts from here (line #), not from line #0. 
            if (startDisplayLine == 0)
            {
                startDisplayLine = lineNumberProfile;
            }
        }

        //Usually placed at the end of a thread (non-reddit)
        if (isWordInSentence(sentence, "login") || isWordInSentence(sentence, "log in"))
        {
            //can't have an end without a start
            if (startDisplayLine != 0 && isReddit == false)
            {
                endDisplayLine = lineNumberProfile;
            }
        }

        //Special case for reddit
        if (isWordInSentence(sentence, "2ex paddingright 5px"))
        {
            if (startDisplayLine == 0)
            {
                startDisplayLine = lineNumberProfile;
                isReddit = true;
            }
        }

        if (isWordInSentence(sentence, "redditstatic"))
        {
            if (endDisplayLine == 0)
            {
                endDisplayLine = lineNumberProfile;
            }
        }
    });
    
    return {
        startLine: startDisplayLine,
        endLine: endDisplayLine
    };
}

var getSentenceData = function(text)
{
    var sentenceData = [];
    var lineNumberProfile = 0;
    
    //First find the start and end markers for displaying content
    lineMarkers = getStartEndLines(text);
    
    // split data into sentences using a period as a separator
    text.split(".").forEach(function (sentence) {
         // throw away extra whitespace and non-alphanumeric characters
        sentence = sentence.replace(/\s+/g, " ")
               .replace(/[^a-zA-Z0-9 ]/g, "");

        lineNumberProfile++;

         //Ignore anything that isn't an actual post
        if (lineNumberProfile >= lineMarkers.startLine 
            && lineNumberProfile <= lineMarkers.endLine)
        {
            //Add sentence to overall data
            sentenceData.push(sentence);
        }
    });
    
    return sentenceData;
}

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
        var sentenceData = getSentenceData(text);
        
        res.render('results', {
            sentenceData: sentenceData
        });
    });
});

app.listen(3000);

console.log("Running at Port 3000");