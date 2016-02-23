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
    text.split("goldreply").forEach(function (sentence) {
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
                endDisplayLine = lineNumberProfile - 1;
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
    text.split("goldreply").forEach(function (sentence) {
        // throw away extra whitespace and non-alphanumeric characters
        //sentence = sentence.replace(/\s+/g, " ")
        //       .replace(/[^a-zA-Z0-9 ]/g, "");
                        
        sentence = cleanSentence(sentence);
        lineNumberProfile++;

         //Ignore anything that isn't an actual post
        if (lineNumberProfile >= lineMarkers.startLine 
            && lineNumberProfile <= lineMarkers.endLine)
        {   
            if (lineNumberProfile == lineMarkers.startLine)
            {
                //remove extra information before the start marker
                sentence = sentence.substring(sentence.indexOf("2ex; padding-right: 5px; }"));
                
                //remove the start marker 
                sentence = sentence.replace(/2ex; padding-right: 5px; }[0-9]+/g, "");
            }
            
            //Add sentence to overall data
            sentenceData.push(sentence);
        }
    });
    
    return sentenceData;
}

var getUserInfo = function(text) 
{
    var userMap = new Map();
    var newPostLines = []; //separate each user's posts with a line
    var count = 0;
    var lineNumberProfile = 0;
    
    //First find the start and end markers for displaying content
    lineMarkers = getStartEndLines(text);
    
    // split data into sentences using a period as a separator
    text.split("goldreply").forEach(function (sentence) {
        // throw away extra whitespace and non-alphanumeric characters
        sentence = sentence.replace(/\s+/g, " ")
                .replace(/[^a-zA-Z0-9 ]/g, "");
                                    
        sentence = cleanSentence(sentence);
                        
        lineNumberProfile++;
        newPostLines.push(lineNumberProfile);
        
        var arrayOfstr = sentence.split(" ");
        console.log("Array: " + arrayOfstr);
        var i = 0;
        while( i != arrayOfstr.length && (arrayOfstr[i] == "deleted" || sentence[i] == "removed" || arrayOfstr[i] == "")) {
            i++;
        }
        var a_user = arrayOfstr[i];
        console.log("name: ",a_user);
        i++;
        var post = arrayOfstr[i];
        while (i != arrayOfstr.length) {
            i++;
            post = post + " " + arrayOfstr[i];
        }
        console.log("\npost: ",post);
        
        if (userMap.has(a_user)) {
            userMap.get(a_user).push(post);
        }
        if (!userMap.has(a_user)) {
            userMap.set(a_user,[]);
            userMap.get(a_user).push(post);
                                    
        }
        //console.log("\nsize:", userMap.get(a_user).length);
        //console.log("\n");
    });
    
    return {
        userMap: userMap,
        newPostLines: newPostLines
    };
}

var cleanSentence = function(sentence)
{
    //remove anything that isn't actually part of the main content
    sentence = sentence.replace(/permalinksavereportgive/g, "");
    sentence = sentence.replace(/permalinksaveparentreportgive/g, "");
    sentence = sentence.replace(/load more comments/g, "");
    sentence = sentence.replace(/continue this thread/g, "");
    
    sentence = sentence.replace(/1 point/g, "");
    sentence = sentence.replace(/[0-9]+ points/g, "");
    
    sentence = sentence.replace(/1 child/g, "");
    sentence = sentence.replace(/[0-9]+ children/g, "");
    
    sentence = sentence.replace(/[0-9]+ replies/g, "");
    
    sentence = sentence.replace(/1 hour ago/g, "");
    sentence = sentence.replace(/[0-9]+ hours ago/g, "");
    sentence = sentence.replace(/[0-9]+ minutes ago/g, "");
    
    sentence = sentence.replace(/[0-9]+ replydeleted removed/g, "");
    sentence = sentence.replace(/[0-9]+ reply/g, "");
    sentence = sentence.replace(/[0-9]+ commentsshareloadingtop/g, "");
    sentence = sentence.replace(/sorted by: besttopnewcontroversialoldrandomq&a/g, "");
    sentence = sentence.replace(/top [0-9]+ commentsshow [0-9]+/g, "");
    sentence = sentence.replace(/commentsshareloading.../g, "");
    sentence = sentence.replace(/\(\)/g, "");
    sentence = sentence.replace(/\[score hidden\]/g, "");
    
    return sentence;
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
        var userData = getUserInfo(text);
        
        res.render('results', {
            sentenceData: sentenceData,
            newPostLines: userData.newPostLines
        });
    });
});

app.listen(3000);

console.log("Running at Port 3000");