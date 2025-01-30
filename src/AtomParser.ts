import Tokenizer from './tokenizer/tokenizer.js';
import Sentiment from 'sentiment';
import summaryTool from './summary/summary.js';

export type NumberStringTuple = [number, string];

interface TitleComments {
    title: string;
    comments: string[];
}

interface UserComment {
    username: string;
    content: string;
    isParent: boolean;
}

interface ParentPosts {
    parentComment: UserComment;
    childComments: UserComment[];
}

interface SentimentValue {
    score: number;
    comparative: number;
    calculation: { [key: string]: number }[];
    tokens: string[];
    words: string[];
    positive: string[];
    negative: string[];
}

interface SentimentValuePost {
    sentimentValue: SentimentValue;
    post: string;
    username: string;
}

interface SentimentValueCategories {
    positivePosts: string[][];
    neutralPosts: string[][];
    negativePosts: string[][];
}

interface DisplayPost {
    parentPostUsername: string
    parentPostOriginal: string;
    parentPostPreview: string | null;
    parentPostRemaining: string | null;
    summary: string[];
    childPosts: SentimentValuePost[];
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
        var startDisplayLine = 0;
        var endDisplayLine = 0;

        var isReddit = false;

        // split data into posts
        var posts = text.split("goldreply").map((sentence) => {
            sentence = sentence.replace(/\s+/g, " ")
                .replace(/[^a-zA-Z0-9 ]/g, "");
            return sentence;
        });

