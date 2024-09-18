import Tokenizer from './tokenizer/tokenizer.js';
import Sentiment from 'sentiment';
import summaryTool from './summary/summary.js';

export type NumberStringTuple = [number, string];

interface PostData {
    title: string;
    comments: string[];
}

interface UserInfo {
    userData: string[][];
    parentIndex: number[];
}

export interface CondensedText {
    firstSentence: (string|null)[];
    notFstSentence: (string|null)[];
}

interface SentimentValue {
    score: number;
}

interface SentimentValuePost {
    sentimentArr: SentimentValue[][];
    positivePosts: string[][];
    neutralPosts: string[][];
    negativePosts: string[][];
}

export class AtomParser {
    sentiment: Sentiment;
    tokenizer: Tokenizer;

    constructor() {
        this.sentiment = new Sentiment();
        //Use a tokenizer to ensure better results
        this.tokenizer = new Tokenizer('');
    }

    isWordInSentence(sentence: string, word: string): boolean {
        return sentence.toLowerCase().indexOf(word) > -1;
    }

    getStartEndLines(text: string) {
        var lineNumberProfile = 0;
        var startDisplayLine = 0;
        var endDisplayLine = 0;

        var isReddit = false;

        // split data into posts
        text.split("goldreply").forEach((sentence) => {
            sentence = sentence.replace(/\s+/g, " ")
                .replace(/[^a-zA-Z0-9 ]/g, "");

            lineNumberProfile++;

            //For most online forums
            if (this.isWordInSentence(sentence, "profile")) {
                //The actual forum post data starts from here (line #), not from line #0.
                if (startDisplayLine == 0) {
                    startDisplayLine = lineNumberProfile;
                }
            }

            //Usually placed at the end of a thread (non-reddit)
            if (this.isWordInSentence(sentence, "login") || this.isWordInSentence(sentence, "log in")) {
                //can't have an end without a start
                if (startDisplayLine != 0 && isReddit == false) {
                    endDisplayLine = lineNumberProfile;
                }
            }

            //Special case for reddit
            if (this.isWordInSentence(sentence, "2ex paddingright 5px")) {
                if (startDisplayLine == 0) {
                    startDisplayLine = lineNumberProfile;
                    isReddit = true;
                }
            }

            if (this.isWordInSentence(sentence, "redditstatic")) {
                endDisplayLine = lineNumberProfile - 1;
            }
        });

        return {
            startLine: startDisplayLine,
            endLine: endDisplayLine
        };
    }

    //remove anything that isn't actually part of the main content
    cleanPost(originalPost: string): string {
        var stringsToFind = [/permalinksaveparentreportgive/g,
            /1 point/g, /[0-9]+ points/g,
            /1 child/g, /[0-9]+ children/g, /([0-9]+ren)/g, /[0-9]+ replies/g,
            /[0-9]+s/g, /[0-9]+ minutes ago/g,
            /1 hour ago/g, /[0-9]+ hours ago/g,
            /1 day ago/g, /[0-9]+ days ago/g,
            /1 month ago/g, /[0-9]+ months ago/g,
            /top [0-9]+ comments/g, /commentsshare/g, /load more comments/g, /continue this thread/g,
            /[0-9]+ replydeleted removed/g,
            /[0-9]+ reply/g,
            /[0-9]+ commentsshareloadingtop/g,
            /besttopnewcontroversialoldrandomq&a/g,
            /\[\+\]/g,
            /\[deleted\]/g,
            /\[removed\]/g,
            /\(\)/g,
            /\[score hidden\]/g, /comment score below threshold/g
        ];

        var newPost = originalPost;
        stringsToFind.forEach((findString) => {
            //remove all occurences of this string
            newPost = newPost.replace(findString, "");
        });

        return newPost;
    }

    getPostData(text: string): PostData {
        var postData: string[] = [];
        var lineNumberProfile = 0;
        var lineMarkers = this.getStartEndLines(text);

        var getTitlePost = function(originalPost: string) {
            var newPost = originalPost;

            // console.log(newPost);

            //remove extra information before the start marker
            newPost = newPost.substring(newPost.indexOf("2ex; padding-right: 5px; }"));
            //remove the start marker
            var startMarker = /2ex; padding-right: 5px; }[0-9]+/g;
            newPost = newPost.replace(startMarker, "");

            //Element 0 is the title
            //Element 1 is the first post
            var newPostArr = newPost.split("\[\–\]");

            return {
                titleStr: newPostArr[0],
                firstPost: newPostArr[1]
            };
        }

