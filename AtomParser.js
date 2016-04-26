var Tokenizer = require('sentence-tokenizer');
var SummaryTool = require('node-summary');
var sentiment = require('sentiment');

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

var cleanPost = function(sentence)
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

var getPostData = function(text)
{
    var postData = [];
    var lineNumberProfile = 0;

    //First find the start and end markers for displaying content
    lineMarkers = getStartEndLines(text);

    //Split the data into individual posts
    text.split("goldreply").forEach(function(post) {
        post = cleanPost(post);
        lineNumberProfile++;

         //Ignore anything that isn't an actual post
        if (lineNumberProfile >= lineMarkers.startLine
            && lineNumberProfile <= lineMarkers.endLine)
        {
            if (lineNumberProfile == lineMarkers.startLine)
            {
                //remove extra information before the start marker
                post = post.substring(post.indexOf("2ex; padding-right: 5px; }"));
                //remove the start marker
                post = post.replace(/2ex; padding-right: 5px; }[0-9]+/g, "");

                //Element 0 is the title
                //Element 1 is the first post
                sentenceArr = post.split("\[\–\]");
                postData.push(sentenceArr[0]);
                postData.push(sentenceArr[1]);
            }
            else
            {
                post = post.replace("\[\–\]", "");

                //Add sentence to overall data
                postData.push(post);
            }
        }
    });

    return postData;
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

        var wordArray = wholePost.split(" ");
        var usernameIndex = 0;
        var username = "";
        for (var i = 0; i < wordArray.length; i++)
        {
            if (wordArray[i] == "")
            {
                continue;
            }
            
            username = wordArray[i];
            username = username.replace(/\s+/g, "");
            username = username.replace("\[\–\]", "");
            usernameIndex = i;
            break;
        }
        
        var postContent = "";
        for (var i = usernameIndex + 1; i < wordArray.length; i++)
        {
            //get index of parent post
            if (wordArray[i].indexOf("permalinksavereportgive") > -1) {
                parentIndex.push(index);
                wordArray[i] = wordArray[i].replace(/permalinksavereportgive/g, "");
            }
            postContent = postContent + " " + wordArray[i];
        }
        
        //Use an array instead of a map
        //Put username in the first entry, post content in the second
        userData.push([username, postContent]);
    });
    return {
        userData: userData,
        parentIndex: parentIndex
    };
}

var getCondensedText = function(userData)
{
    var firstSentence = [];
    var notFstSentence = [];

    var getSentences = function(post)
    {
        //Use a tokenizer to ensure better results
        var tokenizer = new Tokenizer('');
        
        var sentences = [];
        //if not all whitepsace
        if (/\S/.test(post)) 
        {
            tokenizer.setEntry(post);
            sentences = tokenizer.getSentences();
        }
        
        return sentences;
    }
    
    var getWordCount = function(post)
    {
        var tokenizer = new Tokenizer('');
        tokenizer.setEntry(post);
        sentences = tokenizer.getSentences();
        
        var wordCount = 0;
        sentences.forEach(function(sent, index) {
            var tokens = tokenizer.getTokens(index);
            wordCount += tokens.length;
        });
        
        return wordCount;
    }
    
    var getRemainingSentences = function(sentences)
    {
        if (sentences.length <= 1) 
        {
            //There's nothing else to show
            return null;
        }
        
        var remainingSentences;
        var count = 0;
        var substrContext = "";
        for (var i = 1; i < sentences.length; i++) 
        {
            //if it's not an empty space
            if (sentences[i].length > 1) 
            {
                 count++;
                 substrContext += sentences[i] + " ";
            }
        }
        
        if (count == 0) 
        {
            //There's nothing else to show
            return null;
        }
       
        //normal case
        return substrContext;
    }
    
    userData.forEach(function(postArr, lineNumber) {
        post = postArr[1];
        
        var sentences = getSentences(post);
        var wordCount = getWordCount(post);
        
        //filter out posts that are too short
        var MAX_WORDS = 5;
        if (wordCount < MAX_WORDS)
        {
            firstSentence.push(null);
            notFstSentence.push(null);
            return;
        }
        
        //Remove extra whitespace
        post = post.replace(/\s+/g, " ");

        //Save first sentence into one array
        firstSentence.push(sentences[0]);
        //Save the remaining sentences into another array
        var remainingSentences = getRemainingSentences(sentences);
        notFstSentence.push(remainingSentences);
    });

    return {
        firstSentence: firstSentence,
        notFstSentence: notFstSentence
    };
}

