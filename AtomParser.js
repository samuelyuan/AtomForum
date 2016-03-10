var Tokenizer = require('sentence-tokenizer');

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
            endDisplayLine = lineNumberProfile - 1;
        }
    });
    
    return {
        startLine: startDisplayLine,
        endLine: endDisplayLine
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
    
    sentence = sentence.replace(/[0-9]+s/g, "");
    sentence = sentence.replace(/1 hour ago/g, "");
    sentence = sentence.replace(/[0-9]+ hours ago/g, "");
    sentence = sentence.replace(/[0-9]+ minutes ago/g, "");
    sentence = sentence.replace(/[0-9]+ days ago/g, "");
    
    sentence = sentence.replace(/[0-9]+ replydeleted removed/g, "");
    sentence = sentence.replace(/[0-9]+ reply/g, "");
    sentence = sentence.replace(/[0-9]+ commentsshareloadingtop/g, "");
    sentence = sentence.replace(/besttopnewcontroversialoldrandomq&a/g, "");
    sentence = sentence.replace(/top [0-9]+ comments/g, "");
    //sentence = sentence.replace(/[0-9]+ show orted by/g, "");
    sentence = sentence.replace(/commentsshare/g, "");
    sentence = sentence.replace(/\(\)/g, "");
    sentence = sentence.replace(/\[score hidden\]/g, "");
    
    return sentence;
}

exports.getSentenceData = function(text)
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
                
                sentenceArr = sentence.split("\[\–\]");
                
                sentenceData.push(sentenceArr[0]);
                sentenceData.push(sentenceArr[1]);
            }
            else
            {
                sentence = sentence.replace("\[\–\]", "");
                
                //Add sentence to overall data
                sentenceData.push(sentence);
            }
        }
    });
    
    return sentenceData;
}

exports.getUserInfo = function(text) 
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
        //console.log("Array: " + arrayOfstr);
        var i = 0;
        while( i != arrayOfstr.length && (arrayOfstr[i] == "deleted" || sentence[i] == "removed" || arrayOfstr[i] == "")) {
            i++;
        }
        var a_user = arrayOfstr[i];
        //console.log("name: ",a_user);
        i++;
        var post = arrayOfstr[i];
        while (i != arrayOfstr.length) {
            i++;
            post = post + " " + arrayOfstr[i];
        }
        //console.log("\npost: ",post);
        
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

exports.getSummarizedText = function(sentenceData)
{
    var hiddenLines = [];
    var firstSentence = [];
    var notFstSentence = [];
    var lineNumber = 0;
    sentenceData.forEach(function(post) {
        var words = post.split(" ");
        
        if (words.length < 10)
        {
            hiddenLines.push(lineNumber);
            notFstSentence.push("deleted");
            firstSentence.push("");
        }
        else if (words.length >= 10) {
            //Remove extra whitespace
            post = post.replace(/\s+/g," ");
            
            //Split post into separate sentences
            //Use a tokenizer to ensure better results
            var tokenizer = new Tokenizer('');
            tokenizer.setEntry(post);
            var sentences = tokenizer.getSentences();
            
            //Save first sentence into one array
            //Remove username from the post information
            firstSentence.push(sentences[0].substring(sentences[0].indexOf(" ") + 1));
            
            var i=0;
            //console.log(sentences.length +"\n");
            
            //Get the rest of the post
            if (sentences.length <= 1) {
                //There's nothing else to show
                notFstSentence.push(null);
            }
            else {
                var count = 0;
                var substrcontext = " ";
                for (i = 1; i < sentences.length; i++) {
                    //if it's not an empty space
                    if (sentences[i].length > 1) {
                         count++;
                         substrcontext += sentences[i] + " ";
                    }
                }
                if (count == 0) {
                    //There's nothing else to show
                    notFstSentence.push(null);
                }
                else {
                    //Push the rest of the data
                    notFstSentence.push(substrcontext);
                }
            }
        }
        lineNumber++;
    });

    return {
        hiddenLines: hiddenLines,
        firstSentence: firstSentence,
        notFstSentence: notFstSentence
    };
}