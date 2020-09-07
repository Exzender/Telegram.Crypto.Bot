const Twitter = require('twitter');
const EventEmitter = require('events');

class TwObject extends EventEmitter {
    constructor(eventsHandler) {
        super();

        const twitConfig = {
            consumer_key: process.env.TWIT_CON_KEY,
            consumer_secret: process.env.TWIT_CON_SECRET,
            access_token_key: process.env.TWIT_ACCESS_KEY,
            access_token_secret: process.env.TWIT_ACCESS_SECRET
        };

        this.twitter = new Twitter(twitConfig);

        this.on('twitError', eventsHandler.twitError);
    }

    parseTweetId(url) {
        let tws = url.split('/');
        let twsId = tws[tws.length-1].split('?');
        return twsId[0];
    }

    getTweet(tweet, chatId) {
        let tweetId = this.parseTweetId(tweet);
        let params = {id: tweetId};
        let self = this;
        return new Promise((resolve, reject) => {
            self.twitter.get('statuses/show', params, function (err, data) {
                if (err) {
                    if (err.length) {
                        if (err[0].code === 89) {
                            self.emit('twitError', err, chatId);
                        }
                    }
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    getReTweets(tweet, chatId) {
        let tweetId = this.parseTweetId(tweet);
        let params = {id: tweetId, count: 100};
        let self = this;
        return new Promise((resolve, reject) => {
            self.twitter.get('statuses/retweets', params, function (err, data) {
                if (err) {
                    if (err.length) {
                        if (err[0].code === 89) {
                            self.emit('twitError', err, chatId);
                        }
                    }
                    reject(err);
                } else {
                    let objs = [];
                    for(let i = 0; i < data.length; i++) {
                        let twObj = data[i];
                        let obj = {};
                        obj.tweet_id = tweetId;
                        obj.retweet_id = twObj.id_str;
                        obj.twit_user_id =  twObj.user.id_str;
                        objs.push(obj);
                    }
                    resolve(objs);
                }
            });
        });
    }

    getTwitterId(userName, chatId) {
        let uName = userName.replace('@', '');
        let params = {screen_name: uName};
        let self = this;
        return new Promise((resolve, reject) => {
            self.twitter.get('users/show', params, function (err, data) {
                if (err) {
                    if (err.length) {
                        if (err[0].code === 89) {
                            self.emit('twitError', err, chatId);
                        }
                    }
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }
}

module.exports = {
    TwObject
};