// sum up all child posts for each parent
var getAllOriginalReplies = function(condensedData, parentIndex) {
    var originalRepliesArr = [];
    
    var firstSentence = condensedData.firstSentence;
    var notFstSentence = condensedData.notFstSentence;

    //Iterate through each parent post index
    for (var i = 0; i < parentIndex.length - 1; i++) {
        var tempArray = [];

        //Combine all the children posts for that parent
        for (var j = parentIndex[i] + 1; j < parentIndex[i + 1]; j++) {
            var tempStr = "";
            if (firstSentence[j] != null) 
            {
                tempStr += firstSentence[j];

                if (notFstSentence[j] != null) 
                {
                    tempStr += " " + notFstSentence[j];
                }

                //append a period to the end of the post if there isn't any punctuation
                var punctutation = ".!?";
                if (punctutation.indexOf(tempStr[tempStr.length - 1]) == -1 &&
                    punctutation.indexOf(tempStr[tempStr.length - 2]) == -1)
                {
                    tempStr += ".";
                }

                tempArray.push(tempStr);
            }
        }

        originalRepliesArr.push(tempArray);
    }

    return originalRepliesArr;
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

var getSummaryReplies = function(allPosts)
{
    var getArrayToStr = function(arr)
    {
        var tempStr = "";
        arr.forEach(function(currentStr) {
            tempStr += currentStr + "\n";
        }); 
        return tempStr;
    }
 
    var summaryArr = [];
    allPosts.forEach(function(replyArr) {
        var title = '';
        var content = '';
        
        //build content string by separating reply posts with a newline
        replyArr.forEach(function(eachPost) {
            content += eachPost + "\n";
        });
        
        //nothing to summarize
        if (replyArr.length == 0)
        {
            summaryArr.push([]);
            return;
        }
        
        //no need to summarize if under 250 chars
        if (content.length < 250)
        {
            summaryArr.push(replyArr);
            return;
        }  
        
        //summarize the content into a half each time until it is short enough
        //(i.e. less than x sentences)
        var newStr = content;
        var lengthSummary = replyArr.length;
        var newSummary = '';
        do {
            lengthSummary /= 2;
            newSummary = summarizeText(newStr, lengthSummary);
            newStr = getArrayToStr(newSummary);
        } while (lengthSummary > 10);

        summaryArr.push(newSummary);
        //getSummaryRatio(content, newSummary);    
    });

    return summaryArr;
}

var sortImportantParents = function(originalRepliesArr, parentIndex) {
    var summaryArr = getSummaryReplies(originalRepliesArr);
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

var getSentimentValues = function(originalRepliesArr)
{
    var sentimentValues = [];
    var positivePosts = [];
    var neutralPosts = [];
    var negativePosts = [];
    
    originalRepliesArr.forEach(function(reply) {
        var temp = [];

        var tempPos = [];
        var tempNeutral = [];
        var tempNegative = [];
        reply.forEach(function(post) {
            var result = sentiment(post);
              
            temp.push(result);
            //determine whether a post is positive, neutral, or negative
            if (result.score > 0)
            {
              tempPos.push(post);
            }
            else if (result.score == 0)
            {
              tempNeutral.push(post);
            }
            else if (result.score < 0)
            {
              tempNegative.push(post);
            }
        });
        
        sentimentValues.push(temp);
          
        positivePosts.push(tempPos);
        neutralPosts.push(tempNeutral);
        negativePosts.push(tempNegative);
    });
        
    return {
        sentimentArr: sentimentValues,
        positivePosts: positivePosts,
        neutralPosts: neutralPosts,
        negativePosts: negativePosts
    }
}

var combineSummaryReplies = function(sentimentValues, originalRepliesArr)
{        
    var getArrayToStr = function(arr)
    {
        var tempStr = "";
        arr.forEach(function(currentStr) {
            tempStr += currentStr + "\n";
        }); 
        return tempStr;
    }
    
    var summaryPos = getSummaryReplies(sentimentValues.positivePosts);
    var summaryNeutral = getSummaryReplies(sentimentValues.neutralPosts);
    var summaryNeg = getSummaryReplies(sentimentValues.negativePosts);
    
    var hit = [];
    for (var index in summaryPos) {
        for(var subindex in summaryPos) {
            for (var j in originalRepliesArr[index]) {
                if(originalRepliesArr[index][j].indexOf(summaryPos[index][subindex]) > -1){
                    var temp = [];
                    temp.push(parseInt(index));
                    temp.push(parseInt(j));
   ///                 temp.push(summaryPos[index][subindex]);
                    if (hit.indexOf(temp) == -1) {
                        hit.push(temp);
                    }
                }
            }
        }
        for(var subindex in summaryNeutral) {
            for (var j in originalRepliesArr[index]) {
                if(originalRepliesArr[index][j].indexOf(summaryNeutral[index][subindex]) > -1){
                    var temp = [];
                    temp.push(parseInt(index));
                    temp.push(parseInt(j));
     ///               temp.push(summaryNeutral[index][subindex]);
                    if (hit.indexOf(temp) == -1) {
                        hit.push(temp);
                    }
                }
            }
        }
        for(var subindex in summaryNeg) {
            for (var j in originalRepliesArr[index]) {
                if(originalRepliesArr[index][j].indexOf(summaryNeg[index][subindex]) > -1){
                    var temp = [];
                    temp.push(parseInt(index));
                    temp.push(parseInt(j));
         ///           temp.push(summaryNeg[index][subindex]);
                    if (hit.indexOf(temp) == -1) {
                        hit.push(temp);
                    }
                }
            }
        }
    }
    
    function sortNum(a,b) {
        if (a[0] > b[0]) {
            return 1;
        }
        else if (a[0] == b[0]) {
            if (a[1] < b[1]) {return -1;}
            if (a[1] > b[1]) {return 1;}
            else {return 0;}
        }
        else {
            return -1;
        }
    }
  
    hit.sort(sortNum);
    
    var uniqueHit = [];
    for (var i = 1; i < hit.length; ) {
        if (hit[i-1][0] == hit[i][0] && hit[i-1][1] == hit[i][1]) {
            hit.splice(i,1);
        }
        else {
            i++;
        }
    }
    
    console.log(hit);
    
    var hitString = [];
    for (var index in hit) {
        hitString.push(originalRepliesArr[(hit[index][0])][(hit[index][1])]);
    }
    console.log(hitString);
    
    var summaryReplies = [];
    for (var index in summaryPos)
    {
        var temp = [];    
        temp.push(getArrayToStr(summaryPos[index]));
        temp.push(getArrayToStr(summaryNeutral[index]));
        temp.push(getArrayToStr(summaryNeg[index]));
        summaryReplies.push(temp);
    }
    return summaryReplies;
}

exports.getDisplayData = function(text)
{
    var postData = getPostData(text);
    var userData = getUserInfo(postData);
    var condensedData = getCondensedText(userData.userData);
    var originalRepliesArr = getAllOriginalReplies(condensedData, userData.parentIndex);
    
    var newParentIndex = sortImportantParents(originalRepliesArr, userData.parentIndex);
    
    var sentimentValues = getSentimentValues(originalRepliesArr);
    var combinedReplies = combineSummaryReplies(sentimentValues, originalRepliesArr);

    return {
        postData: postData,
        userData: userData.userData,
        firstSentence: condensedData.firstSentence,
        notFstSentence: condensedData.notFstSentence,
        parentIndex: userData.parentIndex,
        originalReplies: originalRepliesArr,
        summaryArr: combinedReplies,
        newParentIndex: newParentIndex,
        sentimentValues: sentimentValues.sentimentArr
    }
}