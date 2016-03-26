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
  //  sentence = sentence.replace(/permalinksavereportgive/g, "");
    sentence = sentence.replace(/permalinksaveparentreportgive/g, "");
    
    sentence = sentence.replace(/load more comments/g, "");
    sentence = sentence.replace(/continue this thread/g, "");
    
    sentence = sentence.replace(/1 point/g, "");
    sentence = sentence.replace(/[0-9]+ points/g, "");
    
    sentence = sentence.replace(/1 child/g, "");
    sentence = sentence.replace(/[0-9]+ children/g, "");
    sentence = sentence.replace(/([0-9]+ren)/g, ""); 
    
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
    sentence = sentence.replace(/commentsshare/g, "");
    sentence = sentence.replace(/\(\)/g, "");
    sentence = sentence.replace(/\[score hidden\]/g, "");
    
    return sentence;
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

var getUserInfo = function(postData) 
{
    var userData = [];
    var parentindex = [];
    postData.forEach(function(wholePost, index) {
        //Special case: title post
        if (index == 0)
        {   
            //format: [post title] ([link]) submitted by [poster name]
            postTitle = wholePost.substring(0, wholePost.indexOf(")") + 1);

            userData.push(postTitle);
            return;
        }

        var arrayOfstr = wholePost.split(" ");
        var i = 0;
        while( i != arrayOfstr.length && (arrayOfstr[i] == "deleted" || arrayOfstr[i] == "removed" || arrayOfstr[i] == "")) {
            i++;
        }
        var a_user = arrayOfstr[i];
        a_user = a_user.replace(/\s+/g, "");
        a_user = a_user.replace("\[\–\]", "");
        i++;
        
        var postContent = "";
        while (i != arrayOfstr.length) {
            //get index of parent post
            if (arrayOfstr[i].indexOf("permalinksavereportgive") > -1) {
                parentindex.push(index);
                arrayOfstr[i] = arrayOfstr[i].replace(/permalinksavereportgive/g, "");
            }
            postContent = postContent + " " + arrayOfstr[i];
            i++;
        }
        //Use an array instead of a map
        //Put username in the first entry, post content in the second
        userData.push([a_user, postContent]);
    });
    return {
        userData: userData,
        parentindex:parentindex
    };
}

var getSummarizedText = function(userData)
{
    var firstSentence = [];
    var notFstSentence = [];
    
    //Use a tokenizer to ensure better results
    var tokenizer = new Tokenizer('');
    
    userData.forEach(function(postArr, lineNumber) {
        post = postArr[1];
        var wordCount = 0;
        if (/\S/.test(post)) {
            tokenizer.setEntry(post);
            var sentences = tokenizer.getSentences();
            sentences.forEach(function(sent, index) {
                var tokens = tokenizer.getTokens(index);
                wordCount += tokens.length;
            });
        }
                     
        var MAX_WORDS = 5;
        if (wordCount < MAX_WORDS)
        {
            firstSentence.push(null);
            notFstSentence.push(null);
        }
        else if (wordCount >= MAX_WORDS)
        {
            //Remove extra whitespace
            post = post.replace(/\s+/g," ");
                    
            //Get the rest of the post
            var remainingSentences;
            if (sentences.length <= 1) {
                //There's nothing else to show
                remainingSentences = null;
            }
            else {
                var count = 0;
                var substrcontext = " ";
                for (var i = 1; i < sentences.length; i++) {
                    //if it's not an empty space
                    if (sentences[i].length > 1) {
                         count++;
                         substrcontext += sentences[i] + " ";
                    }
                }
                if (count == 0) {
                    //There's nothing else to show
                    remainingSentences = null;
                }
                else {
                    //Push the rest of the data
                    remainingSentences = substrcontext;
                }
            }
            
            //Save first sentence into one array
            firstSentence.push(sentences[0]);
            //Save the remaining sentences into another array
            notFstSentence.push(remainingSentences);
        }
    });

    return {
        firstSentence: firstSentence,
        notFstSentence: notFstSentence
    };
}

exports.getDisplayData = function(text)
{
    var sentenceData = getSentenceData(text);
    var userData = getUserInfo(sentenceData);
    var summaryData = getSummarizedText(userData.userData);
        
    return {
        sentenceData: sentenceData,
        userData: userData.userData,
        firstSentence: summaryData.firstSentence,
        notFstSentence: summaryData.notFstSentence,
        parentIndex:  userData.parentindex
    }
}