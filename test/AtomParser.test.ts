import { strict as assert } from 'assert';
import { AtomParser, CondensedText, NumberStringTuple } from '../src/AtomParser';

describe('AtomParser', function () {
    var atomParser = new AtomParser();

    describe('#getUserInfo()', function () {
        it('Split username from post content', function () {
            var postData = [
                "user1 post1",
                "user2 post2 permalinksavereportgive",
                "user3 post3",
            ]
            var output = atomParser.parseUserAndCommentFromPosts(postData);

            var expected = [
                { username: 'user1', content: 'post1', isParent: false },
                { username: 'user2', content: 'post2 ', isParent: true },
                { username: 'user3', content: 'post3', isParent: false }
            ];

            assert.equal(output.length, 3);
            for (var i = 0; i < output.length; i++) {
                assert.equal(output[i].username, expected[i].username);
                assert.equal(output[i].content, expected[i].content);
                assert.equal(output[i].isParent, expected[i].isParent);
            }
        });

        it('Build parent index', function () {
            var userComments = [
                { username: 'user1', content: 'post1', isParent: false },
                { username: 'user2', content: 'post2 ', isParent: true },
                { username: 'user3', content: 'post3', isParent: false }
            ];

            var parentIndex: number[] = atomParser.buildParentIndex(userComments)

            var expected: number[] = [1]

            assert.equal(parentIndex.length, 1);
            for (var i = 0; i < parentIndex.length; i++) {
                assert.equal(parentIndex[i], expected[i]);
            }
        })
    });

    describe('#tokenizerTests()', function () {
        it('Split text into sentences', function () {
            var sampleText = "Split text into sentences. This should be an array. There should be multiple elements.";
            var sentences = atomParser.splitTextIntoSentences(sampleText);

            var expected = [
                'Split text into sentences.',
                'This should be an array.',
                'There should be multiple elements.'
            ]

            assert.equal(sentences.length, 3);
            for (var i = 0; i < sentences.length; i++) {
                assert.equal(sentences[i], expected[i]);
            }
        })

        it('Get word count', function () {
            var sampleText = "Split text into sentences. This should be an array. There should be multiple elements.";
            var wordCount = atomParser.getWordCount(sampleText);

            assert.equal(wordCount, 14);
        })
    })

    describe('#getCondensedText()', function () {
        it("Split text into first sentence and remaining sentences", function () {
            var parentPosts = [
                {
                    parentComment: {
                        username: 'user1',
                        content: 'word1 word2 word3 word4 word5 word6 word7. sentence2word1 sentence2word2.',
                        isParent: false,
                    },
                    childComments: [],
                },
                {
                    parentComment: {
                        username: 'user2',
                        content: 'short sentence.',
                        isParent: false,
                    },
                    childComments: [],
                }
            ]

            var condensedText = atomParser.getCondensedTextForParent(parentPosts);
            var expected: CondensedText = {
                firstSentence: [
                    'word1 word2 word3 word4 word5 word6 word7.',
                    null
                ],
                remainingSentences: [
                    'sentence2word1 sentence2word2.',
                    null
                ]
            };

            assert.equal(condensedText.firstSentence.length, expected.firstSentence.length);
            assert.equal(condensedText.remainingSentences.length, expected.remainingSentences.length);
            for (var i = 0; i < condensedText.firstSentence.length; i++) {
                assert.equal(condensedText.firstSentence[i], expected.firstSentence[i]);
            }
            for (var i = 0; i < condensedText.remainingSentences.length; i++) {
                assert.equal(condensedText.remainingSentences[i], expected.remainingSentences[i]);
            }
        });
    })

    describe('#getAllOriginalReplies()', function () {
        it("Get original replies from parent comments", function () {
            var parentPosts = [
                {
                    parentComment: {
                        username: "parentuser1",
                        content: "sentence1 sentence1 part2.",
                        isParent: true,
                    },
                    childComments: [
                        {
                            username: "user1",
                            content: "sentence2 word1 word2 word3 word4.",
                            isParent: false,
                        },
                        {
                            username: "user2",
                            content: "sentence3 sentence3 part2 part3 part4.",
                            isParent: false,
                        }
                    ]
                },
                {
                    parentComment: {
                        username: "parentuser2",
                        content: "sentence4.",
                        isParent: true,
                    },
                    childComments: [
                        {
                            username: "user3",
                            content: "sentence5 word1 word2 word3 word4.",
                            isParent: false,
                        },
                        {
                            username: "user4",
                            content: "sentence6 word1 word2 word3 word4.",
                            isParent: false,
                        }
                    ]
                },
            ]

            var originalRepliesArr = atomParser.getAllOriginalReplies(parentPosts);
            var expected = [
                [ // parent is 'sentence1 sentence1 part2.'
                    'sentence2 word1 word2 word3 word4.',
                    'sentence3 sentence3 part2 part3 part4.',
                ],
                [ // parent is 'sentence4.'
                    'sentence5 word1 word2 word3 word4.',
                    'sentence6 word1 word2 word3 word4.'
                ]
            ];

            assert.equal(originalRepliesArr.length, expected.length);
            for (var i = 0; i < originalRepliesArr.length; i++) {
                assert.equal(originalRepliesArr[i].length, expected[i].length);
                for (var j = 0; j < originalRepliesArr[i].length; j++) {
                    assert.equal(originalRepliesArr[i][j], expected[i][j]);
                }
            }
        })
    });

    describe('#getPostIndices()', function () {
        it("Get post indicies of summary sentences in original posts", function () {
            var summaryGroup = [
                [],
                [
                    'Sentence2part1word1 part1word2',
                    'Sentence2part2word1 part1word2',
                    "Sentence5 word1",
                    "Sentence11 word1",
                ],
                [
                    'Group2Sentence1',
                    'Group2Sentence2',
                    'Group2Sentence3',
                    'Group2Sentence4',
                    'Group2Sentence5'
                ],
            ];
            var originalRepliesArr = [
                [],
                [
                    "",
                    "Sentence2part1word1 part1word2 word3. Sentence2part2word1 part1word2 word3.",
                    "Sentence3",
                    "Sentence4",
                    "Sentence5 word1 word2",
                    "Sentence6",
                    "Sentence7",
                    "Sentence8",
                    "Sentence9",
                    "Sentence10",
                    "Sentence11 word1 word2"
                ],
                [],
            ]
            var index = 1;

            var expected: NumberStringTuple[] = [
                [1, "Sentence2part1word1 part1word2"],
                [1, "Sentence2part2word1 part1word2"],
                [4, "Sentence5 word1"],
                [10, "Sentence11 word1"]
            ];

            var postIndices = atomParser.getPostIndices(summaryGroup, originalRepliesArr, index);
            assert.equal(postIndices.length, expected.length);
            for (var i = 0; i < postIndices.length; i++) {
                assert.equal(postIndices[i][0], expected[i][0]);
                assert.equal(postIndices[i][1], expected[i][1]);
            }
        })
    });
});