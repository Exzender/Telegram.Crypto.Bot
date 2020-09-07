/**
 * Module with Database functions
 */

const MongoClient = require("mongodb").MongoClient;

let mongoCloDb = null;
let mongoUsersTable = null;
let mongoOperationsTable = null;
let mongoChatsTable = null;
let mongoQueueTable = null;
let mongoChatPotTable = null;
let mongoPotQueTable = null;
let mongoTweetsTable = null;
let mongoRetweetsTable = null;
let mongoSessionsTable = null;
let mongoChatUsersTable = null;
let mongoStartUsersTable = null;
let mongoWhiteListTable = null;
let mongoWListUserTable = null;

function DbClient(logger) {
    this.mongoClient = new MongoClient(process.env.MONGODB_URI, { useUnifiedTopology: true });
    this.logger = logger;
}

DbClient.prototype.connect = function connect(dbName) {
    const self = this;
    let res = this.mongoClient
        .connect()
        .then(function (client) {
            self.logger.info("Connected successfully to Mongo server");
            mongoCloDb = client.db(dbName);
            mongoUsersTable = mongoCloDb.collection("users");
            mongoOperationsTable = mongoCloDb.collection("operations");
            mongoChatsTable = mongoCloDb.collection("chats");
            mongoQueueTable = mongoCloDb.collection("rain_que");
            mongoChatPotTable = mongoCloDb.collection("chat_pot");
            mongoPotQueTable = mongoCloDb.collection("chat_pot_que");
            mongoTweetsTable = mongoCloDb.collection("tweets");
            mongoRetweetsTable = mongoCloDb.collection("retweets");
            mongoSessionsTable = mongoCloDb.collection("sessions");
            mongoChatUsersTable = mongoCloDb.collection("chat_user");
            mongoStartUsersTable = mongoCloDb.collection("start_user");
            mongoWhiteListTable = mongoCloDb.collection("whitelist");
            mongoWListUserTable = mongoCloDb.collection("wlist_user");
        })
        .catch(function (Error) {
            self.logger.error(Error.stack);
        });
    return new Promise((resolve, reject) => {
        res.then(() => resolve(mongoCloDb));
        res.catch((Error) => reject(Error));
    });
};

DbClient.prototype.getUser = (userId) => {
    return mongoUsersTable.findOne({ user_id: userId });
};

DbClient.prototype.findUser = (fieldName, fieldValue) => {
    return mongoUsersTable.findOne({ [fieldName]: fieldValue });
};

DbClient.prototype.updateUser = function (userId, values) {
    return mongoUsersTable.updateOne({ user_id: userId }, { $set: values }, { upsert: true });
};

