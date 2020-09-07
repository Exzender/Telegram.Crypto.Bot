/**
 * Module with response functions to Actions in Groups
 */

const Extra = require("telegraf/extra");
const { formatUserMention, isBotAdmin, checkEncryptedPk } = require("./../utils");
const {
    calcFee,
    getFeeItem,
    getFeeByChat,
    getMinPotValue,
} = require("./../blockchain");
const { doPotBet } = require("./../commands");

const oneHour = 3600000;

/**
 * Group chat actions
 */
const makePotAction = () => async (ctx) => {
    const cnt = Number(ctx.match[1]);
    const token = ctx.match[2];
    const value = getMinPotValue(ctx, token) * cnt;
    ctx.logger.debug("makePotAction %s %s %s", cnt, token, value);
    ctx.answerCbQuery(ctx.i18n.t("potButtonBuy", { cnt: cnt }), true).then();
    return doPotBet(ctx, value, token);
};

const cancelGiveAction = () => async (ctx) => {
    const userId = Number(ctx.match[1]);
    if (userId === ctx.from.id || isBotAdmin(ctx)) {
        ctx.answerCbQuery().then();
        deleteBotMessage(ctx, ctx.callbackQuery.message);
    } else {
        return ctx.answerCbQuery(ctx.i18n.t("giverOnly"), true);
    }
};

const giveawayAction = () => async (ctx) => {
    const userId = Number(ctx.match[1]);

    const key = `${ctx.chat.id}:${ctx.callbackQuery.message.message_id}`;

    if (ctx.giveStateMap.has(key)) {
        ctx.logger.debug("already clicked");
        return ctx.answerCbQuery();
    }

    ctx.giveStateMap.set(key, 0);

    if (userId === ctx.from.id) {
        ctx.giveStateMap.delete(key);
        return ctx.answerCbQuery(ctx.i18n.t("selfClaim"), true);
    }

    if (!checkGiveawayClaim(ctx)) {
        ctx.giveStateMap.delete(key);
        return;
    }

    return processGiveaway(ctx, key);
};

/**
 * Helper functions
 */
function checkGiveawayClaim(ctx) {
    let hours = 25; // test if user already take it in 24h
    const userId = ctx.from.id;
    const mapKey = `${ctx.chat.id}:${userId}`;

    if (ctx.giveMap.has(mapKey)) {
        const lastDate = ctx.giveMap.get(mapKey);
        const nowDate = new Date();
        hours = (nowDate.getTime() - lastDate.getTime()) / oneHour;
        ctx.logger.debug("hours since claim : %s", hours);
    }

    if (hours > 24 || isBotAdmin(ctx)) {
        ctx.giveMap.set(mapKey, new Date());
        return true;
    } else {
        ctx.logger.debug("waitClaim");
        ctx
            .answerCbQuery(
                ctx.i18n.t("waitClaim", { hours: Math.round(24 - hours) }),
                true
            )
            .then();
        return false;
    }
}

function replyNotRegistered(ctx) {
    return ctx.answerCbQuery(ctx.i18n.t("notRegisteredClaim"), true);
}

async function processGiveaway(ctx, key) {
    const user = await ctx.database.getUser(ctx.from.id);
    if (!user) {
        replyNotRegistered(ctx);
        ctx.giveStateMap.delete(key);
        return;
    }

    ctx.answerCbQuery().catch((e) => {
        ctx.giveStateMap.delete(key);
        ctx.logger.error(e.stack);
    });
    const userName = formatUserMention(user);
    let msgText = `${ctx.callbackQuery.message.text}\n${ctx.i18n.t(
        "claimedBy",
        { userName: userName }
    )}`;
    if (ctx.globalOpts.messageFooter) msgText += "\n" + ctx.i18n.t("messageFooter", {botName: ctx.botName});
    ctx.telegram
        .editMessageText(
            ctx.chat.id,
            ctx.callbackQuery.message.message_id,
            null,
            msgText,
            Extra.HTML()
        )
        .catch((e) => {
            ctx.giveStateMap.delete(key);
            ctx.logger.error(e.stack);
        });

    const giverId = Number(ctx.match[1]);
    let giver = await ctx.database.getUser(giverId);

    const value = Number(ctx.match[2].replace(",", "."));
    // ctx.session.coinCode = ctx.match[3];
    giver.token = ctx.match[3];
    const coin = ctx.blockchain.getCoins()[giver.token];

    const feePcnt = getFeeByChat(ctx, "giveFee");
    const fee = calcFee(ctx.session.txValue, feePcnt, coin.minValue);

    const usersQueue = [];
    if (fee) {
        const feeItem = getFeeItem(fee, giver.token, coin);
        usersQueue.push(feeItem);
    }
    user.value = value;
    user.txType = 3;
    usersQueue.push(user);
    // process Give

    const pwd = ctx.match[4] || '';
    if (await checkEncryptedPk(ctx, giver, coin, pwd)) //, usersQueue);
        return ctx.blockchain.addMultiTxQuery(giver, usersQueue, ctx);
}

function deleteBotMessage(ctx, msg) {
    ctx.telegram
        .deleteMessage(msg.chat.id, msg.message_id)
        .catch(function (Error) {
            ctx.logger.error(Error.stack);
        });
}

module.exports = {
    cancelGiveAction,
    giveawayAction,
    makePotAction,
};
