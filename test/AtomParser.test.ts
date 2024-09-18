import { strict as assert } from 'assert';
import { AtomParser, CondensedText, NumberStringTuple } from '../src/AtomParser';

describe('AtomParser', function () {
    var atomParser = new AtomParser();

    describe('#getUserInfo()', function () {
        it('Split username from post content', function () {
            var postData = {
                title: "Post title (link) submitted by user0",
                comments: [
                    "user1 post1",
                    "user2 post2 permalinksavereportgive",
                    "user3 post3",
                ]
            }
            var output = atomParser.getUserInfo(postData);
            assert.equal(output.userData.length, 4);
            assert.equal(output.userData[0].length, 1);
            assert.equal(output.userData[0][0], "Post title (link)");
            for (var i = 1; i < output.userData.length; i++) {
                assert.equal(output.userData[i].length, 2);
                assert.equal(output.userData[i][0], "user" + i);
            }

            assert.equal(output.parentIndex.length, 1);
            assert.ok(output.parentIndex.includes(2));
        });
    });

    describe('#getCondensedText()', function () {
        it("Split text into first sentence and remaining sentences", function () {
            var userData = [
                ['title'],
                ['user1', 'word1 word2 word3 word4 word5 word6 word7. sentence2word1 sentence2word2.'],
                ['user2', 'short sentence.']
            ]

            var condensedText = atomParser.getCondensedText(userData);
            var expected: CondensedText = {
                firstSentence: [
                    null,
                    'word1 word2 word3 word4 word5 word6 word7.',
                    null
                ],
                notFstSentence: [
                    null,
                    'sentence2word1 sentence2word2. ',
                    null
                ]
            };

            assert.equal(condensedText.firstSentence.length, expected.firstSentence.length);
            assert.equal(condensedText.notFstSentence.length, expected.notFstSentence.length);
            for (var i = 0; i < condensedText.firstSentence.length; i++) {
                assert.equal(condensedText.firstSentence[i], expected.firstSentence[i]);
            }
            for (var i = 0; i < condensedText.notFstSentence.length; i++) {
                assert.equal(condensedText.notFstSentence[i], expected.notFstSentence[i]);
            }
        });
    })

    describe('#getAllOriginalReplies()', function () {
        it("Get original replies from parent comments", function () {
            var condensedData: CondensedText = {
                firstSentence: [
                    'sentence1',
                    null,
                    'sentence2',
                    null,
                    'sentence3',
                    'sentence4',
                    'sentence5',
                    'sentence6'
                ],
                notFstSentence: [
                    'sentence1 part2',
                    null,
                    null,
                    null,
                    'sentence3 part2',
                    null,
                ],
            }
            var parentIndex = [1, 5, 8]

            var originalRepliesArr = atomParser.getAllOriginalReplies(condensedData, parentIndex);
            var expected = [
                [ // parent is 'sentence1 sentence1 part2.'
                    'sentence2.',
                    'sentence3 sentence3 part2.',
                ],
                [ // parent is 'sentence4.'
                    'sentence5.',
                    'sentence6.'
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