DbClient.prototype.newUser = function (user) {
    mongoUsersTable.insertOne(user).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.deleteUser = function (userId) {
    mongoUsersTable
        .deleteOne({ user_id: userId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.deleteOperations = function () {
    mongoOperationsTable.deleteMany({}).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getExtAddresses = function (userId, coinCode) {
    this.logger.debug("getExtAddresses %s %s", userId, coinCode);
    return mongoOperationsTable.distinct("to_address", {
        from_user_id: userId,
        op_type: 1,
        token: coinCode,
    });
};

DbClient.prototype.logOperationDb = (
    aTypeId,
    aItemSrc,
    aItemDest,
    aValue,
    aTxId,
    aChatId,
    coinCode
) => {
    return mongoOperationsTable.insertOne({
        op_date: new Date(),
        op_type: aTypeId,
        from_address: aItemSrc.address,
        from_user: aItemSrc.name,
        from_user_id: aItemSrc.id,
        to_address: aItemDest.address,
        to_user: aItemDest.name,
        to_user_id: aItemDest.id,
        op_amount: aValue,
        tx_id: aTxId,
        chat_id: aChatId,
        token: coinCode,
    });
};

DbClient.prototype.getOperations = (userId) => {
    return mongoOperationsTable
        .find({ $or: [{ from_user_id: userId }, { to_user_id: userId }] })
        .toArray();
};

DbClient.prototype.getOperationsSent = (userId) => {
    const query = [
        { $match: { op_type: { $in: [2, 3, 4, 5, 7, 10] }, from_user_id: userId } },
        { $group: { _id: "$token", pp: { $sum: "$op_amount" } } },
        { $sort: { _id: 1, pp: -1 } },
    ];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getOperationsGet = (userId) => {
    const query = [
        { $match: { op_type: { $in: [2, 3, 4, 6, 8, 9] }, to_user_id: userId } },
        { $group: { _id: "$token", pp: { $sum: "$op_amount" } } },
        { $sort: { _id: 1, pp: -1 } },
    ];
    return mongoOperationsTable.aggregate(query).toArray();
};


DbClient.prototype.getUsersIds = (users) => {
    return mongoUsersTable.find({ user_name: { $in: users } }).toArray();
};

DbClient.prototype.getUsersByIds = (ids) => {
    return mongoUsersTable.find({ user_id: { $in: ids } }).toArray();
};

DbClient.prototype.getUserSession = (userId) => {
    const key = `${userId}:${userId}`;
    return mongoSessionsTable.findOne({ key: key });
};

DbClient.prototype.findUsers = (fieldName, fieldValue) => {
    return mongoUsersTable.find({ [fieldName]: fieldValue }).toArray();
};

DbClient.prototype.getQueueFilter = (fieldName, chatId) => {
    return mongoQueueTable.distinct(fieldName, { chat_id: chatId });
};

DbClient.prototype.getUsersList = async function (chatId, getAll) {
    const filter = await this.getQueueFilter("user_id", getAll ? 0 : chatId);
    if (!filter) return;

    const queue = { user_id: { $nin: filter }, chat_id: chatId };
    const chatUsers = await mongoChatUsersTable.distinct("user_id", queue);
    if (!chatUsers) return;

    let queueN;
    if (getAll) {
        queueN = [{ $match: { user_id: { $in: chatUsers } } }];
    } else {
        queueN = [
            {
                $match: {
                    user_id: { $in: chatUsers },
                    $or: [{ inactive: null }, { inactive: "nochat" }],
                },
            },
        ];
    }
    return mongoUsersTable.aggregate(queueN).toArray();
};

DbClient.prototype.emptyQueueFilter = (chatId) => {
    return mongoQueueTable.deleteMany({ chat_id: chatId });
};

DbClient.prototype.writeQueueFilter = (values) => {
    return mongoQueueTable.insertMany(values);
};

DbClient.prototype.getAllUsers = function (dbName) {
    this.logger.debug("getAllUsers %s", dbName);
    const db = this.mongoClient.db(dbName);
    const usersTable = db.collection("users");
    return usersTable.find().toArray();
};

DbClient.prototype.getChats = () => {
    return mongoChatsTable.find().toArray();
};

DbClient.prototype.insertChat = function (chat) {
    mongoChatsTable.insertOne(chat).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.updateChat = function (chatId, values) {
    mongoChatsTable
        .updateOne({ chat_id: chatId }, { $set: values })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.setInactiveUser = function (userId, inactiveType, chatId) {
    let obj, flt;
    if (inactiveType === "blacklist") {
        flt = { user_id: userId };
        obj = { inactive: inactiveType, inactive_date: new Date(), bl_chat_id: chatId };
    } else {
        flt = { user_id: userId, inactive: null };
        obj = { inactive: inactiveType, inactive_date: new Date() };
    }
    mongoUsersTable
        .updateOne(flt, { $set: obj })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.setActiveUser = (userId) => {
    return mongoUsersTable.updateOne(
        { user_id: userId },
        { $set: { inactive: null, bl_chat_id: null } }
    );
};

DbClient.prototype.getTweet = (tweetId) => {
    return mongoTweetsTable.findOne({ tweet_id: tweetId });
};

DbClient.prototype.disableTweet = function (tweetId) {
    mongoTweetsTable
        .updateOne({ tweet_id: tweetId }, { $set: { is_active: 0, password: null } })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.updateTweet = (tweetObj) => {
    return mongoTweetsTable.updateOne(
        { tweet_id: tweetObj.tweet_id },
        { $set: tweetObj },
        { upsert: true }
    );
};

DbClient.prototype.updateReTweet = (twId, reTwId, twUserId) => {
    return mongoRetweetsTable.updateOne(
        { retweet_id: reTwId },
        {
            $set: {
                tweet_id: twId,
                twit_user_id: twUserId,
            },
        },
        { upsert: true }
    );
};

DbClient.prototype.countReTweets = (tweetId) => {
    return mongoRetweetsTable.countDocuments({ tweet_id: tweetId });
};

DbClient.prototype.getActiveTweets = () => {
    return mongoTweetsTable.find({ is_active: 1 }).toArray();
};

DbClient.prototype.getReTweeters = async (tweetId) => {
    const rtwList = await mongoRetweetsTable.distinct("twit_user_id", { tweet_id: tweetId });
    const queue = [{ $match: { twit_user_id: { $in: rtwList } } }];
    return mongoUsersTable.aggregate(queue).toArray();
};

DbClient.prototype.deleteChat = function (chatId) {
    mongoChatsTable
        .deleteOne({ chat_id: chatId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getChatUser = function (chatId, userId) {
    return mongoChatUsersTable.findOne({ chat_id: chatId, user_id: userId });
};


DbClient.prototype.newChatUser = function (chatId, userId) {
    mongoChatUsersTable
        .updateOne(
            { chat_id: chatId, user_id: userId },
            { $set: { user_id: userId } },
            { upsert: true }
        )
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.deleteChatUser = function (chatId, userId) {
    mongoChatUsersTable
        .deleteOne({ chat_id: chatId, user_id: userId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.insertChatUsers = function (values) {
    mongoChatUsersTable
        .insertMany(values)
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.clearChatUsers = function (chatId) {
    mongoChatUsersTable
        .deleteMany({ chat_id: chatId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getStats = function (chatId, token) {
    const query = [
        { $match: { op_type: { $in: [2, 3, 4, 5, 10] }, chat_id: chatId, token: token.toUpperCase() } },
        { $group: { _id: "$op_type", pp: { $sum: "$op_amount" } } },
        { $sort: { _id: 1 } },
    ];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getSpentStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [2, 3, 4, 5, 10]}, chat_id: chatId, token: token.toUpperCase(), from_user_id: {$ne: null}}},
        {$group: { _id: {uid: "$from_user_id", unm: "$from_user_id"}, pp: {$sum: "$op_amount"} }},
        {$sort: {pp: -1}},
        {$limit: 3}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getRcvStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [2, 3, 4, 5, 10]}, chat_id: chatId, token: token.toUpperCase(), to_user_id: {$ne: null}}},
        {$group: {  _id: {uid: "$to_user_id", unm: "$to_user_id"}, pp: {$sum: "$op_amount"} }},
        {$sort: {pp: -1}},
        {$limit: 3}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getTipStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [2, 10]}, chat_id: chatId, token: token.toUpperCase(), to_user_id: {$ne: null}}},
        {$group: {  _id: {uid: "$to_user_id", unm: "$to_user_id"}, pp: {$sum: "$op_amount"}, count: {$sum: 1} }},
        {$sort: {count: -1}},
        {$limit: 3}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getRainsStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [4]}, chat_id: chatId, token: token.toUpperCase(), to_user_id: {$ne: null}}},
        {$group: {  _id: {uid: "$to_user_id", unm: "$to_user_id"}, pp: {$sum: "$op_amount"}, count: {$sum: 1} }},
        {$sort: {pp: -1}},
        {$limit: 1}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getClaimsStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [3]}, chat_id: chatId, token: token.toUpperCase(), to_user_id: {$ne: null}}},
        {$group: {  _id: {uid: "$to_user_id", unm: "$to_user_id"}, pp: {$sum: "$op_amount"}, count: {$sum: 1} }},
        {$sort: {count: -1}},
        {$limit: 1}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getPotStats = function (chatId, token) {
    const query = [
        {$match: {op_type: {$in: [6]}, chat_id: chatId, token: token.toUpperCase(), to_user_id: {$ne: null}}},
        {$group: {  _id: {uid: "$to_user_id", unm: "$to_user_id"}, pp: {$sum: "$op_amount"}, count: {$sum: 1} }},
        {$sort: {count: -1}},
        {$limit: 1}];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getAllStats = function (chatId) {
    const query = [
        { $match: { op_type: { $in: [2, 3, 4, 5] }, chat_id: chatId } },
        { $group: { _id: "$op_type", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ];
    return mongoOperationsTable.aggregate(query).toArray();
};

DbClient.prototype.getPotStat = function (token) {
    return mongoChatPotTable.findOne({ token: token });
};

DbClient.prototype.getPotsNotEmpty = function () {
    return mongoChatPotTable.find({ entries: { $gt: 0 } }).toArray();
};

DbClient.prototype.clearPotEntries = function () {
    mongoChatPotTable
        .updateMany({}, { $set: { entries: 0 } })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.newChatPot = function (potObj) {
    mongoChatPotTable.insertOne(potObj).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getPotTickets = function (userId, token, date) {
    return mongoPotQueTable.countDocuments({
        user_id: userId,
        token: token,
        pot_date: { $gte: date },
    });
};

DbClient.prototype.insertNewPots = function (values) {
    mongoPotQueTable.insertMany(values).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.updatePotEntries = function (token, entries) {
    if (entries > 0) {
        mongoChatPotTable
            .updateOne({ token: token }, { $inc: { entries: entries } })
            .catch((e) => this.logger.error("mongo error: %s", e.stack));
    } else {
        mongoChatPotTable
            .updateOne({ token: token }, { $set: { entries: 0 } })
            .catch((e) => this.logger.error("mongo error: %s", e.stack));
    }
};

DbClient.prototype.getLotteryTickets = function (token, dateA, dateB) {
    if (dateB) {
        return mongoPotQueTable
            .find({
                token: token,
                pot_date: { $gte: dateA, $lte: dateB },
            })
            .toArray();
    } else {
        return mongoPotQueTable.find({ token: token, pot_date: { $gte: dateA } }).toArray();
    }
};

DbClient.prototype.updatePotWinner = function (token, winner) {
    console.log("updatePotWinner ", token, winner);
    mongoChatPotTable
        .updateOne({ token: token }, { $set: { winner: winner } })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.logStartCommand = function (userId, username) {
    mongoStartUsersTable
        .updateOne(
            { user_id: userId },
            { $set: { clk_date: new Date(), user_name: username } },
            { upsert: true }
        )
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getStartUsers = function (date) {
    if (date) return mongoStartUsersTable.countDocuments({ clk_date: { $gte: date } });
    else return mongoStartUsersTable.countDocuments({});
};

DbClient.prototype.newWhiteList = function (chatId, wlName) {
    const obj = { chat_id: chatId, wl_name: wlName };
    mongoWhiteListTable.insertOne(obj).catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.getWhiteList = function (chatId, wlName) {
    return mongoWhiteListTable.findOne({ chat_id: chatId, wl_name: wlName });
};

DbClient.prototype.getWhiteLists = function (chatId) {
    return mongoWhiteListTable.find({ chat_id: chatId }).toArray();
};

DbClient.prototype.getWhiteListUsers = async function (chatId, wlName) {
    const wl = await this.getWhiteList(chatId, wlName);
    if (wl) {
        return mongoWListUserTable.distinct("user_id", { wl_id: wl._id });
    } else return null;
};

DbClient.prototype.insertWhiteUser = function (wlId, userId) {
    mongoWListUserTable
        .updateOne(
            { user_id: userId, wl_id: wlId },
            { $set: { user_id: userId } },
            { upsert: true }
        )
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.deleteWhiteUser = function (wlId, userId) {
    mongoWListUserTable
        .deleteOne({ user_id: userId, wl_id: wlId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

DbClient.prototype.deleteWhiteList = function (wlId) {
    mongoWListUserTable.deleteMany({ wl_id: wlId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
    mongoWhiteListTable.deleteOne({ _id: wlId })
        .catch((e) => this.logger.error("mongo error: %s", e.stack));
};

module.exports = DbClient;
