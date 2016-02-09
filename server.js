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

        // split data into sentences using a period as a separator
        var sentenceData = [];
        
        var lineNumberProfile = 0;
        var startDisplayLine = 0;
        var endDisplayLine = 0;
        
        var isReddit = false;
        
        //First find the start and end markers for displaying content
        text.split(".").forEach(function (sentence) {
            sentence = sentence.replace(/\s+/g, " ")
                                .replace(/[^a-zA-Z0-9 ]/g, "");
            
            lineNumberProfile++;

            //For most online forums
            if (sentence.toLowerCase().indexOf("profile") > -1)
            {
                //The actual forum post data starts from here (line #), not from line #0. 
                if (startDisplayLine == 0)
                {
                    startDisplayLine = lineNumberProfile;
                }
            }
            
            //Usually placed at the end of a thread (non-reddit)
            if (sentence.toLowerCase().indexOf("login") > -1 || sentence.toLowerCase().indexOf("log in") > -1 )
            {
                //can't have an end without a start
                if (startDisplayLine != 0 && isReddit == false)
                {
                    endDisplayLine = lineNumberProfile;
                }
            }
            
            //Special case for reddit
            if (sentence.toLowerCase().indexOf("2ex paddingright 5px") > -1)
            {
                if (startDisplayLine == 0)
                {
                    startDisplayLine = lineNumberProfile;
                    isReddit = true;
                }
            }
            
            if (sentence.toLowerCase().indexOf("redditstatic") > -1)
            {
                if (endDisplayLine == 0)
                {
                    endDisplayLine = lineNumberProfile;
                }
            }
        });
        
        //Display the data
        lineNumberProfile = 0;
        text.split(".").forEach(function (sentence) {
             // throw away extra whitespace and non-alphanumeric characters
            sentence = sentence.replace(/\s+/g, " ")
                   .replace(/[^a-zA-Z0-9 ]/g, "");
        
            lineNumberProfile++;
            
             //Ignore anything that isn't an actual post
            if (lineNumberProfile >= startDisplayLine && lineNumberProfile <= endDisplayLine)
            {
                //Add sentence to overall data
                sentenceData.push(sentence);
            }
        });
        
        res.render('results', {
            sentenceData: sentenceData
        });
    });
    
});

app.listen(3000);

console.log("Running at Port 3000");