        var getRegularPost = function(originalPost: string): string {
            var newPost = originalPost;
            return newPost.replace("\[\–\]", "");
        }

        //Split the data into individual posts
        var titleStr: string = "";
        text.split("goldreply").forEach((currentPost) => {
            var post = this.cleanPost(currentPost);
            lineNumberProfile++;

            //Ignore anything that isn't an actual post
            if (lineNumberProfile >= lineMarkers.startLine &&
                lineNumberProfile <= lineMarkers.endLine) {
                if (lineNumberProfile == lineMarkers.startLine) {
                    var titlePost = getTitlePost(post);

                    titleStr = titlePost.titleStr;
                    postData.push(titlePost.firstPost);
                } else {
                    post = getRegularPost(post);

                    postData.push(post);
                }
            }
        });

        return {
            title: titleStr,
            comments: postData,
        }
    }

    getUserInfo(postData: PostData): UserInfo {
        var userData: string[][] = [];
        var parentIndex: number[] = [];
        //Special case: title post
        //format: [post title] ([link]) submitted by [poster name]
        var postTitle = postData.title.substring(0, postData.title.indexOf(")") + 1);
        userData.push([postTitle]);

        postData.comments.forEach((wholePost: string, index: number) => {
            var wordArray: string[] = wholePost.split(" ");
            var usernameIndex: number = 0;
            var username: string = "";
            for (var i = 0; i < wordArray.length; i++) {
                if (wordArray[i] == "") {
                    continue;
                }

                username = wordArray[i];
                username = username.replace(/\s+/g, "");
                username = username.replace("\[\–\]", "");
                usernameIndex = i;
                break;
            }

            var postContent: string = "";
            for (var i = usernameIndex + 1; i < wordArray.length; i++) {
                //get index of parent post
                if (wordArray[i].indexOf("permalinksavereportgive") > -1) {
                    parentIndex.push(index + 1);
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

    getCondensedText(userData: string[][]): CondensedText {
        var firstSentence: (string|null)[] = [];
        var notFstSentence: (string|null)[] = [];

        var getSentences = (post: string): string[] => {
            var sentences: string[] = [];
            //if not all whitepsace
            if (/\S/.test(post)) {
                this.tokenizer.setEntry(post);
                sentences = this.tokenizer.getSentences();
            }
            return sentences;
        }

        var getWordCount = (post: string): number => {
            this.tokenizer.setEntry(post);
            var sentences: string[] = this.tokenizer.getSentences();

            var wordCount: number = 0;
            sentences.forEach((_, index) => {
                var tokens = this.tokenizer.getTokens(index);
                wordCount += tokens.length;
            });

            return wordCount;
        }

        var getRemainingSentences = function(sentences: string[]): string | null {
            if (sentences.length <= 1) {
                //There's nothing else to show
                return null;
            }

            var count: number = 0;
            var substrContext: string = "";
            for (var i = 1; i < sentences.length; i++) {
                //if it's not an empty space
                if (sentences[i].length > 1) {
                    count++;
                    substrContext += sentences[i] + " ";
                }
            }

            if (count == 0) {
                //There's nothing else to show
                return null;
            }

            //normal case
            return substrContext;
        }

        userData.forEach((postArr: string[], lineNumber: number) => {
            if (postArr.length < 2) {
                // Title post only has one element
                firstSentence.push(null);
                notFstSentence.push(null);
                return;
            }
            var post = postArr[1];

            var sentences: string[] = getSentences(post);
            var wordCount: number = getWordCount(post);

            //filter out posts that are too short
            var MAX_WORDS = 5;
            if (wordCount < MAX_WORDS) {
                firstSentence.push(null);
                notFstSentence.push(null);
                return;
            }

            //Remove extra whitespace
            post = post.replace(/\s+/g, " ");

            //Save first sentence into one array
            firstSentence.push(sentences[0]);
            //Save the remaining sentences into another array
            var remainingSentences: string | null = getRemainingSentences(sentences);
            notFstSentence.push(remainingSentences);
        });

        return {
            firstSentence: firstSentence,
            notFstSentence: notFstSentence
        };
    }

    // sum up all child posts for each parent
    getAllOriginalReplies(condensedData: CondensedText, parentIndex: number[]): string[][] {
        var originalRepliesArr: string[][] = [];

        var firstSentence: (string | null)[] = condensedData.firstSentence;
        var remainingSentences: (string | null)[] = condensedData.notFstSentence;

        //Iterate through each parent post index
        for (var i = 0; i < parentIndex.length - 1; i++) {
            var allChildComments: string[] = [];

            //Combine all the children posts for that parent
            for (var j = parentIndex[i] + 1; j < parentIndex[i + 1]; j++) {
                var childComment: string = "";
                if (firstSentence[j] != null) {
                    childComment += firstSentence[j];
                    if (remainingSentences[j] != null) {
                        childComment += " " + remainingSentences[j];
                    }

                    //append a period to the end of the post if there isn't any punctuation
                    var punctutation = ".!?";
                    if (punctutation.indexOf(childComment[childComment.length - 1]) == -1 &&
                        punctutation.indexOf(childComment[childComment.length - 2]) == -1) {
                        childComment += ".";
                    }

                    allChildComments.push(childComment);
                }
            }

            originalRepliesArr.push(allChildComments);
        }

        return originalRepliesArr;
    }

    //Helper wrapper function to summarize a block of text
    summarizeText(content: string, numSentences: number): string[] {
        var sortedArr: string[] = [];
        summaryTool.getSortedSentences(content, numSentences, function(err: Error, sorted_sentences: string[]) {
            if (err) {
                console.log("There was an error.");
                return [];
            }

            sorted_sentences.forEach((sentence) => sortedArr.push(sentence));
        });

        return sortedArr;
    }

    //Calculate how effective the summary is
    //Higher summary ratio is better
    getSummaryRatio(content: string, newSummaryArr: string[]) {
        var summaryLength: number = 0;
        for (var index in newSummaryArr) {
            summaryLength += newSummaryArr[index].length;
        }

        console.log("Original Content length: " + content.length);
        console.log("Summary length: " + summaryLength);
        console.log("Summary Ratio: " + (100 - (100 * (summaryLength / content.length))).toFixed(0) + "%");
        console.log();
    }

    getSummaryReplies(allPosts: string[][]): string[][] {
        var getArrayToStr = function(arr: string[]): string {
            var tempStr: string = "";
            arr.forEach((currentStr) => {
                tempStr += currentStr + "\n";
            });
            return tempStr;
        }

        var summaryArr: string[][] = [];
        allPosts.forEach((replyArr: string[]) => {
            var title = '';
            //build content string by separating reply posts with a newline
            var content: string = getArrayToStr(replyArr);

            //nothing to summarize
            if (replyArr.length == 0) {
                summaryArr.push([]);
                return;
            }

            //no need to summarize if under 250 chars
            if (content.length < 250) {
                summaryArr.push(replyArr);
                return;
            }

            //summarize the content into a half each time until it is short enough
            //(i.e. less than x sentences)
            var newStr: string = content;
            var lengthSummary: number = replyArr.length;
            var newSummary: string[] = [];
            do {
                lengthSummary /= 2;
                newSummary = this.summarizeText(newStr, lengthSummary);
                newStr = getArrayToStr(newSummary);
            } while (lengthSummary > 10);

            summaryArr.push(newSummary);
            // getSummaryRatio(content, newSummary);
        });

        return summaryArr;
    }

    sortImportantParents(originalRepliesArr: string[][], parentIndex: number[]): number[] {
        var summaryArr: string[][] = this.getSummaryReplies(originalRepliesArr);
        var newParentIndex: number[] = [];
        for (var i = 0; i < parentIndex.length - 1; i++) {
            if (parentIndex[i] + 1 == parentIndex[i + 1]) { // No children
                newParentIndex.push(-1);
            } else if (summaryArr[i].length == 0) { // No child left after summarization
                newParentIndex.push(-1);
            } else { // Get child before and after summarization
                newParentIndex.push(parentIndex[i]);
            }
        }
        // Check the last index in parentIndex
        newParentIndex.push(-1);

        return newParentIndex;
    }

    getSentimentValues(originalRepliesArr: string[][]): SentimentValuePost {
        var sentimentValues: SentimentValue[][] = [];
        var positivePosts: string[][] = [];
        var neutralPosts: string[][] = [];
        var negativePosts: string[][] = [];

        originalRepliesArr.forEach((reply) => {
            var allScores: SentimentValue[] = [];

            var postPos: string[] = [];
            var postNeutral: string[] = [];
            var postNegative: string[] = [];
            reply.forEach((post) => {
                var result: SentimentValue = this.sentiment.analyze(post);

                allScores.push(result);
                //determine whether a post is positive, neutral, or negative
                if (result.score > 0) {
                    postPos.push(post);
                } else if (result.score == 0) {
                    postNeutral.push(post);
                } else if (result.score < 0) {
                    postNegative.push(post);
                }
            });

            sentimentValues.push(allScores);

            positivePosts.push(postPos);
            neutralPosts.push(postNeutral);
            negativePosts.push(postNegative);
        });

        return {
            sentimentArr: sentimentValues,
            positivePosts: positivePosts,
            neutralPosts: neutralPosts,
            negativePosts: negativePosts
        }
    }

    getPostIndices(summaryGroup: string[][], originalRepliesArr: string[][], index: number): NumberStringTuple[] {
        var postIndices: NumberStringTuple[] = [];

        //iterate through each sentence in the summary reply
        summaryGroup[index].forEach((summarySentence) => {
            //iterate through each reply in the child reply
            originalRepliesArr[index].forEach((eachChildReply: string, childReplyIndex: number) => {
                //check if the sentence in the summary appears in the original reply
                if (eachChildReply.indexOf(summarySentence) > -1) {
                    var tuple: NumberStringTuple = [childReplyIndex, summarySentence];

                    if (postIndices.indexOf(tuple) == -1) {
                        postIndices.push(tuple);
                    }
                }
            });
        });

        return postIndices;
    }

    combineSummaryReplies(sentimentValues: SentimentValuePost, originalRepliesArr: string[][]): string[][] {
        function sortByPostIndex(a: NumberStringTuple, b: NumberStringTuple) {
            if (a[0] > b[0]) {
                return 1;
            } else if (a[0] == b[0]) {
                return 0;
            } else {
                return -1;
            }
        }

        var summaryPos = this.getSummaryReplies(sentimentValues.positivePosts);
        var summaryNeutral = this.getSummaryReplies(sentimentValues.neutralPosts);
        var summaryNeg = this.getSummaryReplies(sentimentValues.negativePosts);

        var summaryReplies: string[][] = [];

        summaryPos.forEach((_, index) => {
            //rearrange the order of the post sentences to better match the original
            var matchingSentences: NumberStringTuple[] = [];

            var posIndices = this.getPostIndices(summaryPos, originalRepliesArr, index);
            var neutralIndices = this.getPostIndices(summaryNeutral, originalRepliesArr, index);
            var negIndices = this.getPostIndices(summaryNeg, originalRepliesArr, index);

            posIndices.forEach((tuple) => matchingSentences.push(tuple));
            neutralIndices.forEach((tuple) => matchingSentences.push(tuple));
            negIndices.forEach((tuple) => matchingSentences.push(tuple));

            matchingSentences.sort(sortByPostIndex);

            //remove duplicates
            for (var i = 1; i < matchingSentences.length;) {
                var isSamePostIndex = (matchingSentences[i - 1][0] == matchingSentences[i][0]);
                var isSameSentence = (matchingSentences[i - 1][1] == matchingSentences[i][1]);
                if (isSamePostIndex && isSameSentence) {
                    matchingSentences.splice(i, 1);
                } else {
                    i++;
                }
            }

            var combinedSentences = matchingSentences.map((tuple) => tuple[1]).join(" ");
            var strArr: string[] = [];
            strArr.push(combinedSentences);

            summaryReplies.push(strArr);
        });

        return summaryReplies;
    }

    getDisplayData(text: string) {
        var postData: PostData = this.getPostData(text);
        var userData: UserInfo = this.getUserInfo(postData);
        var condensedData: CondensedText = this.getCondensedText(userData.userData);
        var originalRepliesArr: string[][] = this.getAllOriginalReplies(condensedData, userData.parentIndex);

        var newParentIndex: number[] = this.sortImportantParents(originalRepliesArr, userData.parentIndex);

        var sentimentValues: SentimentValuePost = this.getSentimentValues(originalRepliesArr);
        var combinedReplies: string[][] = this.combineSummaryReplies(sentimentValues, originalRepliesArr);

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
}