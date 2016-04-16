var Tokenizer = require('sentence-tokenizer');
var SummaryTool = require('node-summary');

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

    sentence = sentence.replace(/1 point/g, "");
    sentence = sentence.replace(/[0-9]+ points/g, "");

    sentence = sentence.replace(/1 child/g, "");
    sentence = sentence.replace(/[0-9]+ children/g, "");
    sentence = sentence.replace(/([0-9]+ren)/g, "");

    sentence = sentence.replace(/[0-9]+ replies/g, "");

    sentence = sentence.replace(/[0-9]+s/g, "");
    sentence = sentence.replace(/[0-9]+ minutes ago/g, "");
    sentence = sentence.replace(/1 hour ago/g, "");
    sentence = sentence.replace(/[0-9]+ hours ago/g, "");
    sentence = sentence.replace(/1 day ago/g, "");
    sentence = sentence.replace(/[0-9]+ days ago/g, "");
    sentence = sentence.replace(/1 month ago/g, "");
    sentence = sentence.replace(/[0-9]+ months ago/g, "");

    sentence = sentence.replace(/top [0-9]+ comments/g, "");
    sentence = sentence.replace(/commentsshare/g, "");
    sentence = sentence.replace(/load more comments/g, "");
    sentence = sentence.replace(/continue this thread/g, "");

    sentence = sentence.replace(/[0-9]+ replydeleted removed/g, "");
    sentence = sentence.replace(/[0-9]+ reply/g, "");
    sentence = sentence.replace(/[0-9]+ commentsshareloadingtop/g, "");

    sentence = sentence.replace(/besttopnewcontroversialoldrandomq&a/g, "");

    sentence = sentence.replace(/\[\+\]/g, "");
    sentence = sentence.replace(/\[deleted\]/g, "");
    sentence = sentence.replace(/\[removed\]/g, "");
    sentence = sentence.replace(/\(\)/g, "");
    sentence = sentence.replace(/\[score hidden\]/g, "");
    sentence = sentence.replace(/comment score below threshold/g, "");

    return sentence;
}