        posts.forEach((sentence, index) => {
            var lineNumberProfile = index + 1;

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

    parsePostTitle(title: string) {
        //Special case: title post
        //format: [post title] ([link]) submitted by [poster name]
        return title.substring(0, title.indexOf(")") + 1);
    }

    getTitlePost(originalPost: string) {
        var newPost = originalPost;

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

    getRegularPost(originalPost: string): string {
        return originalPost.replace("\[\–\]", "");
    }

    buildPostDataFromString(text: string): TitleComments {
        var postData: string[] = [];
        var lineMarkers = this.getStartEndLines(text);

        //Split the data into individual posts
        var titleStr: string = "";
        var cleanedPosts = text.split("goldreply").map((currentPost) => {
            return this.cleanPost(currentPost);
        });
        cleanedPosts.forEach((post, index) => {
            var lineNumberProfile = index + 1;

            //Ignore anything that isn't an actual post
            if (lineNumberProfile >= lineMarkers.startLine &&
                lineNumberProfile <= lineMarkers.endLine) {
                if (lineNumberProfile == lineMarkers.startLine) {
                    var titlePost = this.getTitlePost(post);

                    titleStr = titlePost.titleStr;
                    postData.push(titlePost.firstPost);
                } else {
                    postData.push(this.getRegularPost(post));
                }
            }
        });

        return {
            title: this.parsePostTitle(titleStr),
            comments: postData,
        }
    }

    cleanUsernameString(word: string): string {
        var username = word;
        username = username.replace(/\s+/g, "");
        username = username.replace("\[\–\]", "");
        return username;
    }

    parseUserAndCommentFromPosts(postData: string[]): UserComment[] {
        return postData.map((wholePost: string) => {
            var wordArray: string[] = wholePost.split(" ")
                .filter((word) => word != "");

            // First word is username
            var username: string = this.cleanUsernameString(wordArray[0]);

            // Remaining words are part of the post content
            var postContent: string = wordArray.slice(1).join(" ");
            var isParent: boolean = false;
            if (postContent.indexOf("permalinksavereportgive") > -1) {
                isParent = true;
                postContent = postContent.replace(/permalinksavereportgive/g, "");
            }

            return {
                username: username,
                content: postContent,
                isParent: isParent,
            }
        });
    }

    buildParentIndex(userComments: UserComment[]): number[] {
        return userComments
            .filter(userComment => userComment.isParent)
            .map((_, index) => index);
    }

    getRemainingSentences(sentences: string[]): string | null {
        if (sentences.length <= 1) {
            //There's nothing else to show
            return null;
        }

        var nonEmptySentences = sentences.slice(1).filter((sentence) => sentence.length > 1);

        if (nonEmptySentences.length == 0) {
            //There's nothing else to show
            return null;
        }

        //normal case
        return nonEmptySentences.join(" ");
    }

    splitTextIntoSentences(post: string): string[] {
        var sentences: string[] = [];
        //if not all whitepsace
        if (/\S/.test(post)) {
            this.tokenizer.setEntry(post);
            sentences = this.tokenizer.getSentences();
        }
        return sentences;
    }

    getWordCount(post: string): number {
        var sentences: string[] = this.splitTextIntoSentences(post);

        var wordCount: number = 0;
        sentences.forEach((_, index) => {
            var tokens = this.tokenizer.getTokens(index);
            wordCount += tokens.length;
        });

        return wordCount;
    }

    // sum up all child posts for each parent
    buildParentChildPosts(userComments: UserComment[], parentIndex: number[]): ParentPosts[] {
        var allParentPosts: ParentPosts[] = [];

        // Iterate through each parent post index
        for (var i = 0; i < parentIndex.length - 1; i++) {
            var parentPosts: ParentPosts = {
                parentComment: userComments[parentIndex[i]],
                childComments: userComments.slice(parentIndex[i] + 1, parentIndex[i + 1]),
            }
            allParentPosts.push(parentPosts);
        }

        return allParentPosts;
    }

    addPunctuationIfMissing(content: string): string {
        var punctutation = ".!?";

        // Check if last two characters have punctuation
        // Assumes this string has been sanitized and extra whitespace is removed
        if (punctutation.indexOf(content[content.length - 1]) == -1 &&
            punctutation.indexOf(content[content.length - 2]) == -1) {
            return content + ".";
        } else {
            return content;
        }
    }

    cleanOriginalReplies(parentPosts: ParentPosts[]): ParentPosts[] {
        const MIN_WORDS = 5;
        return parentPosts.map((parentPost) => {
            var newChildComments = parentPost.childComments
                // filter out comments that are too short
                .filter((childComment) => this.getWordCount(childComment.content) >= MIN_WORDS)
                .map((childComment) => {
                    // Remove extra whitespace
                    var newComment = childComment.content.replace(/\s+/g, " ");
                    newComment = this.addPunctuationIfMissing(newComment);

                    return {
                        username: childComment.username,
                        content: newComment,
                        isParent: childComment.isParent,
                    }
                });

            return {
                parentComment: parentPost.parentComment,
                childComments: newChildComments,
            }
        });
    }

    //Helper wrapper function to summarize a block of text
    summarizeText(content: string, numSentences: number): string[] {
        var sortedArr: string[] = [];
        summaryTool.getSortedSentences(content, numSentences, function (err: Error, sorted_sentences: string[]) {
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
        for (const summary of newSummaryArr) {
            summaryLength += summary.length;
        }

        console.log("Original Content length: " + content.length);
        console.log("Summary length: " + summaryLength);
        console.log("Summary Ratio: " + (100 - (100 * (summaryLength / content.length))).toFixed(0) + "%");
        console.log();
    }

    getSummaryReplies(allPosts: string[][]): string[][] {
        var getArrayToStr = function (arr: string[]): string {
            return arr.join("\n") + "\n";
        }

        return allPosts.map((replyArr: string[]) => {
            //build content string by separating reply posts with a newline
            var content: string = getArrayToStr(replyArr);

            //nothing to summarize
            if (replyArr.length == 0) {
                return [];
            }

            //no need to summarize if under 250 chars
            if (content.length < 250) {
                return replyArr;
            }

            //summarize the content into a half each time until it is short enough
            //(i.e. less than x sentences)
            var newStr: string = content;
            var lengthSummary: number = replyArr.length;
            var newSummary: string[] = [];
            do {
                lengthSummary = Math.floor(lengthSummary / 2);
                newSummary = this.summarizeText(newStr, lengthSummary);
                newStr = getArrayToStr(newSummary);
            } while (lengthSummary > 10);

            // getSummaryRatio(content, newSummary);
            return newSummary;
        });
    }

    markParentIndexWithoutChildren(summaryArr: string[][], parentIndex: number[]): number[] {
        return parentIndex.map((_, index) => {
            // Check the last index in parentIndex
            if (index == parentIndex.length - 1) {
                return -1;
            }

            if (parentIndex[index] + 1 == parentIndex[index + 1]) { // No children
                return -1;
            } else if (summaryArr[index].length == 0) { // No child left after summarization
                return -1;
            } else { // Get child before and after summarization
                return parentIndex[index];
            }
        });
    }

    getSentimentValues(originalRepliesArr: ParentPosts[]): SentimentValuePost[][] {
        return originalRepliesArr.map((parentPost) => {
            return parentPost.childComments.map((post) => {
                return {
                    sentimentValue: this.sentiment.analyze(post.content),
                    post: post.content,
                    username: post.username,
                }
            });
        });
    }

    classifySentimentValues(sentimentValues: SentimentValuePost[][]): SentimentValueCategories {
        var positivePosts: string[][] = [];
        var neutralPosts: string[][] = [];
        var negativePosts: string[][] = [];

        sentimentValues.forEach((sentimentValueList) => {
            //determine whether a post is positive, neutral, or negative
            positivePosts.push(sentimentValueList.filter((result) => result.sentimentValue.score > 0).map((result) => result.post));
            neutralPosts.push(sentimentValueList.filter((result) => result.sentimentValue.score == 0).map((result) => result.post));
            negativePosts.push(sentimentValueList.filter((result) => result.sentimentValue.score < 0).map((result) => result.post));
        });

        return {
            positivePosts: positivePosts,
            neutralPosts: neutralPosts,
            negativePosts: negativePosts
        }
    }

    getPostIndices(summaryGroup: string[][], originalRepliesArr: ParentPosts[], index: number): NumberStringTuple[] {
        var postIndices: NumberStringTuple[] = [];

        //iterate through each sentence in the summary reply
        summaryGroup[index].forEach((summarySentence) => {
            //iterate through each reply in the child reply
            originalRepliesArr[index].childComments.forEach((eachChildReply: UserComment, childReplyIndex: number) => {
                //check if the sentence in the summary appears in the original reply
                if (eachChildReply.content.indexOf(summarySentence) > -1) {
                    var tuple: NumberStringTuple = [childReplyIndex, summarySentence];

                    if (postIndices.indexOf(tuple) == -1) {
                        postIndices.push(tuple);
                    }
                }
            });
        });

        return postIndices;
    }

    combineSummaryReplies(sentimentValues: SentimentValueCategories, originalRepliesArr: ParentPosts[]): string[][] {
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

        return summaryPos.map((_, index) => {
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
            matchingSentences = [...new Set(matchingSentences)]

            var combinedSentences = matchingSentences.map((tuple) => tuple[1]).join(" ");
            return [combinedSentences];
        });
    }

    buildDisplayPosts(originalRepliesArr: ParentPosts[], summaryArr: string[][], sentimentArr: SentimentValuePost[][]): DisplayPost[] {
        return summaryArr.map((_, i) => {
            var parentCommentObject = originalRepliesArr[i].parentComment;
            var parentComment = parentCommentObject.content;
            var sentences: string[] = this.splitTextIntoSentences(parentComment);

            var displayPost: DisplayPost = {
                parentPostUsername: parentCommentObject.username,
                parentPostOriginal: parentComment,
                parentPostPreview: sentences[0], // When rendering parent posts, only first sentence will be shown. 
                parentPostRemaining: this.getRemainingSentences(sentences), // The user will need to click "Show more" to see the remaining sentences.
                summary: summaryArr[i],
                childPosts: sentimentArr[i],
            };
            return displayPost;
        });
    }

    getDisplayData(text: string) {
        var postData: TitleComments = this.buildPostDataFromString(text);
        var userComments: UserComment[] = this.parseUserAndCommentFromPosts(postData.comments);
        var parentIndex: number[] = this.buildParentIndex(userComments);
        var parentPosts: ParentPosts[] = this.buildParentChildPosts(userComments, parentIndex);
        var filteredParentPosts: ParentPosts[] = this.cleanOriginalReplies(parentPosts);

        var sentimentArr: SentimentValuePost[][] = this.getSentimentValues(filteredParentPosts);
        var sentimentValues: SentimentValueCategories = this.classifySentimentValues(sentimentArr);
        var summaryArr: string[][] = this.combineSummaryReplies(sentimentValues, filteredParentPosts);

        var newParentIndex: number[] = this.markParentIndexWithoutChildren(summaryArr, parentIndex);

        var displayPosts: DisplayPost[] = this.buildDisplayPosts(filteredParentPosts, summaryArr, sentimentArr);

        return {
            postTitle: postData.title,
            newParentIndex: newParentIndex,
            displayPosts: displayPosts,
        }
    }
}