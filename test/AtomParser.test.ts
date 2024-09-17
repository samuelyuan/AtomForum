import { strict as assert } from 'assert';
import { AtomParser } from '../src/AtomParser';

describe('AtomParser', function () {
    var atomParser = new AtomParser();
    describe('#getUserInfo()', function () {
        it('Split username from post content', function () {
            var postData = [
                "Post title (link) submitted by user0", 
                "user1 post1", 
                "user2 post2 permalinksavereportgive", 
                "user3 post3",
            ]
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
});