var getSentenceData = function(text)
{
    var sentenceData = [];
    var lineNumberProfile = 0;

    //First find the start and end markers for displaying content
    lineMarkers = getStartEndLines(text);

    //Split the data into individual posts
    text.split("goldreply").forEach(function(sentence) {
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

                //Element 0 is the title
                //Element 1 is the first post
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
    var parentIndex = [];
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
        while( i != arrayOfstr.length && arrayOfstr[i] == "") {
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
                parentIndex.push(index);
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
        parentIndex: parentIndex
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
        //filter out posts that are too short
        if (wordCount < MAX_WORDS)
        {
            firstSentence.push(null);
            notFstSentence.push(null);
        }
        else if (wordCount >= MAX_WORDS)
        {
            //Remove extra whitespace
            post = post.replace(/\s+/g, " ");

            //Get the rest of the post
            var remainingSentences;
            if (sentences.length <= 1) {
                //There's nothing else to show
                remainingSentences = null;
            }
            else {
                var count = 0;
                var substrContext = "";
                for (var i = 1; i < sentences.length; i++) {
                    //if it's not an empty space
                    if (sentences[i].length > 1) {
                         count++;
                         substrContext += sentences[i] + " ";
                    }
                }
                if (count == 0) {
                    //There's nothing else to show
                    remainingSentences = null;
                }
                else {
                    //Push the rest of the data
                    remainingSentences = substrContext;
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

// sum up all child posts for each parent
var getAllChildPosts = function(firstSentence, notFstSentence, parentIndex) {
    var sumOfChildren = [];

    //Iterate through each parent post index
    for (var i = 0; i < parentIndex.length - 1; i++) {
        var a_child = "";

        //Combine all the children posts for that parent
        for(var j = parentIndex[i] + 1; j < parentIndex[i + 1]; j++) {
            if (firstSentence[j] != null) {
                a_child += firstSentence[j];

                if (notFstSentence[j] != null) {
                    a_child += " " + notFstSentence[j];
                }

                //append a period to the end of the post if there isn't any punctuation
                var punctutation = ".!?";
                if (punctutation.indexOf(a_child[a_child.length - 1]) == -1 &&
                    punctutation.indexOf(a_child[a_child.length - 2]) == -1)
                {
                    a_child += ".";
                }

                a_child += "\n";
            }
        }

        sumOfChildren.push(a_child);
    }

    return sumOfChildren;
}


//Helper wrapper function to summarize a block of text
var summarizeText = function(content, numSentences)
{
    var sortedArr = [];
    SummaryTool.getSortedSentences(content, numSentences, function(err, sorted_sentences) {
        if(err) {
            console.log("There was an error.");
            return [];
        }

        for (var index in sorted_sentences)
        {
            sortedArr.push(sorted_sentences[index]);
        }
    });

    return sortedArr;
}

//Calculate how effective the summary is
//Higher summary ratio is better
var getSummaryRatio = function(content, newSummaryArr)
{
    var summaryLength = 0;
    for (var index in newSummaryArr)
    {
        summaryLength += newSummaryArr[index].length;
    }

    console.log("Original Content length: " + content.length);
    console.log("Summary length: " + summaryLength);
    console.log("Summary Ratio: " + (100 - (100 * (summaryLength / content.length))).toFixed(0) + "%");
    console.log();
}

var getSummaryReplies = function(sumChildPosts)
{
    var originalArr = []
    var summaryArr = [];

    sumChildPosts.forEach(function(reply) {
        var title = '';
        var content = '';

        //Split the original reply into separate sentences
        var tokenizer = new Tokenizer('');
        var sentences = [];
        tokenizer.setEntry(reply);
        if (/\S/.test(reply)) {
            //sentences = tokenizer.getSentences();
            sentences = reply.split("\n");

            //build content string by separating reply posts with a newline
            for (var index in sentences)
            {
                content += sentences[index] + "\n";
            }
        }
        originalArr.push(sentences);

        //nothing to summarize
        if (sentences.length == 0)
        {
            summaryArr.push([]);
        }
        else
        {
            //no need to summarize if under 250 chars
            if (content.length < 250)
            {
                summaryArr.push(sentences);
            }
            else
            {
                var lengthSummary = sentences.length;

                var newSummary = '';
                var newStr = content;

                //summarize the content into a half each time until it is short enough
                do {
                    lengthSummary /= 2;
                    newSummary = summarizeText(newStr, lengthSummary);

                    newStr = '';
                    for (var index in newSummary)
                    {
                        newStr += newSummary[index] + "\n";
                    }
                } while (lengthSummary > 10);

                summaryArr.push(newSummary);
                getSummaryRatio(content, newSummary);
            }
        }
    });

    return {
        originalArr: originalArr,
        summaryArr: summaryArr
    };
}

var sortImportantParents = function(summaryArr, parentIndex) {
    var newParentIndex = [];
    var i;
    for(i=0; i<parentIndex.length-1; i++) {
        var j = i+1;
        if (parentIndex[i] + 1 == parentIndex[j]) { // No children
            newParentIndex.push(-1);
        }
        else if (summaryArr[i].length == 0) { // No child left after summarization
            newParentIndex.push(-1);
        }
        else { // Get child before and after summarization
            newParentIndex.push(parentIndex[i]);
        }
    }
    // Check the last index in parentIndex
    newParentIndex.push(-1);

    return newParentIndex;
}


exports.getDisplayData = function(text)
{
    var sentenceData = getSentenceData(text);
    var userData = getUserInfo(sentenceData);
    var summaryData = getSummarizedText(userData.userData);
    var sumChildPosts = getAllChildPosts(summaryData.firstSentence, summaryData.notFstSentence, userData.parentIndex);
    var summaryReplies = getSummaryReplies(sumChildPosts);
    var newParentIndex = sortImportantParents(summaryReplies.summaryArr, userData.parentIndex);

    return {
        sentenceData: sentenceData,
        userData: userData.userData,
        firstSentence: summaryData.firstSentence,
        notFstSentence: summaryData.notFstSentence,
        parentIndex: userData.parentIndex,
        sumChildPosts: summaryReplies.originalArr,
        summaryArr: summaryReplies.summaryArr,
        newParentIndex: newParentIndex
    }
}
