const Extra = require("telegraf/extra");
const {
    withdrawCallback,
    startStakeCallback,
    claimStakeCallback,
    tipCallback,
} = require("./../commands");
const { parseSendMessageError } = require("./../utils");

class EventsHandler {
    constructor(bot, i18n) {
        this.bot = bot;
        this.i18n = i18n;
        this.txError = this.txError.bind(this);
        this.txSuccess = this.txSuccess.bind(this);
        this.txHangUp = this.txHangUp.bind(this);
        this.twitError = this.twitError.bind(this);
    }

    txHangUp(key) {
        this.bot.context.logger.info("killing process by Hanging Tx %s", key);
        process.exit(1);
    }

    twitError(error, chatId) {
        const errCode = error[0].code;
        if (errCode === 89) {
            if (chatId) {
                return this.bot.telegram.sendMessage(
                    chatId,
                    '❗️Twitter functions not working. Please, try again later'
                );
            }
        }
    }

    txError(...args) {
        const [txType, ...rest] = args;
        const text = rest[2];
        const chatId = rest[0];
        const messageId = rest[1];
        this.bot.context.logger.debug(
            "txError (type) %s %s %s %s",
            txType,
            chatId,
            messageId,
            text
        );
        this.bot.telegram.sendMessage(
            chatId,
            text.message || text,
            Extra.inReplyTo(messageId)
        ).catch (e => this.bot.context.logger.debug(e.stack));
    }

    async sendMessage(rest, textKey) {
        const context = this.bot.context;
        const telegram = this.bot.telegram;

        const [srcObj, destObj, aValue, coinCode] = rest;

        const destId = (destObj.id === -1) ? context.devFee.devChat : destObj.id;

        const userSession = await context.database.getUserSession(destId);
        const lang = userSession ? userSession.data ? userSession.data.__language_code : "en" : "en";
        const msg = this.i18n.t(lang, textKey, {
            value: aValue,
            coin: coinCode,
            userName: srcObj.mention,
        });

        telegram
            .sendMessage(destId, msg, Extra.HTML())
            .then()
            .catch((e) => {
                const inType = parseSendMessageError(e);
                if (inType && context.globalOpts.markInactive)
                    context.database.setInactiveUser(destObj.id, inType);
            });
    }

    async txSuccess(...args) {
        const [txType, ...rest] = args;
        const context = this.bot.context;
        const telegram = this.bot.telegram;
        context.logger.debug("txSuccess txType: %s %s %s", txType, rest[3], rest[5]);
        try {
            switch (txType) {
                case 0: {
                    // fee post process
                    const chatId = context.devFee.devChat;
                    const pp = rest[4];
                    const userName = rest[0].name;
                    const coin = context.blockchain.getCoins()[rest[3]];
                    const txLink = `<a href="${coin.txExplorer}${rest[5]}">txHash</a>`;
                    const msg = `Fee: ${rest[2]} ${rest[3]} | ${userName} | ${txLink}`;
                    await telegram.sendMessage(chatId, msg, Extra.HTML());
                    context.logger.debug("tx fee %s %s %s", chatId, pp.chatId, pp.msgId);
                    await telegram.forwardMessage(chatId, pp.chatId, pp.msgId);
                    break;
                }
                case 10:
                case 1: {
                    // withdraw post process
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    const ctx = pp.ctx;
                    if (txType === 10) {
                        const chatId = context.devFee.devChat;
                        const coin = context.blockchain.getCoins()[coinCode];
                        const txLink = `<a href="${coin.txExplorer}${txHash}">txHash</a>`;
                        const msg = `Donation: ${aValue} ${coinCode} | ${srcObj.mention} | ${txLink}`;
                        await telegram.sendMessage(chatId, msg, Extra.HTML());
                    }
                    withdrawCallback(srcObj, destObj, aValue, coinCode, ctx, txHash, txType);
                    break;
                }
                case 2:
                case 3: {
                    // tip / give post process
                    await this.sendMessage(rest, "userGetTipped");
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    await tipCallback(srcObj, destObj, aValue, coinCode, pp.ctx, txHash, txType);
                    break;
                }
                case 4: {
                    // RAIN post process
                    await this.sendMessage(rest, "userGetRained");
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    await tipCallback(srcObj, destObj, aValue, coinCode, pp.ctx, txHash, txType);
                    break;
                }
                case 5: {
                    // lottery pot post process
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    await tipCallback(srcObj, destObj, aValue, coinCode, pp.ctx, txHash, txType);
                    break;
                }
                case 6: {
                    // lottery Win post process
                    await this.sendMessage(rest, "userGetLottery");
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    await tipCallback(srcObj, destObj, aValue, coinCode, pp.ctx, txHash, txType);
                    break;
                }
                case 7: {
                    const [srcObj, destObj, aValue, coinCode, pp, txHash] = rest;
                    const ctx = pp.ctx;
                    await startStakeCallback(srcObj, destObj, aValue, coinCode, ctx, txHash);
                    const chatId = context.devFee.devChat;
                    const user = JSON.stringify(ctx.from, null, 2);
                    const msg = `Staking: ${user} | ${aValue}`;
                    await telegram.sendMessage(chatId, msg, Extra.HTML());
                    break;
                }
                case 8: {
                    context.logger.debug("txSuccess Claim: %s", rest[1]);
                    await claimStakeCallback(txType, rest);
                    break;
                }
                case 9:
                    await claimStakeCallback(txType, rest);
                    break;
                default:
            }
        } catch (e) {
            context.logger.error(e.stack);
        }
    }
}

module.exports = {
    EventsHandler,
};
