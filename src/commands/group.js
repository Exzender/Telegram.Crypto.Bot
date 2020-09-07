/**
 * Module with functions for Group Commands
 */

const Extra = require("telegraf/extra");

const {
    isPrivateChat,
    isChatAdmin,
    formatUserMention,
    formatUserName,
    getRandomInt,
    splitLongMessage,
    isBotAdmin,
    getCryptoRandomInt,
    isUserRegistered,
    checkChatMembers,
    markForDelete,
    deleteBotMessage,
    checkEncryptedPk,
    checkPassword,
    resultMessage,
    checkChatMembersGlobal
} = require("./../utils");
const { giveButtons, lotteryButtons } = require("./../buttons");
const {
    calcFee,
    coinFormat,
    getFeeItem,
    getFeeByChat,
    getMinPotValue,
} = require("./../blockchain");

const oneHourMs = 60 * 60 * 1000;

const commandsMap = new Map([
    ["reward", tipCommand],
    ["tip", tipCommand],
    ["give", giveCommand],
    ["giveaway", giveCommand],
    ["airdrop", rainCommand],
    ["rain", rainCommand],
    ["rtrain", rtRainCommand],
    ["stat", statCommand],
    ["pot", potCommand],
    ["help", showHelp],
]);

const adminCommandsMap = new Map([
    ["locale", setLocale],
    ["defcoin", setDefCoin],
    ["deletereply", deleteReplyCommand],
    ["permitlottery", permitLotteryCommand],
    ["potnotify", potNotifyCommand],
    ["blacklist", blackListCommand],
    ["unblacklist", unBlackListCommand],
    ["adminonly", adminOnlyCommand],
    ["white", whiteListCommand],
    ["whitelist", whiteListCommand],
    ["whiteadd", whiteListAddCommand],
    ["whiteremove", whiteListRemoveCommand],
    ["whitepurge", whiteListPurgeCommand],
]);

const helpMap = new Map([
    ["reward", "tipHelp"],
    ["tip", "tipHelp"],
    ["give", "giveHelp"],
    ["giveaway", "giveHelp"],
    ["airdrop", "rainHelp"],
    ["rain", "rainHelp"],
    ["rtrain", "rtrainHelp"],
    ["stat", "statHelp"],
    ["pot", "potHelp"],
]);

const adminHelpMap = new Map([
    ["locale", "localeHelp"],
    ["defcoin", "defcoinHelp"],
    ["deletereply", "delRepHelp"],
    ["permitlottery", "permLotHelp"],
    ["unblacklist", "blacklistHelp"],
    ["blacklist", "blacklistHelp"],
    ["white", "wlistHelp"],
    ["whiteadd", "wlistHelp"],
    ["whiteremove", "wlistHelp"],
    ["whitepurge", "wlistHelp"],
    ["whitelist", "wlistHelp"],
]);

const testCommand = () => async (ctx) => {
    ctx.logger.debug("test command"); //, JSON.stringify(ctx.state.command, null, 2));
    return ctx.replyWithHTML(ctx.i18n.t("test"));
};

const selfKillCommand = () => async (ctx) => {
    ctx.logger.debug("self kill command");
    deleteBotMessage(ctx, ctx.message);
};

const anyCommand = () => async (ctx) => {
    const text = ctx.message ? ctx.message.text : "not msg";
    ctx.logger.debug("anyCommand chat: %s text: %s user: %s", ctx.chat.id, text, ctx.from.id);

    const cmd = parseCommandParams(ctx);
    if (!cmd) return null;

    return parseCommand(ctx, cmd);
};

const newChatMember = () => async (ctx) => {
    const members = ctx.message.new_chat_members;
    members.forEach((member) => {
        ctx.logger.debug("newChatMember %s %s", ctx.chat.id, member.id);
        if (member.username === ctx.botName) checkChatId(ctx);
        ctx.database.getUser(member.id).then((user) => {
            if (user) {
                ctx.logger.debug("new Chat %s User %s", ctx.chat.id, member.id);
                ctx.database.newChatUser(ctx.chat.id, member.id);
            }
        });
    });
};

const leftChatMember = () => async (ctx) => {
    ctx.logger.debug("leftChatMember %s", JSON.stringify(ctx.message.left_chat_member));
    ctx.database.deleteChatUser(ctx.chat.id, ctx.message.left_chat_member.id);
};

/**
 * Main commands in Chats
 */
async function setCommand(ctx, cmdObj) {
    const param = cmdObj.strings[0];
    const value = cmdObj.values[0];

    ctx.database.updateChat(ctx.chat.id, { [param]: value });

    const chatObj = ctx.chatsMap.get(ctx.chat.id);
    chatObj[param] = value;
}

async function tipCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return null;

    if (cmdObj.isBot) {
        if (cmdObj.users.length === 0) {
            if (cmdObj.replyName === `@${ctx.botName}`) {
                cmdObj.replyId = -1;
            } else {
                ctx.replyWithHTML(
                    ctx.i18n.t("tippingBot"),
                    Extra.inReplyTo(cmdObj.msgId)
                ).then((msg) => markForDelete(ctx, msg));
                return null;
            }
        }
    }

    const userIds = await getIdsFromNames(ctx, cmdObj);
    if (!userIds) return null;

    if (!userIds.length) {
        ctx.replyWithHTML(ctx.i18n.t("nobodyToTip"), Extra.inReplyTo(cmdObj.msgId)).then((msg) =>
            markForDelete(ctx, msg)
        );
        return null;
    }

    const txCount = userIds.length;
    const feePcnt = userIds[0] === -1 ? 0 : getFeeByChat(ctx, "tipFee");

    const tipObj = await checkTipGiveParams(ctx, cmdObj, feePcnt, txCount);
    if (!tipObj) return null;

    return doTip(ctx, userIds, tipObj, txCount);
}

async function giveCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    const feePcnt = getFeeByChat(ctx, "giveFee");
    const giveObj = await checkTipGiveParams(ctx, cmdObj, feePcnt, 1);
    if (!giveObj) return null;

    return doGive(ctx, giveObj.user, giveObj.value, giveObj.token);
}

async function rainCommand(ctx, cmdObj) {
    // if (channelCheck(ctx)) return;
    const feePcnt = getFeeByChat(ctx, "rainFee");
    const rainObj = await checkTipGiveParams(ctx, cmdObj, feePcnt, 1);
    if (!rainObj) return;

    ctx.logger.debug("rain tx fee: %s", rainObj.txfee);

    const rainParams = await checkRainParams(ctx, cmdObj, rainObj);
    if (!rainParams) return;

    const numUsers = rainParams.numUsers;

    if (!checkRainTimeout(ctx)) return;

    if (rainParams.wlName) {
        await ctx.replyWithHTML(
            ctx.i18n.t("preparingRainWL", { name: rainParams.wlName }),
            Extra.inReplyTo(cmdObj.msgId))
            .then((msg) => markForDelete(ctx, msg));
    } else {
        await ctx.replyWithHTML(
            ctx.i18n.t("preparingRain", { count: numUsers }),
            Extra.inReplyTo(cmdObj.msgId))
            .then((msg) => markForDelete(ctx, msg));
    }

    const list = await getUsersList(ctx, numUsers, rainParams.wlName);
    if (!list.length) {
        ctx.logger.warn("list is empty");
        ctx.replyWithHTML(ctx.i18n.t("emptyList", Extra.inReplyTo(cmdObj.msgId)))
            .then((msg) => markForDelete(ctx, msg));
        return;
    }

    ctx.logger.debug("rainCommand: %s", list);

    return doRain(ctx, rainObj, list);
}

async function rtRainCommand(ctx, cmdObj) {
    // ctx.replyWithHTML("Twitter related functions disabled").then((msg) => markForDelete(ctx, msg));
    // return;

    if (!cmdObj.strings.length) {
        ctx.replyWithHTML(ctx.i18n.t("noTwitLink")).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const twLink = cmdObj.strings[0];
    const twitId = ctx.twitter.parseTweetId(twLink);

    try {
        await ctx.twitter.getTweet(twitId, ctx.chat.id);
    } catch (e) {
        ctx.replyWithHTML(ctx.i18n.t("wrongTwitLink")).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const tweet = await ctx.database.getTweet(twitId);

    const firstTarget = cmdObj.values.length > 1 ? cmdObj.values[1] : undefined;

    if (firstTarget === 0) {
        if ((await updateTweet(ctx, twitId, cmdObj)) === null) return;
        await getRetweets(ctx, twitId);
        stopTweet(ctx, twitId);
        return doRtRain(ctx, twitId);
    }

    if (!tweet) {
        if ((await updateTweet(ctx, twitId, cmdObj, new Date())) === null) return;
        checkReteweetTimer(ctx);
        return showTwitInfo(ctx, twitId);
    } else {
        if (cmdObj.values.length === 0) {
            return showTwitInfo(ctx, twitId);
        } else if (cmdObj.values.length === 1) {
            if ((await updateTweet(ctx, twitId, cmdObj)) === null) return;
            await getRetweets(ctx, twitId);
            doRtRain(ctx, twitId).then();
            stopTweet(ctx, twitId);
        } else {
            if ((await updateTweet(ctx, twitId, cmdObj)) === null) return;
            return showTwitInfo(ctx, twitId);
        }
    }
}

async function statCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    if (cmdObj.coins.length) {
        return showCoinStat(ctx, cmdObj.coins[0]);
    } else {
        return showGlobalStat(ctx);
    }
}

async function potCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    if (!ctx.chatsMap.get(ctx.chat.id).lottery) {
        ctx.replyWithHTML(ctx.i18n.t("potDisabled")).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const userIds = await getIdsFromNames(ctx, cmdObj);

    ctx.logger.debug("potCommand %s", userIds);

    const token = cmdObj.coins.length ? cmdObj.coins[0] : getDefChatCoin(ctx);

    if (userIds.length && !cmdObj.values.length) {
        ctx.logger.debug("potCommand set def value for %s", userIds[0]);
        const minPotValue = getMinPotValue(ctx, token);
        cmdObj.values.push(minPotValue);
    }

    if (cmdObj.values.length) {
        return doPotBet(ctx, cmdObj.values[0], token, userIds);
    } else {
        return showPotMessage(ctx, token);
    }
}

async function setDefCoin(ctx, comObj) {
    const chatObj = ctx.chatsMap.get(ctx.chat.id);
    if (comObj.coins.length) {
        const coinName = comObj.coins[0].toUpperCase();

        ctx.logger.debug("defcoin %s chat %s admin %s", coinName, ctx.chat.id, ctx.from.username);
        ctx.database.updateChat(ctx.chat.id, { def_coin: coinName });
        chatObj.def_coin = coinName;

        ctx.replyWithHTML(ctx.i18n.t("groupCoinSet", { coin: coinName })).then((msg) =>
            markForDelete(ctx, msg)
        );
    } else {
        if (comObj.strings.length) {
            ctx.replyWithHTML(
                ctx.i18n.t("unsupportedCoin", { coin: comObj.strings[0] })
            ).then((msg) => markForDelete(ctx, msg));
        } else {
            const coinName = chatObj.def_coin;
            ctx.replyWithHTML(ctx.i18n.t("groupCoinSet", { coin: coinName })).then((msg) =>
                markForDelete(ctx, msg)
            );
        }
    }
}

async function setDeleteReply(ctx, comObj, valueName) {
    const chatObj = ctx.chatsMap.get(ctx.chat.id);

    let setDelete = chatObj[valueName];

    if (comObj.strings.length) {
        const newValue = comObj.strings[0].toLowerCase();
        if (newValue === "true" || newValue === "on") setDelete = 1;
        if (newValue === "false" || newValue === "off") setDelete = 0;
    } else if (comObj.values.length) {
        setDelete = comObj.values[0] ? 1 : 0;
    }

    ctx.logger.debug(
        "%s %s chat %s admin %s",
        valueName,
        setDelete,
        ctx.chat.id,
        ctx.from.username
    );
    ctx.database.updateChat(ctx.chat.id, { [valueName]: setDelete });
    chatObj[valueName] = setDelete;

    let msgBase;
    switch (valueName) {
        case "lottery":
            msgBase = ctx.i18n.t("groupPermitLottery");
            break;
        case "potnotify":
            msgBase = ctx.i18n.t("groupPermitPotNotify");
            break;
        case "adminrestr":
            msgBase = ctx.i18n.t("groupPermitAdminOnly");
            break;
        default:
            msgBase = ctx.i18n.t("groupDeleteReply");
    }

    const msgText = setDelete ? ctx.i18n.t("groupValueOn") : ctx.i18n.t("groupValueOff");
    ctx.replyWithHTML(`${msgBase} ${msgText}`).then((msg) => markForDelete(ctx, msg));
}

async function setLocale(ctx, comObj) {
    if (comObj.strings.length) {
        const locale = comObj.strings[0].toLowerCase();
        ctx.logger.debug("setLocale %s chat %s admin %s", locale, ctx.chat.id, ctx.from.username);

        ctx.i18n.locale(locale);
        ctx.session.__language_code = locale;
        ctx.mongoSession.instSaveSession(ctx);

        ctx.replyWithHTML(ctx.i18n.t("language", { botName: ctx.botUserName }))
            .then((msg) => markForDelete(ctx, msg));
    } else {
        ctx.replyWithHTML(ctx.i18n.t("groupNoLocale")).then((msg) => markForDelete(ctx, msg));
    }
}

async function whiteListCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    const chatId = ctx.chat.id;

    if (cmdObj.strings.length) {      // create or list WL

        const wlName = cmdObj.strings[0];

        if (wlName.toUpperCase() === "MAX" || wlName.toUpperCase() === "ALL") {
            ctx.replyWithHTML(ctx.i18n.t("wrongWLname", { name: wlName })).then((msg) =>
                markForDelete(ctx, msg)
            );
            return;
        }

        const wl = await ctx.database.getWhiteList(chatId, wlName);

        if (wl) {             // get users in WL
            const wlUsers = await ctx.database.getWhiteListUsers(chatId, wlName);

            if (wlUsers.length) {
                const users = await ctx.database.getUsersByIds(wlUsers);

                let msgText = ctx.i18n.t("WLlistUsers", { name: wlName }) + "\n\n";
                for (let i = 0; i < users.length; i++) {
                    const item = users[i];
                    const msgAdd = `${i + 1}. ` + formatUserMention(item);
                    const msgObj = await splitLongMessage(msgText, msgAdd, ctx);
                    msgText = msgObj.replyMessage;
                    if (msgObj.msgId) {
                        markForDelete(ctx, msgObj.msgId, ctx.globalOpts.deleteInterval * 3);
                    }
                }
                ctx.replyWithHTML(msgText).then((msg) =>
                    markForDelete(ctx, msg, ctx.globalOpts.deleteInterval * 3)
                );
            } else {
                ctx.replyWithHTML(ctx.i18n.t("WLempty", { name: wlName })).then((msg) =>
                    markForDelete(ctx, msg)
                );
            }
        } else {
            // register new WL
            ctx.database.newWhiteList(chatId, wlName);
            ctx.replyWithHTML(ctx.i18n.t("newWList", { name: wlName })).then((msg) =>
                markForDelete(ctx, msg)
            );
        }
    } else {
        // list WLs
        const wls = await ctx.database.getWhiteLists(chatId);

        if (wls.length) {
            let msgText = ctx.i18n.t("WLlist") + "\n\n";

            for (let i = 0; i < wls.length; i++) {
                msgText += `- ${wls[i].wl_name} \n`;
            }

            ctx.replyWithHTML(msgText).then((msg) =>
                markForDelete(ctx, msg, ctx.globalOpts.deleteInterval * 2)
            );
        } else {
            ctx.replyWithHTML(ctx.i18n.t("noWLinChat")).then((msg) => markForDelete(ctx, msg));
        }
    }
}

async function checkWL(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    if (!cmdObj.strings.length) {
        ctx.replyWithHTML(ctx.i18n.t("wrongWLparams")).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const chatId = ctx.chat.id;

    const wlName = cmdObj.strings[0];
    const wl = await ctx.database.getWhiteList(chatId, wlName);
    if (!wl) {
        ctx.replyWithHTML(ctx.i18n.t("unknownWL", { name: wlName })).then((msg) =>
            markForDelete(ctx, msg)
        );
        return;
    }

    const userIds = await getIdsFromNames(ctx, cmdObj);
    if (!userIds.length) {
        ctx.replyWithHTML(ctx.i18n.t("wrongWLparams")).then((msg) => markForDelete(ctx, msg));
        return;
    }

    return { wlId: wl._id, ids: userIds, wlName: wlName };
}

async function whiteListAddCommand(ctx, cmdObj) {
    const wlObj = await checkWL(ctx, cmdObj);

    if (!wlObj) return;

    if (cmdObj.isBot) {
        if (cmdObj.users.length === 0) {
            ctx.replyWithHTML(ctx.i18n.t("wlistBot"), Extra.inReplyTo(cmdObj.msgId)).then((msg) =>
                markForDelete(ctx, msg)
            );
            return;
        }
    }

    wlObj.ids.forEach((userId) => ctx.database.insertWhiteUser(wlObj.wlId, userId));
    ctx.replyWithHTML(ctx.i18n.t("WLuseradded", { name: wlObj.wlName })).then((msg) =>
        markForDelete(ctx, msg)
    );
}

async function whiteListRemoveCommand(ctx, cmdObj) {
    const wlObj = await checkWL(ctx, cmdObj);

    if (!wlObj) return;

    wlObj.ids.forEach((userId) => ctx.database.deleteWhiteUser(wlObj.wlId, userId));
    ctx.replyWithHTML(ctx.i18n.t("WLuserremoved", { name: wlObj.wlName })).then((msg) =>
        markForDelete(ctx, msg)
    );
}

async function whiteListPurgeCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    const chatId = ctx.chat.id;

    if (cmdObj.strings.length) {
        // delete WL
        const wlName = cmdObj.strings[0];

        const wl = await ctx.database.getWhiteList(chatId, wlName);

        if (wl) {
            ctx.database.deleteWhiteList(wl._id);
            ctx.replyWithHTML(ctx.i18n.t("WLdeleted", { name: wlName })).then((msg) =>
                markForDelete(ctx, msg)
            );
        } else {
            ctx.replyWithHTML(ctx.i18n.t("unknownWL", { name: wlName })).then((msg) =>
                markForDelete(ctx, msg)
            );
        }
    } else {
        ctx.replyWithHTML(ctx.i18n.t("wrongWLparams")).then((msg) => markForDelete(ctx, msg));
    }
}

async function blackListCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    const userIds = await getIdsFromNames(ctx, cmdObj);
    if (!userIds.length) return;

    if (cmdObj.isBot) {
        if (cmdObj.users.length === 0) {
            ctx.replyWithHTML(
                ctx.i18n.t("blacklistBot"),
                Extra.inReplyTo(cmdObj.msgId)
            ).then((msg) => markForDelete(ctx, msg));
            return;
        }
    }

    userIds.forEach((userId) => blackListUser(ctx, userId));
}

async function unBlackListCommand(ctx, cmdObj) {
    if (channelCheck(ctx)) return;

    const userIds = await getIdsFromNames(ctx, cmdObj);
    if (!userIds.length) return;

    userIds.forEach((userId) => unBlackListUser(ctx, userId));
}

/**
 * Callback functions
 */
const tipCallback = async (srcObj, destObj, aValue, coinCode, ctx, txHash, txType) => {
    const chatId = ctx.chat ? ctx.chat.id : 0;
    ctx.database.logOperationDb(txType, srcObj, destObj, aValue, txHash, chatId, coinCode);

    if (txType === 2) {
        if (destObj.id === -1) {
            ctx.replyWithHTML(
                ctx.i18n.t("botTipped", {
                    userName: srcObj.mention,
                    value: aValue,
                    coin: coinCode
                })
            ).catch((e) => {
                ctx.logger.error(e.stack);
            });
        } else {
            resultMessage(ctx, "userTipped", {
                userName: srcObj.mention,
                value: aValue,
                coin: coinCode,
                userNameR: destObj.mention,
            });
        }
        //.then((msg) => markForDelete(ctx, msg)); // NOTE no delete
    } else if (txType === 5) {
        const minPotValue = getMinPotValue(ctx, coinCode);
        const cnt = aValue / minPotValue;

        ctx.database.updatePotEntries(coinCode, cnt);

        const chatId = ctx.chat.id;
        const userId = srcObj.id;
        const pots = [];
        for (let i = 0; i < cnt; i++) {
            // add record(s) to Pot's queue
            const entrieObj = {
                chat_id: chatId,
                user_id: destObj.potUserId || userId,
                pot_date: new Date(),
                token: coinCode,
            };
            pots.push(entrieObj);
        }

        ctx.database.insertNewPots(pots);

        let msgText;
        if (destObj.potUserId) {
            const dUser = await ctx.database.getUser(destObj.potUserId);
            const dUserName = formatUserMention(dUser);
            ctx.logger.debug("makink pot for %s", dUserName);
            msgText = ctx.i18n.t("potBoughtFor", {
                userName: srcObj.mention,
                cnt: cnt,
                value: aValue,
                coinName: coinCode,
                destUser: dUserName,
            });
        } else {
            msgText = ctx.i18n.t("potBought", {
                userName: srcObj.mention,
                cnt: cnt,
                value: aValue,
                coinName: coinCode,
            });
        }

        ctx.replyWithHTML(msgText).catch((e) => {
            ctx.logger.error(e.stack);
        });

        setTimeout(generatePotStatMessage, 5000, ctx, coinCode);
    }
};

/**
 * Helper functions
 */
function isPotSilenceInterval(ctx, globalPotTime) {
    const dateNow = new Date();

    let dt = new Date();
    dt.setTime(globalPotTime.getTime() + 2 * ctx.globalOpts.giveAutoMult);

    let dte = new Date();
    dte.setTime(globalPotTime.getTime() - 2 * ctx.globalOpts.giveAutoMult);

    // ctx.logger.debug("isPotSilenceInterval now %s end %s st %s", dateNow, dte, dt);
    return dateNow > dte && dateNow < dt;
}

async function calcPotTickets(ctx, token) {
    const userId = ctx.from.id;
    let date = new Date();
    const lotteryDate = calcLotteryTime();

    date.setTime(lotteryDate.getTime());
    date.setUTCDate(lotteryDate.getDate() - 7);

    ctx.logger.debug("calcPotTickets %s", date);

    const tickets = await ctx.database.getPotTickets(userId, token, date);
    if (tickets > 0) {
        ctx.replyWithHTML(
            ctx.i18n.t("potHaveTickets", { count: tickets, coinName: token }),
            Extra.inReplyTo(ctx.message.message_id)
        ).then((msg) => markForDelete(ctx, msg));
    }
}

function newChatPot(ctx, token) {
    const coin = ctx.blockchain.coins[token];
    const wallet = ctx.blockchain.registerWallet(coin.platform);
    const potObj = {
        wallet_address: wallet.walletAddress,
        wallet_key: wallet.walletKey,
        entries: 0,
        token: token,
    };
    ctx.database.newChatPot(potObj);
    return potObj;
}

async function generatePotStatMessage(ctx, token, onTimer = false) {
    const chatPot = await ctx.database.getPotStat(token);
    ctx.logger.debug("generatePotStatMessage %s", token);
    let potEntries;
    if (!chatPot) {
        newChatPot(ctx, token);
        potEntries = 0;
    } else {
        potEntries = chatPot.entries;
    }

    let messageText = ctx.i18n.t("potHeader", { coinName: token }) + "\n\n";
    const minPotValue = getMinPotValue(ctx, token);

    const val = coinFormat(potEntries * minPotValue * 0.9, 3);

    if (potEntries > 0) {
        messageText +=
            ctx.i18n.t("potValue", { cnt: potEntries, value: val, coinName: token }) + "\n";

        const dte = calcLotteryTime();
        let dt = new Date();
        dt.setTime(dte.getTime() - 2 * oneHourMs);

        const locale = ctx.i18n.locale();

        const options = {
            month: "long",
            day: "numeric",
            weekday: "short",
            hour: "numeric",
            minute: "numeric",
            timeZone: "UTC",
            // second: 'numeric',
            timeZoneName: "short",
        };

        messageText +=
            ctx.i18n.t("potDeadLine", { date: dt.toLocaleString(locale, options) }) + "\n";
        messageText +=
            ctx.i18n.t("potDrawDate", { date: dte.toLocaleString(locale, options) }) + "\n";
    } else {
        messageText += "🚫 Current Lottery Pot is empty\n";
    }

    if (chatPot) {
        if (chatPot.winner) {
            messageText += "\n" + ctx.i18n.t("potLastWeek") + "\n" + chatPot.winner;
        }
    }

    messageText += "\n" + ctx.i18n.t("potRules");

    try {
        ctx.logger.debug("generatePotStatMessage show msg %s", token);
        const msg = await ctx.replyWithHTML(messageText, Extra.markup(lotteryButtons(ctx, token)));

        if (onTimer) {
            return msg;
        } else {
            markForDelete(ctx, msg);
            return null;
        }
    } catch (e) {
        const eStr = e.toString();
        ctx.logger.debug(e);
        if (eStr.indexOf("was kicked") !== -1 || eStr.indexOf("chat not found") !== -1) {
            ctx.database.deleteChat(ctx.chat.id);
            ctx.chatsMap.delete(ctx.chat.id);
        }
        return null;
    }
}

function calcLotteryTime(day = 5, hour = 19) {
    let dt = new Date();
    const weekday = dt.getDay();

    // console.log('calcLotteryTime day %s weekd %s', day, weekday);

    const diff = day - weekday;

    dt.setUTCDate(dt.getDate() + diff);
    dt.setUTCHours(hour, 0, 0, 0);

    const now = new Date();

    if (dt < now) dt.setUTCDate(dt.getDate() + 7);

    const delta = now - (dt - 7 * 24 * oneHourMs); // now.getTime() - (dt.getTime() - (7 * 24 * oneHourMs));
    if (delta < oneHourMs * 2 && delta > 0) {
        console.log("calcLotteryTime minus 7");
        dt.setUTCDate(dt.getDate() - 7);
    }

    return dt;
}

async function showPotMessage(ctx, token) {
    await calcPotTickets(ctx, token);
    return generatePotStatMessage(ctx, token);
}

async function doPotBet(ctx, value, token, userIds) {
    const globalPotTime = calcLotteryTime();
    if (isPotSilenceInterval(ctx, globalPotTime)) {
        ctx.logger.info("doPot - silence");
        const dateNow = new Date();
        const irv = Math.round(
            Math.abs((dateNow.getTime() - (globalPotTime.getTime() + 2 * oneHourMs)) / oneHourMs)
        );
        ctx.replyWithHTML(ctx.i18n.t("potWaitNext", { irv: irv })).then((msg) =>
            markForDelete(ctx, msg)
        );
    } else {
        return makeUserPot(ctx, value, token, userIds);
    }
}

async function makeUserPot(ctx, value, token, userIds) {
    const userId = ctx.from.id;

    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    const minPotValue = getMinPotValue(ctx, token);

    const cntUsers = userIds ? userIds.length || 1 : 1;

    if (value < minPotValue) {
        ctx.replyWithHTML(
            ctx.i18n.t("potMinValue", { minValue: minPotValue, coinName: token })
        ).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const cnt = Math.floor(value / minPotValue);
    const potValue = minPotValue * cnt;

    const coin = ctx.blockchain.coins[token];

    const addr = user[`${coin.platform}_wallet_address`];
    if (!(await checkCommandBalance(ctx, token, addr, potValue, cntUsers, 0, 0, false))) return;

    return storeChatPot(ctx, user, potValue, token, userIds);
}

async function storeChatPot(ctx, user, potValue, token, userIds) {
    ctx.logger.debug("storeChatPot %s %s", potValue, token);

    let chatPot = await ctx.database.getPotStat(token);

    if (!chatPot) {
        chatPot = newChatPot(ctx, token);
    }

    // ctx.session.coinCode = token;
    user.token = token;
    const usersQueue = [];

    let itemDest = {
        user_name: `pot${token}`,
        user_id: 0,
        wallet_address: chatPot.wallet_address,
        value: potValue,
        txType: 5,
    };

    if (userIds) {
        if (userIds.length) {
            for (let i = 0; i < userIds.length; i++) {
                let potItem = JSON.parse(JSON.stringify(itemDest));
                potItem.potUserId = userIds[i];
                usersQueue.push(potItem);
                ctx.logger.debug(potItem);
            }
        } else {
            usersQueue.push(itemDest);
        }
    } else {
        usersQueue.push(itemDest);
    }

    const coin = ctx.blockchain.getCoins()[token];

    if (await checkEncryptedPk(ctx, user, coin))
        //), usersQueue);
        ctx.blockchain.addMultiTxQuery(user, usersQueue, ctx);
}

async function showGlobalStat(ctx) {
    let message = ctx.i18n.t("statAllHeader", { botName: ctx.botName }) + "\n-\n";

    const result = await ctx.database.getAllStats(ctx.chat.id);
    if (result.length) {
        let sum = 0;
        for (let i = 0; i < result.length; i++) {
            const dbItem = result[i];
            const typ = dbItem._id;
            const val = dbItem.count;
            sum += val;
            const obj = { val: val };
            if (typ === 2) {
                message += ctx.i18n.t("statAllTips", obj) + "\n";
            } else if (typ === 3) {
                message += ctx.i18n.t("statAllGivs", obj) + "\n";
            } else if (typ === 4) {
                message += ctx.i18n.t("statAllRains", obj) + "\n";
            } else if (typ === 5) {
                message += ctx.i18n.t("statAllLott", obj) + "\n";
            }
        }
        const obj = { sum: sum };
        message += "-\n" + ctx.i18n.t("statAllSum", obj);
        message += "\n-----\n" + ctx.i18n.t("statMemo");
    } else {
        ctx.logger.info("Total spent - not found");
    }
    ctx.replyWithHTML(message).then((msg) => markForDelete(ctx, msg));
}

async function showCoinStat(ctx, token) {
    let message = ctx.i18n.t("statHeader", { botName: ctx.botName, coinName: token }) + "\n-\n";
    const coin = ctx.blockchain.getCoins()[token];

    let result = await ctx.database.getStats(ctx.chat.id, token);
    if (result.length) {
        let sum = 0;
        for (let i = 0; i < result.length; i++) {
            const dbItem = result[i];
            const typ = dbItem._id;
            const val = coinFormat(dbItem.pp, coin.decimals);
            sum += val;
            const obj = { val: val, coinName: token };
            if (typ === 2) {
                message += ctx.i18n.t("statTips", obj) + "\n";
            } else if (typ === 3) {
                message += ctx.i18n.t("statGivs", obj) + "\n";
            } else if (typ === 4) {
                message += ctx.i18n.t("statRains", obj) + "\n";
            } else if (typ === 5) {
                message += ctx.i18n.t("statLott", obj) + "\n";
            }
        }
        const obj = { sum: sum, coinName: token };
        message += "-\n" + ctx.i18n.t("statSum", obj) + "\n-\n";
    } else {
        ctx.logger.info("Total spent - not found");
    }

    // query Spent most
    result = await ctx.database.getSpentStats(ctx.chat.id, token);
    if (result.length) {
        let dbItem = result[0];
        let val = coinFormat(dbItem.pp, coin.decimals);
        message += ctx.i18n.t("statSpent") + '\n';
        let user = await ctx.database.getUser(dbItem._id.unm);
        message += `1️⃣ ${formatUserMention(user)} ${ctx.i18n.t("spentWord")} ${val} ${token}\n`;
        if (result.length > 1) {
            dbItem = result[1];
            user = await ctx.database.getUser(dbItem._id.unm);
            val = coinFormat(dbItem.pp, coin.decimals);
            message += `2️⃣ ${formatUserMention(user)} ${ctx.i18n.t("spentWord")} ${val} ${token}\n`;
        }
        if (result.length > 2) {
            dbItem = result[2];
            user = await ctx.database.getUser(dbItem._id.unm);
            val = coinFormat(dbItem.pp, coin.decimals);
            message += `3️⃣ ${formatUserMention(user)} ${ctx.i18n.t("spentWord")} ${val} ${token}\n`;
        }
    } else {
        ctx.logger.info('Spent most - not found');
    }

    // query Recieved most
    result = await ctx.database.getRcvStats(ctx.chat.id, token);
    if (result.length) {
        message += '\n';
        let dbItem = result[0];
        let val = coinFormat(dbItem.pp, coin.decimals);
        message += ctx.i18n.t("statReceived") + '\n';
        let user = await ctx.database.getUser(dbItem._id.unm);
        message += `1️⃣ ${formatUserMention(user)} ${ctx.i18n.t("receivedWord")} ${val} ${token}\n`;
        if (result.length > 1) {
            dbItem = result[1];
            val = coinFormat(dbItem.pp, coin.decimals);
            user = await ctx.database.getUser(dbItem._id.unm);
            message += `2️⃣ ${formatUserMention(user)} ${ctx.i18n.t("receivedWord")} ${val} ${token}\n`;
        }
        if (result.length > 2) {
            dbItem = result[2];
            val = coinFormat(dbItem.pp, coin.decimals);
            user = await ctx.database.getUser(dbItem._id.unm);
            message += `3️⃣ ${formatUserMention(user)} ${ctx.i18n.t("receivedWord")} ${val} ${token}\n`;
        }
    } else {
        ctx.logger.info('received most - not found');
    }

    // query Tipped most 2
    result = await ctx.database.getTipStats(ctx.chat.id, token);
    if (result.length) {
        message += '\n';
        let dbItem = result[0];
        message += ctx.i18n.t("statTip") + '\n';
        let user = await ctx.database.getUser(dbItem._id.unm);
        message += `1️⃣ ${formatUserMention(user)} ${ctx.i18n.t("tippedWord",{count: dbItem.count})}\n`;
        if (result.length > 1) {
            dbItem = result[1];
            user = await ctx.database.getUser(dbItem._id.unm);
            message += `2️⃣ ${formatUserMention(user)} ${ctx.i18n.t("tippedWord",{count: dbItem.count})}\n`;
        }
        if (result.length > 2) {
            dbItem = result[2];
            user = await ctx.database.getUser(dbItem._id.unm);
            message += `3️⃣ ${formatUserMention(user)} ${ctx.i18n.t("tippedWord", {count: dbItem.count})}\n`;
        }
    } else {
        ctx.logger.info('tipped most - not found');
    }

    // query Rains Lucky
    result = await ctx.database.getRainsStats(ctx.chat.id, token);
    if (result.length) {
        message += '\n';
        const dbItem = result[0];
        const val = coinFormat(dbItem.pp, coin.decimals);
        message += ctx.i18n.t("statRain") + '\n';
        const user = await ctx.database.getUser(dbItem._id.unm);
        const obj = {count: dbItem.count, val: val, token: token};
        message += `🍀 ${formatUserMention(user)} ${ctx.i18n.t("rainWord", obj)}\n`;
    } else {
        ctx.logger.info('Rains champion - not found');
    }

    // query Claims champion
    result = await ctx.database.getClaimsStats(ctx.chat.id, token);
    if (result.length) {
        message += '\n';
        const dbItem = result[0];
        const val = coinFormat(dbItem.pp, coin.decimals);
        message += ctx.i18n.t("statClaim") + '\n';
        const user = await ctx.database.getUser(dbItem._id.unm);
        const obj = {count: dbItem.count, val: val, token: token};
        message += `🏅 ${formatUserMention(user)} ${ctx.i18n.t("claimedWord", obj)}\n`;
    } else {
        ctx.logger.info('Claims champion - not found');
    }

    // query Lottery champion
    result = await ctx.database.getPotStats(ctx.chat.id, token);
    if (result.length) {
        message += '\n';
        const dbItem = result[0];
        const val = coinFormat(dbItem.pp, coin.decimals);
        message += ctx.i18n.t("statPot") + '\n';
        const user = await ctx.database.getUser(dbItem._id.unm);
        const obj = {count: dbItem.count, val: val, token: token};
        message += `🏅 ${formatUserMention(user)} ${ctx.i18n.t("lottWord", obj)}\n`;
    } else {
        ctx.logger.info('Lottery champion - not found');
    }

    ctx.replyWithHTML(message).then((msg) => markForDelete(ctx, msg));
}

async function showTwitInfo(ctx, twitId) {
    const tweets = await getRetweets(ctx, twitId);
    const tweet = await ctx.database.getTweet(twitId);

    const obj = {
        twid: twitId,
        date: tweet.date_reg.toLocaleDateString(ctx.i18n.locale()),
        value: tweet.value,
        token: tweet.token,
        tgt: `${tweet.targetA}, ${tweet.targetB}, ${tweet.targetC}, ${tweet.targetD} `,
        count: tweets,
        stt: tweet.is_active ? "Active" : "Finished",
    };
    ctx.replyWithHTML(ctx.i18n.t("twitInfo", obj)).then((msg) => markForDelete(ctx, msg));
}

async function getRetweetsCount(ctx, twitId) {
    try {
        const dbCount = await ctx.database.countReTweets(twitId);
        // ctx.logger.info("RetweetsCount = %s", dbCount);
        const obj = {
            tweet_id: twitId,
            retweet_count: dbCount,
        };
        ctx.database.updateTweet(obj);
        return dbCount;
    } catch (e) {
        ctx.logger.error("mongo error: %s", e.stack);
    }
}

async function getRetweets(ctx, twitId) {
    try {
        const retweets = await ctx.twitter.getReTweets(twitId);
        for (let i = 0; i < retweets.length; i++) {
            let obj = retweets[i]; // save retweets  (upsert - to)
            try {
                await ctx.database.updateReTweet(twitId, obj.retweet_id, obj.twit_user_id);
            } catch (e) {
                ctx.logger.error(e.stack);
            }
        }
        return await getRetweetsCount(ctx, twitId);
    } catch (e) {
        ctx.logger.error("tweet error: %s", e.stack);
    }
}

async function updateTweet(ctx, twitId, cmdObj, date) {
    let targets = [];
    if (cmdObj.values.length > 1) {
        targets = Array.from(new Set(cmdObj.values.slice(1))).sort((a, b) => a - b);
    }

    ctx.logger.debug(targets);

    const value = cmdObj.values[0];
    const token = cmdObj.coins.length ? cmdObj.coins[0] : getDefChatCoin(ctx);

    const user = await ctx.database.getUser(ctx.from.id);
    const pwd = checkPassword(ctx, user);
    if (pwd === null) return null;

    const tweetObj = {
        tweet_id: twitId,
        tweet_link: cmdObj.strings[0],
        user_id: ctx.from.id,
        chat_id: ctx.chat.id,
        targetA: targets.length ? targets[0] : null,
        targetB: targets.length > 1 ? targets[1] : null,
        targetC: targets.length > 2 ? targets[2] : null,
        targetD: targets.length > 3 ? targets[3] : null,
        is_active: 1,
        value: value,
        token: token,
        password: pwd,
    };
    if (date) tweetObj.date_reg = date;
    return ctx.database.updateTweet(tweetObj);
}

function stopTweet(ctx, tweetId) {
    ctx.database.disableTweet(tweetId);
}

async function getRetweetersList(ctx, tweet) {
    try {
        const items = await ctx.database.getReTweeters(tweet.tweet_id);
        const chatList = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.user_id !== tweet.user_id) {
                // exclude caller id
                const userName = formatUserMention(item);
                const objUser = {
                    userId: item.user_id,
                    userName: userName,
                    userItem: item,
                    userStatus: "member",
                    userActive: item.inactive,
                    userActDate: item.inactive_date,
                    twit_user_id: item.twit_user_id,
                };
                chatList.push(objUser);
            }
        }
        return chatList;
    } catch (e) {
        ctx.logger.error("mongo error: %s", e.stack);
    }
}

async function getContext(ctx, userId, chatId) {
    let tCtx = ctx;

    ctx.logger.debug("getContext user %s chat %s", userId, chatId);

    if (!ctx.chat || !userId) {
        // manually create context
        tCtx = {};
        tCtx.logger = ctx.logger;
        tCtx.database = ctx.database;
        tCtx.blockchain = ctx.blockchain;
        tCtx.chatsMap = ctx.chatsMap;
        tCtx.devFee = ctx.devFee;
        tCtx.telegram = ctx.tg;
        tCtx.globalOpts = ctx.globalOpts;

        tCtx.chat = {
            id: chatId,
        };

        if (userId) {
            const user = await tCtx.database.getUser(userId);
            tCtx.from = {
                id: user.user_id,
                username: user.user_name,
                first_name: user.user_first_name,
                last_name: user.user_last_name,
            };
        }

        let lang = "en";
        try {
            const userSession = await tCtx.database.getUserSession(tCtx.chat.id);
            lang = userSession ? userSession.data.__language_code : "en";
        } catch (e) {
            ctx.logger.error("mongo error %s", e.stack);
        }

        tCtx.session = {
            __language_code: lang,
        };

        tCtx.updateType = "message";

        tCtx.message = {
            message_id: 0,
        };

        tCtx.i18n = ctx.i18.createContext(lang);

        tCtx.replyWithHTML = (html, extra) => {
            return ctx.tg.sendMessage(tCtx.chat.id, html, { parse_mode: "HTML", ...extra });
        };
    }

    ctx.logger.debug("getContext end");

    return tCtx;
}

async function doRtRain(ctx, tweetId, cnt) {
    ctx.logger.debug("doRtRain %s", tweetId);

    const tweet = await ctx.database.getTweet(tweetId);

    const tCtx = await getContext(ctx, tweet.user_id, tweet.chat_id);

    const feePcnt = getFeeByChat(tCtx, "rainFee");

    const cmdObj = {
        command: "rtrain",
        coins: [tweet.token],
        values: [tweet.value],
        msgId: 0,
    };

    const rainObj = await checkTipGiveParams(tCtx, cmdObj, feePcnt, 1);
    if (!rainObj) return;

    rainObj.password = tweet.password;

    tCtx.logger.debug("rtrain tx fee: %s", rainObj.txfee);

    const numUsers = tweet.retweet_count;
    if (cnt) {
        tCtx.replyWithHTML(
            tCtx.i18n.t("twitTarget", {
                cnt: cnt,
                link: tweet.tweet_link,
            }),
            Extra.webPreview(false)
        ).then();
    } else {
        tCtx.replyWithHTML(
            tCtx.i18n.t("twitRain", {
                cnt: numUsers,
                link: tweet.tweet_link,
            }),
            Extra.webPreview(false)
        ).then();
    }
    // .then(msg => markForDelete(tCtx, msg));

    const list = await getRetweetersList(tCtx, tweet);

    if (!list.length) {
        tCtx.logger.warn("list is empty");
        tCtx.replyWithHTML(tCtx.i18n.t("emptyList")).then((msg) => markForDelete(tCtx, msg));
        return;
    }

    tCtx.logger.debug("rainCommand: %s", list);

    rainObj.twitLink = tweet.tweet_link;

    return doRain(tCtx, rainObj, list);
}

async function checkRetweetsTarget(ctx, twitId, cnt) {
    const tweet = await ctx.database.getTweet(twitId);

    const ltrs = ["A", "B", "C", "D", "E"];

    for (let i = 0; i < 4; i++) {
        if (tweet[`target${ltrs[i]}`] > 0) {
            if (cnt >= tweet[`target${ltrs[i]}`]) {
                await doRtRain(ctx, twitId, tweet[`target${ltrs[i]}`]);
                if (tweet[`target${ltrs[i + 1]}`] > 0) {
                    const obj = {
                        tweet_id: twitId,
                        [`target${ltrs[i]}`]: -1,
                    };
                    ctx.database.updateTweet(obj);
                } else {
                    stopTweet(ctx, twitId);
                }
            }
            break;
        }
    }
}

async function onRetweetTimer(ctx) {
    ctx.twitterTimeoutHandle.delete(0);
    // get active tweets list
    try {
        const tweets = await ctx.database.getActiveTweets();
        if (tweets.length > 0) {
            for (let i = 0; i < tweets.length; i++) {
                const item = tweets[i];
                const cnt = await getRetweets(ctx, item.tweet_id);
                // ctx.logger.info("tweet %s : %s", item.tweet_id, cnt);
                checkRetweetsTarget(ctx, item.tweet_id, cnt).then();
            }
            checkReteweetTimer(ctx);
        } else {
            // do not restart timer
            ctx.logger.info("no active tweets - no timer started");
        }
    } catch (e) {
        ctx.logger.error("mongo error %s", e.stack);
    }
}

function checkReteweetTimer(ctx) {
    if (ctx.twitterTimeoutHandle.has(0)) {
        // do nothing - timer is active
    } else {
        startReteweetTimer(ctx);
    }
}

function startReteweetTimer(ctx) {
    if (ctx.globalOpts.retweetInterval > 0) {
        const handle = setTimeout(onRetweetTimer, ctx.globalOpts.retweetInterval * 60 * 1000, ctx); // every 10 minutes
        ctx.twitterTimeoutHandle.set(0, handle);
    }
}

async function unBlackListUser(ctx, userId) {
    ctx.logger.debug("unBlackListUser %s", userId);

    const user = await ctx.database.getUser(userId);
    if (!user) return;

    let msgText;
    const userName = formatUserMention(user);

    if (user.inactive === "blacklist") {
        if (user.bl_chat_id === ctx.chat.id) {
            msgText = ctx.i18n.t("unblacklisted", { name: userName });
            ctx.database.setActiveUser(user.user_id);
        } else {
            msgText = ctx.i18n.t("unblacklistChat", { name: userName });
        }
    } else {
        msgText = ctx.i18n.t("notInBlacklist", { name: userName });
    }

    ctx.replyWithHTML(msgText).then((msg) => markForDelete(ctx, msg));
}

async function blackListUser(ctx, userId) {
    ctx.logger.debug("blackListUser %s", userId);

    if (userId === ctx.from.id) return; // do not blacklist self

    const user = await ctx.database.getUser(userId);
    if (!user) return;

    let msgText;
    const userName = formatUserMention(user);
    const chatId = ctx.chat.id;

    if (user.inactive === "blacklist") {
        msgText = ctx.i18n.t("blacklistAllready", { name: userName });
    } else {
        try {
            const chatMember = await ctx.telegram.getChatMember(chatId, user.user_id);
            if (chatMember) {
                ctx.database.setInactiveUser(user.user_id, "blacklist", chatId);
                msgText = ctx.i18n.t("blacklisted", { name: userName });
            } else {
                msgText = ctx.i18n.t("blacklistNotMember", { name: userName });
            }
        } catch {
            ctx.logger.debug("error getting user");
            msgText = ctx.i18n.t("blacklistNotMember", { name: userName });
        }
    }

    ctx.replyWithHTML(msgText).then((msg) => markForDelete(ctx, msg));
}

async function showHelp(ctx, comObj) {
    const admin = await isChatAdmin(ctx);

    if (!comObj.strings.length) {
        let helpMsg = ctx.i18n.t("helpGroup", { botNamae: ctx.botName });
        if (admin) {
            helpMsg += "\n\n" + ctx.i18n.t("helpGroupAdmin");
        }
        ctx.replyWithHTML(helpMsg, Extra.webPreview(false)).then((msg) => markForDelete(ctx, msg));
        return;
    }

    const cmd = comObj.strings[0].toLowerCase(); // show one help at a time

    if (helpMap.has(cmd)) {
        ctx.replyWithHTML(ctx.i18n.t(helpMap.get(cmd)), Extra.webPreview(false))
            .then((msg) => markForDelete(ctx, msg));
    }

    if (admin) {
        if (adminHelpMap.has(cmd)) {
            ctx.replyWithHTML(ctx.i18n.t(adminHelpMap.get(cmd))).then((msg) =>
                markForDelete(ctx, msg)
            );
        }
    }
}

async function doRain(ctx, rainObj, list) {
    const numUsers = list.length;
    const coin = ctx.blockchain.getCoins()[rainObj.token];

    if (!(await checkEncryptedPk(ctx, rainObj.user, coin))) return;

    const bxFee = await ctx.blockchain.getTxFee(rainObj.token);
    let oneValue = (rainObj.value - (rainObj.txfee + bxFee)) / numUsers - bxFee;
    oneValue = coinFormat(oneValue, coin.decimals);
    ctx.logger.debug("oneValue : %s", oneValue);

    const userName = formatUserMention(rainObj.user);

    const paramsObj = {
        userName: userName,
        rainValue: rainObj.value,
        coinName: rainObj.token,
        count: numUsers,
    };

    if (rainObj.twitLink) {
        paramsObj.link = rainObj.twitLink;
        resultMessage(ctx, "rainTwListHeader", paramsObj);
    } else {
        resultMessage(ctx, "rainListHeader", paramsObj);
    }


    let message = "";

    const usersQueue = [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const msgAdd = ctx.i18n.t("rainListItem", {
            pos: i + 1,
            name: item.userName,
            value: oneValue,
            coinName: rainObj.token,
        });
        const msgObj = await splitLongMessage(message, msgAdd, ctx);
        message = msgObj.replyMessage;
        if (msgObj.msgId) {
            markForDelete(ctx, msgObj.msgId, ctx.globalOpts.deleteInterval * 10);
        }
        item.userItem.value = oneValue;
        item.userItem.txType = 4;
        usersQueue.push(item.userItem);
    }

    ctx.logger.debug("rain message : %s", message);
    ctx.replyWithHTML(message, Extra.webPreview(false)).then((msg) =>
        markForDelete(ctx, msg, ctx.globalOpts.deleteInterval * 10)
    );

    if (rainObj.txfee) {
        const feeItem = getFeeItem(rainObj.txfee - bxFee, rainObj.token, coin);
        usersQueue.push(feeItem);
    }

    rainObj.user.token = rainObj.token;

    if (await checkEncryptedPk(ctx, rainObj.user, coin, rainObj.password))
        ctx.blockchain.addMultiTxQuery(rainObj.user, usersQueue, ctx);
}

function getTgChatUser(ctx, dbItem) {
    if (dbItem.user_id === ctx.from.id) return;

    return {
        userId: dbItem.user_id,
        userName: formatUserMention(dbItem),
        userItem: dbItem,
        userStatus: "member", // tgUser.status,
        userActive: dbItem.inactive,
        userActDate: dbItem.inactive_date,
        twit_user_id: dbItem.twit_user_id,
    };
}

async function getChatRandoms(ctx, dbList, usersNumber, getAll) {
    ctx.logger.debug("getChatRandoms");
    const list = [];

    const idSet = new Set();
    let n = 0;
    while (
        idSet.size < dbList.length &&
        list.length < usersNumber &&
        dbList.length - idSet.size > usersNumber - list.length
    ) {
        while (idSet.has(n)) {
            n = getRandomInt(0, dbList.length - 1);
        }
        idSet.add(n);
        ctx.logger.debug("random: %s of %s", n, idSet.size);
        const item = dbList[n];
        const chatUser = getTgChatUser(ctx, item, getAll);
        if (chatUser) list.push(chatUser);
    }

    if (list.length < usersNumber) {
        for (let i = 0; i < dbList.length; i++) {
            const item = dbList[i];
            const chatUser = getTgChatUser(ctx, item, getAll);
            if (chatUser) list.push(chatUser);
        }
    }

    return list;
}

function writeQueueFilter(ctx, list, chatId) {
    if (!list.length) return;

    const insArray = [];
    list.forEach(function (item) {
        insArray.push({ chat_id: chatId, user_id: item.userId });
    });

    return ctx.database.writeQueueFilter(insArray);
}

function getWhiteUsers(ctx, dbList) {
    const list = [];
    for (let i = 0; i < dbList.length; i++) {
        const item = dbList[i];
        const chatUser = getTgChatUser(ctx, item);
        if (chatUser) list.push(chatUser);
    }
    return list;
}

async function getUsersList(ctx, usersNumber, whiteList, getAll = false) {
    ctx.logger.debug("query users from DB %s ", usersNumber);

    const chatId = ctx.chat.id;

    let dbList;
    if (whiteList) {
        const ids = await ctx.database.getWhiteListUsers(chatId, whiteList);
        dbList = await ctx.database.getUsersByIds(ids);
        if (!dbList) return [];

        return getWhiteUsers(ctx, dbList);
    } else {
        dbList = await ctx.database.getUsersList(chatId, getAll);
        if (!dbList) return [];

        const chatList = await getChatRandoms(ctx, dbList, usersNumber, getAll);
        let appendChat = [];

        if (chatList.length < usersNumber && !getAll) {
            try {
                await ctx.database.emptyQueueFilter(chatId); // empty queue table
                await writeQueueFilter(ctx, chatList, chatId); // save new list

                const dbList = await ctx.database.getUsersList(chatId, getAll);
                if (dbList) {
                    appendChat = await getChatRandoms(
                        ctx,
                        dbList,
                        usersNumber - chatList.length,
                        getAll
                    );
                    writeQueueFilter(ctx, appendChat, chatId);
                }
            } catch (e) {
                ctx.logger.debug(e);
            }
        } else {
            writeQueueFilter(ctx, chatList, chatId);
        }
        return chatList.concat(appendChat);
    }
}

async function checkRainParams(ctx, cmdObj, rainObj) {
    const strParams = cmdObj.strings;

    let numUsers = -1;
    for (let i = 0; i < strParams.length; i++) {
        const str = strParams[i];
        if (str.toUpperCase() === "MAX" || str.toUpperCase() === "ALL") {
            ctx.logger.debug("checkRainParams MAX");
            numUsers = 0;
            break;
        }
    }

    if (numUsers < 0) {
        // no MAX or ALL found - check WhiteList
        if (strParams.length) {
            const chatId = ctx.chat.id;
            for (let i = 0; i < strParams.length; i++) {
                const str = strParams[i];

                const wl = await ctx.database.getWhiteList(chatId, str);

                if (wl) {
                    const users = await ctx.database.getWhiteListUsers(chatId, str);
                    ctx.logger.debug("checkRainParams WhiteList %s", str);
                    if (users.length === 0) {
                        ctx.replyWithHTML(
                            ctx.i18n.t("WLempty", { name: str }),
                            Extra.inReplyTo(cmdObj.msgId)
                        ).then((msg) => markForDelete(ctx, msg));
                        return;
                    }
                    return { numUsers: users.length, wlName: str };
                }
            }

            ctx.replyWithHTML(
                ctx.i18n.t("unknownWL", { name: strParams[0] }),
                Extra.inReplyTo(cmdObj.msgId)
            ).then((msg) => markForDelete(ctx, msg));
            return;
        }
    }

    if (numUsers < 0) {
        if (cmdObj.values.length < 2) numUsers = 0;
        ctx.logger.debug("checkRainParams no Users provided");
    }

    if (numUsers < 0) {
        let max = 0;
        cmdObj.values.forEach((val) => {
            if (val !== rainObj.value) {
                if (Number.isInteger(val) && max < val) max = val;
            }
        });
        numUsers = max;
        ctx.logger.debug("checkRainParams from params %s", numUsers);
    }

    if (numUsers > 0) {
        if (rainObj.value / numUsers < rainObj.minValue) {
            ctx.logger.warn("big numUsers value = %s min = %s", numUsers, rainObj.minValue);
            ctx.replyWithHTML(
                ctx.i18n.t("tooManyUsers", { coin: rainObj.token, minValue: rainObj.minValue }),
                Extra.inReplyTo(cmdObj.msgId)
            ).then((msg) => markForDelete(ctx, msg));
            return;
        }
    } else {
        numUsers = Math.floor(rainObj.value / rainObj.minValue);
    }

    return { numUsers };
}

function selectRainValue(values, minValue) {
    if (!values.length) return 0;

    if (values.length === 1) return values[0];

    let floatValue = 0;
    let min = Infinity;
    let max = 0;
    for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (Number.isInteger(val)) {
            if (val > max) max = val;
            if (val < min) min = val;
        } else {
            if (!floatValue) floatValue = val;
        }
    }

    if (floatValue) return floatValue;

    if (minValue < 1) return min;

    return max;
}

function getDefChatCoin(ctx) {
    if (ctx.chatsMap.has(ctx.chat.id)) {
        return ctx.chatsMap.get(ctx.chat.id).def_coin;
    } else {
        return "CLO";
    }
}

async function checkTipGiveParams(ctx, cmdObj, feePcnt, txCount) {
    // get user info
    const userId = ctx.from.id;
    ctx.logger.debug("%s command %s", cmdObj.command, userId);
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    // detect token
    const token = cmdObj.coins.length ? cmdObj.coins[0] : getDefChatCoin(ctx);
    const coin = ctx.blockchain.getCoins()[token];

    // tip/give value
    const defTipValue = getDefValue(user, "tip", token);

    // rain value
    const defRainValue = getDefValue(user, "rain", token);

    let value;
    let minValue;
    let isRain = false;
    if (cmdObj.command.indexOf("rain") !== -1) {
        minValue = coin.minValue * 10;
        value = selectRainValue(cmdObj.values, coin.minValue) || defRainValue || minValue;
        ctx.logger.debug("rain value %s", value);
        isRain = true;
    } else {
        minValue = coin.minValue;
        value = cmdObj.values[0] || defTipValue || minValue;
    }

    if (value < minValue) {
        ctx.logger.warn("low command value = %s min = %s", value, minValue);
        ctx.replyWithHTML(
            ctx.i18n.t("tooLowValue", { coin: token, value: value, minValue: minValue }),
            Extra.inReplyTo(cmdObj.msgId)
        ).then((msg) => markForDelete(ctx, msg));
        return;
    }

    // calc dev fee
    const txfee = calcFee(value, feePcnt, coin.minValue);
    // ctx.logger.debug('fee %s %s', feePcnt, txfee);

    // check balance
    const addr = user[`${coin.platform}_wallet_address`];
    if (!(await checkCommandBalance(ctx, token, addr, value, txCount, cmdObj.msgId, txfee, isRain)))
        return;

    minValue = coin.minValue;
    return { user, token, value, minValue, txfee };
}

function getDefValue(user, defType, token) {
    return user[`${token}_${defType}_value`] ? user[`${token}_${defType}_value`] : 0;
}

async function checkCommandBalance(ctx, token, addr, value, txCount, replyId, txfee, isRain) {
    const balance = await ctx.blockchain.getBalance(token, addr);
    const feeBalance = await ctx.blockchain.getFeeBalance(token, addr);

    ctx.logger.debug("checkCommandBalance txFee %s", txfee);

    ctx.logger.debug("feeBalance %s", feeBalance);
    const blockchainFee = await ctx.blockchain.getTxFee(token);
    ctx.logger.debug("blockchainFee %s", blockchainFee);

    const replyTo = replyId ? Extra.inReplyTo(replyId) : null;
    let res;
    let needVal;
    if (isRain) {
        needVal = value;
    } else {
        needVal = coinFormat(value * txCount + txfee, 3);
    }
    ctx.logger.debug("balance %s needVal %s", balance, needVal);

    res = balance < needVal;

    if (res) {
        ctx.logger.warn("notEnoughTx bal = %s val = %s tx = %s", balance, value, blockchainFee);
        ctx.replyWithHTML(
            ctx.i18n.t("notEnoughTx", { coin: token, balance: balance, value: needVal }),
            replyTo
        ).then((msg) => markForDelete(ctx, msg));
    } else {
        // chacking balance for fee

        if (token === feeBalance.feeCoin && !isRain) {
            needVal = coinFormat((value + blockchainFee) * txCount + (blockchainFee + txfee), 6);
            ctx.logger.debug("needed: %s", needVal);
        } else {
            const feeTxCount = txfee ? 1 : 0;
            needVal = coinFormat(blockchainFee * (txCount + feeTxCount), 6);
        }

        ctx.logger.debug("balance fee %s needVal %s", feeBalance.balance, needVal);

        res = feeBalance.balance < needVal;
        if (res) {
            ctx.logger.warn(
                "notEnoughTxFee bal = %s %s tx = %s",
                feeBalance.balance,
                feeBalance.feeCoin,
                needVal
            );
            ctx.replyWithHTML(
                ctx.i18n.t("notEnoughTxFee", { coin: feeBalance.feeCoin }),
                replyTo
            ).then((msg) => markForDelete(ctx, msg));
        }
    }
    return !res;
}

async function getIdsFromNames(ctx, cmdObj) {
    const userIds = [];
    if (cmdObj.users.length === 0) {
        if (cmdObj.replyId) {
            if (await isUserRegistered(ctx, cmdObj.replyId, false)) {
                userIds.push(cmdObj.replyId);
            } else {
                const msg = cmdObj.replyName;
                ctx.replyWithHTML(
                    ctx.i18n.t("usersNotRegistered", { list: msg, bot: "@" + ctx.botName })
                ).then((msg) => markForDelete(ctx, msg));
            }
        }
    } else {
        const uSet = new Set(cmdObj.users);

        if (cmdObj.users.includes(ctx.botName)) {
            userIds.push(-1);
            uSet.delete(ctx.botName);
        }

        cmdObj.users = Array.from(uSet);
        const userItems = await getUsersIds(ctx.database, cmdObj.users);

        for (let i = 0; i < userItems.length; i++) {
            const item = userItems[i];
            if (cmdObj.users.includes(item.user_name)) {
                userIds.push(item.user_id);
                uSet.delete(item.user_name);
            }
        }
        if (uSet.size > 0) {
            const msg = "@" + Array.from(uSet).join(", @");
            ctx.logger.debug(msg);
            ctx.replyWithHTML(
                ctx.i18n.t("usersNotRegistered", { list: msg, bot: "@" + ctx.botName }),
                Extra.inReplyTo(cmdObj.msgId)
            ).then((msg) => markForDelete(ctx, msg));
        }
    }
    return userIds;
}

async function doTip(ctx, userIds, tipObj, txCount) {
    let user = tipObj.user;

    const usersQueue = [];
    for (let i = 0; i < txCount; i++) {
        const targetId = userIds[i];
        if (targetId === ctx.from.id) continue; // skip tipping to self

        try {
            let itemDest = await ctx.database.getUser(targetId);
            itemDest.txType = 2;
            itemDest.value = tipObj.value;
            usersQueue.push(itemDest);
            // ctx.logger.debug('dotip : %s', JSON.stringify(itemDest));
        } catch (e) {
            ctx.logger.error("doTip getUser %s", e.stack);
        }
    }

    if (!usersQueue.length) return null;

    const coin = ctx.blockchain.getCoins()[tipObj.token];
    if (tipObj.txfee) {
        const feeItem = getFeeItem(tipObj.txfee * usersQueue.length, tipObj.token, coin);
        usersQueue.push(feeItem);
    }

    user.token = tipObj.token;

    if (await checkEncryptedPk(ctx, user, coin))
        ctx.blockchain.addMultiTxQuery(user, usersQueue, ctx);
}

async function doGive(ctx, user, value, token) {
    const pass = checkPassword(ctx, user);

    if (pass === null) return;

    const opts = {
        userName: formatUserMention(user),
        value: value,
        coinName: token,
    };
    return ctx.replyWithHTML(
        ctx.i18n.t("giveMessage", opts),
        Extra.markup(giveButtons(ctx, value, token, pass)).webPreview(false)
    );
}

function channelCheck(ctx) {
    return ctx.updateType === "channel_post";
}

function getUsersIds(db, users) {
    return db.getUsersIds(users);
}

function deleteReplyCommand(ctx, cmdObj) {
    return setDeleteReply(ctx, cmdObj, "delete_reply");
}

function permitLotteryCommand(ctx, cmdObj) {
    return setDeleteReply(ctx, cmdObj, "lottery");
}

function potNotifyCommand(ctx, cmdObj) {
    return setDeleteReply(ctx, cmdObj, "potnotify");
}

function adminOnlyCommand(ctx, cmdObj) {
    return setDeleteReply(ctx, cmdObj, "adminrestr");
}

async function parseCommand(ctx, cmdObj) {
    const msg = ctx.message;

    if (cmdObj.command === "claim" || cmdObj.command === "grab" || cmdObj.command === "claimed") {
        ctx.logger.debug("claim detected");
        deleteBotMessage(ctx, msg);
        return;
    }

    const admin = await isChatAdmin(ctx);

    if (commandsMap.has(cmdObj.command) || adminCommandsMap.has(cmdObj.command))
        markForDelete(ctx, msg);

    if (ctx.chatsMap.has(ctx.chat.id)) {
        // check admin Only restriction
        const chat = ctx.chatsMap.get(ctx.chat.id);
        if (chat.adminrestr) {
            if (!admin) {
                markForDelete(ctx, msg);
                return null;
            }
        }
    }

    if (commandsMap.has(cmdObj.command)) {
        const func = commandsMap.get(cmdObj.command);
        return func(ctx, cmdObj);
    }

    const botAdmin = isBotAdmin(ctx);

    if (admin || botAdmin) {
        if (adminCommandsMap.has(cmdObj.command)) {
            const func = adminCommandsMap.get(cmdObj.command);
            return func(ctx, cmdObj);
        }
    }

    if (botAdmin) {
        switch (cmdObj.command) {
            case "set": {
                deleteBotMessage(ctx, msg);
                return setCommand(ctx, cmdObj);
            }
        }
    }
}

function parseCommandParams(ctx) {
    if (ctx.message.text.trim().length < 3) return;

    if (!ctx.state.command) return;

    const command = ctx.state.command;
    if (command.bot) {
        if (command.bot !== ctx.botName) {
            ctx.logger.debug("wrong bot %s", command.bot);
            return null;
        }
    }
    if (isPrivateChat(ctx)) {
        ctx.replyWithHTML(ctx.i18n.t("groupOnly")).then();
        return null;
    }

    let cmdObj = {};

    checkChatId(ctx);

    cmdObj.command = command.command.toLowerCase();

    if (cmdObj.command === "help" && !command.bot) {
        ctx.logger.debug("help without bot name");
        return null;
    }

    // here can check command for synonyms  ( ex: /etip = /tip ETC )

    cmdObj.isBot = false;

    const cmdUsers = [];
    const cmdValues = [];
    const coins = Object.keys(ctx.blockchain.getCoins());
    const cmdCoins = [];
    const cmdStrings = [];
    const regex = /(@[\S]+)/i;
    const regexNum = /(\d+[,.]*\d*)(\S+)/i;

    for (let i = 0; i < command.splitArgs.length; i++) {
        const arg = command.splitArgs[i];

        if (arg === "") continue;
        if (regex.test(arg)) {
            // users by @
            cmdUsers.push(arg.replace("@", ""));
            continue;
        }

        const num = Number(arg.replace(",", "."));
        if (!isNaN(num)) {
            // numbers
            cmdValues.push(num);
            continue;
        }

        if (coins.includes(arg.toUpperCase())) {
            // coins
            cmdCoins.push(arg.toUpperCase());
            continue;
        }

        const splitVal = regexNum.exec(arg); // Number+Coin without space
        if (splitVal) {
            if (splitVal[2]) {
                const str = splitVal[2];
                const nm = Number(splitVal[1].replace(",", "."));
                if (coins.includes(str.toUpperCase()) && !isNaN(nm)) {
                    cmdCoins.push(str.toUpperCase());
                    cmdValues.push(nm);
                    continue;
                }
            }
        }

        if (arg.replace("/", "").toLowerCase() === "help") {
            ctx.logger.debug("help command");
            const txt = cmdObj.command;
            ctx.logger.debug(txt);
            cmdObj.command = "help";
            cmdStrings.push(txt);
        } else if (arg.replace("/", "").toLowerCase() === "pot") {
            if (cmdObj.command === "tip" || cmdObj.command === "reward") {
                cmdObj.command = "pot";
            } else {
                if (arg.trim() !== "") {
                    cmdStrings.push(arg); // all other strings
                }
            }
        } else {
            if (arg.trim() !== "") {
                cmdStrings.push(arg); // all other strings
            }
        }
    }
    cmdObj.users = cmdUsers;
    cmdObj.values = cmdValues;
    cmdObj.coins = cmdCoins;
    cmdObj.strings = cmdStrings;

    if (ctx.updateType !== "channel_post") {
        // check for Reply message
        cmdObj.msgId = ctx.message.message_id;
        if (ctx.message.reply_to_message) {
            const repMsg = ctx.message.reply_to_message;
            cmdObj.replyId = repMsg.from.id;
            cmdObj.replyName = formatUserName(repMsg.from, "@");
            if (repMsg.from.is_bot) {
                cmdObj.isBot = true;
            }
        }
    } else {
        cmdObj.msgId = 0;
    }

    return cmdObj;
}

function checkChatId(ctx) {
    const chat = ctx.chat;
    if (!ctx.chatsMap.has(chat.id)) {
        ctx.logger.info("new chat : %s", chat.id);

        const chatItem = {
            chat_id: chat.id,
            user_name: chat.username,
            type: chat.type,
            title: chat.title,
            description: chat.description,
            def_coin: "CLO",
            delete_reply: 1,
            lottery: 1,
        };

        ctx.database.insertChat(chatItem);
        ctx.chatsMap.set(chat.id, chatItem);
        checkChatMembers(ctx, chat.id).catch((e) => ctx.logger.error(e.stack));
    }
}

function calcCheckMembersTimerStart(ctx) {
    let dt = new Date();

    dt.setUTCHours(23, 59, 0, 0);
    const t = dt.getTime() - new Date().getTime();

    ctx.logger.debug('checkMembers scheduled to %s', dt);

    return setTimeout(checkMembersTimer, t, ctx);
}

function calcLotteryTimerStart(ctx) {
    const globalPotTime = calcLotteryTime();
    const t = globalPotTime.getTime() - new Date().getTime() - 60 + 1000; // process lott 1 min earlier
    return setTimeout(processLottery, t, ctx);
}

function calcPotTimerStart(ctx) {
    const globalPotTime = calcLotteryTime();
    let date = new Date();

    const diff = globalPotTime.getTime() - date.getTime() - 3 * oneHourMs;
    const interval = ctx.globalOpts.potStatInterval * ctx.globalOpts.giveAutoMult; // by default = 8 hrs

    const t = diff % interval;

    date.setTime(date.getTime() + t);
    ctx.logger.info("starting Stat timer at : %s", date.toLocaleString("ru"));

    setTimeout(onPotStatTimer, t, ctx);
    // return setTimeout(onPotStatTimer, 1000, ctx); // for test
}

function startLotteryTimer(ctx) {
    const interval = 7 * 24 * oneHourMs; // every 7 days
    setTimeout(processLottery, interval, ctx);
}

function startPotStatTimer(ctx) {
    const interval = ctx.globalOpts.potStatInterval * oneHourMs;
    setTimeout(onPotStatTimer, interval, ctx);
}

async function oneChatPotStat(ctx, chat) {
    if (chat.lottery && chat.potnotify) {
        const chatId = chat.chat_id;
        ctx.logger.debug("onPotStatTimer, chat %s", chatId);

        const tCtx = await getContext(ctx, null, chatId);
        const token = getDefChatCoin(tCtx);

        if (chat.prevMsgId) {
            const msg = {
                chat: { id: chatId },
                message_id: chat.prevMsgId,
            };
            ctx.logger.debug("onPotStatTimer, delete msg %s", msg.message_id);
            deleteBotMessage(tCtx, msg);
        }

        const msg = await generatePotStatMessage(tCtx, token, true);
        if (msg) {
            ctx.logger.debug("onPotStatTimer, store msg %s", msg.message_id);
            chat.prevMsgId = msg.message_id;
        }
    }
}

function onPotStatTimer(ctx) {
    ctx.logger.debug("onPotStatTimer");

    startPotStatTimer(ctx);

    const globalPotTime = calcLotteryTime();
    if (isPotSilenceInterval(ctx, globalPotTime)) {
        ctx.logger.info("onPotStatTimer - silence");
    } else {
        const values = [...ctx.chatsMap.values()];
        for (let i = 0; i < values.length; i++) {
            const chat = values[i];
            setTimeout(oneChatPotStat, 1500 * i, ctx, chat);
        }

        ctx.logger.debug("onPotStatTimer over");
    }
}

function clearEntries(ctx) {
    ctx.database.clearPotEntries();
}

function getLotteryTickets(ctx, token, weekShift) {
    let dateB = null;
    const lotteryDate = calcLotteryTime();

    let date = new Date(lotteryDate.getTime());
    date.setUTCDate(lotteryDate.getDate() - 7 * (weekShift + 1));

    if (weekShift) {
        dateB = new Date(date.getTime());
        dateB.setUTCDate(date.getDate() + 7);
    }

    return ctx.database.getLotteryTickets(token, date, dateB);
}

async function getLotteryWinners(ctx, ticketsList) {
    const entriesCount = ticketsList.length;

    const winners = [];
    const idSet = new Set();
    const uidSet = new Set();

    const winNum = getCryptoRandomInt(0, entriesCount - 1); // first winner
    idSet.add(winNum);

    const mappedList = ticketsList.map(x => x.user_id);
    // ctx.logger.debug('mappedList: %s', JSON.stringify(mappedList, null, 2));
    const mappedSet = new Set(mappedList);
    // ctx.logger.debug('mapped set: %s', mappedSet.size);

    uidSet.add(ticketsList[winNum].user_id);
    ctx.logger.info("1st winner random: %s / %s, id: %s", winNum, entriesCount, ticketsList[winNum].user_id);
    let user = await ctx.database.getUser(ticketsList[winNum].user_id);
    user.ticket = winNum;
    winners.push(user);

    if ((entriesCount > 20) && (mappedSet.size > 3)) {
        let winNumB = Number(winNum);
        while (idSet.has(winNumB) || uidSet.has(ticketsList[winNumB].user_id)) {
            // 2nd winner
            winNumB = getCryptoRandomInt(0, entriesCount - 1);
        }
        ctx.logger.info("2nd winner random: %s, id: %s", winNumB, ticketsList[winNumB].user_id);
        let userB = await ctx.database.getUser(ticketsList[winNumB].user_id);
        userB.ticket = winNumB;
        winners.push(userB);

        idSet.add(winNumB);
        uidSet.add(ticketsList[winNumB].user_id);
        let winNumC = Number(winNumB);
        while (idSet.has(winNumC) || uidSet.has(ticketsList[winNumC].user_id)) {
            // 3rd winner
            winNumC = getCryptoRandomInt(0, entriesCount - 1);
        }
        ctx.logger.info("3rd winner random: %s, id: %s", winNumC, ticketsList[winNumC].user_id);
        let userC = await ctx.database.getUser(ticketsList[winNumC].user_id);
        userC.ticket = winNumC;
        winners.push(userC);
    }
    return winners;
}

async function generatePotTxs(ctx, winners, pot) {
    if (!winners.length) return;

    const minPotValue = getMinPotValue(ctx, pot.token);
    const drawVal = pot.entries * minPotValue; // get Pot value

    const feePcnt = ctx.devFee.potFee; // note can't change pot fee by chat - since it's global

    const fee = calcFee(drawVal, feePcnt, 0);
    const winPcnt = winners.length > 1 ? 0.7 : 1;
    const txCount = winners.length > 1 ? 4 : 2;

    const bxFee = await ctx.blockchain.getTxFee(pot.token);

    const winnersVal = drawVal - fee - bxFee * txCount;

    const usersQueue = [];
    let itemDest = winners[0];
    itemDest.value = coinFormat(winnersVal * winPcnt, 4);
    itemDest.txType = 6;
    usersQueue.push(itemDest);

    if (winners.length > 1) {
        let itemDestA = winners[1];
        itemDestA.value = coinFormat(winnersVal * 0.2, 4);
        itemDestA.txType = 6;
        usersQueue.push(itemDestA);

        let itemDestB = winners[2];
        itemDestB.value = coinFormat(winnersVal * 0.1, 4);
        itemDestB.txType = 6;
        usersQueue.push(itemDestB);
    }

    if (fee) {
        const coin = ctx.blockchain.getCoins()[pot.token];
        const feeItem = getFeeItem(fee, pot.token, coin);
        usersQueue.push(feeItem);
    }

    pot.user_name = `${pot.token}lottery`;
    pot.user_id = 0;

    ctx.blockchain.addMultiTxQuery(pot, usersQueue, ctx);
}

// function sleep(ms) {
//     return new Promise((resolve) => {
//         setTimeout(resolve, ms);
//     });
// }

async function sendWinnersMessage(ctx, chat, winnersObj) {
    const chatId = chat.chat_id;

    const tCtx = await getContext(ctx, null, chatId);
    const chatToken = getDefChatCoin(tCtx);
    if (chatToken === winnersObj.token && chat.lottery) {
        try {
            await tCtx.replyWithHTML(tCtx.i18n.t("potSpinning", { entries: winnersObj.cnt }));

            await tCtx.replyWithHTML(
                tCtx.i18n.t("potWinner", {
                    place: "🍀 1️⃣ 🍀",
                    ticket: winnersObj.winners[0].ticket,
                    userName: winnersObj.nameA,
                    value: winnersObj.winners[0].value,
                    coinName: winnersObj.token,
                    cnt: winnersObj.winTicketsA,
                })
            );

            if (winnersObj.isManyWinners) {
                await tCtx.replyWithHTML(
                    tCtx.i18n.t("potWinner", {
                        place: "2️⃣",
                        ticket: winnersObj.winners[1].ticket,
                        userName: winnersObj.nameB,
                        value: winnersObj.winners[1].value,
                        coinName: winnersObj.token,
                        cnt: winnersObj.winTicketsB,
                    })
                );

                await tCtx.replyWithHTML(
                    tCtx.i18n.t("potWinner", {
                        place: "3️⃣",
                        ticket: winnersObj.winners[2].ticket,
                        userName: winnersObj.nameC,
                        value: winnersObj.winners[2].value,
                        coinName: winnersObj.token,
                        cnt: winnersObj.winTicketsC,
                    })
                );
            }
        } catch (e) {
            ctx.logger.error(e.stack);
        }
    }
}

async function generateWinnersMessages(ctx, winners, tickets, token) {
    let winTicketsA = 0;
    let winTicketsB = 0;
    let winTicketsC = 0;

    const isManyWinners = winners.length > 1;
    for (let i = 0; i < tickets.length; i++) {
        const obj = tickets[i];
        if (obj.user_id === winners[0].user_id) winTicketsA++;
        if (isManyWinners) {
            if (obj.user_id === winners[1].user_id) winTicketsB++;
            if (obj.user_id === winners[2].user_id) winTicketsC++;
        }
    }

    const nameA = formatUserName(winners[0]); //formatUserMention(winners[0]);
    let nameB, nameC;

    let adminMsg = `1. ${nameA} 💰 ${winners[0].value} ${token}\n`;
    if (isManyWinners) {
        nameB = formatUserName(winners[1]); // formatUserMention(winners[1]);
        adminMsg += `2. ${nameB} 💰 ${winners[1].value} ${token}\n`;
        nameC = formatUserName(winners[2]); //formatUserMention(winners[2]);
        adminMsg += `3. ${nameC} 💰 ${winners[2].value} ${token}\n`;
    }

    const winnersObj = {
        winTicketsA,
        winTicketsB,
        winTicketsC,
        nameA,
        nameB,
        nameC,
        winners,
        token,
        isManyWinners,
        cnt: tickets.length,
    };

    ctx.tg
        .sendMessage(ctx.devFee.devChat, adminMsg, Extra.HTML())
        .catch((e) => ctx.logger.error(e.stack));

    const chats = [...ctx.chatsMap.values()];
    for (let i = 0; i < chats.length; i++) {
        const chat = chats[i];
        setTimeout(sendWinnersMessage, 1000 * i, ctx, chat, winnersObj);
        // await sleep(1000);
    }
    return adminMsg;
}

async function drawTokenLottery(ctx, pot, weekShift) {
    const token = pot.token;

    ctx.logger.info("drawTokenLottery %s", token);

    const ticketsList = await getLotteryTickets(ctx, token, weekShift);
    if (!ticketsList.length) {
        ctx.logger.info("pots for %s not found", token);
        return;
    }

    const winners = await getLotteryWinners(ctx, ticketsList);

    await generatePotTxs(ctx, winners, pot);
    const winMsg = await generateWinnersMessages(ctx, winners, ticketsList, token);
    ctx.logger.debug("Winner: %s", winMsg);
    ctx.database.updatePotWinner(token, winMsg);
}

async function checkMembersTimer(ctx) {
    checkChatMembersGlobal(ctx);
    setTimeout(checkMembersTimer, 96 * oneHourMs, ctx);
}

async function processLottery(ctx, weekShift = 0) {
    ctx.logger.info("processLottery");

    startLotteryTimer(ctx);

    const pots = await ctx.database.getPotsNotEmpty();
    if (!pots.length) return;

    pots.forEach((pot) => {
        drawTokenLottery(ctx, pot, weekShift);
    });

    setTimeout(clearEntries, oneHourMs / 4, ctx); // one hour after - can reset entries in all lotteries
}

function checkRainTimeout(ctx) {
    let minutes = 6; // test if user already rained it in 5 mins
    const userId = ctx.from.id;
    const mapKey = `${ctx.chat.id}:${userId}`;

    if (ctx.rainMap.has(mapKey)) {
        const lastDate = ctx.rainMap.get(mapKey);
        const nowDate = new Date();
        minutes = (nowDate.getTime() - lastDate.getTime()) / (60 * 1000);
        ctx.logger.debug("minutes since rain : %s", minutes);
    }

    if (minutes > 5 || isBotAdmin(ctx)) {
        ctx.rainMap.set(mapKey, new Date());
        return true;
    } else {
        ctx.logger.debug("waitRain");
        ctx.replyWithHTML(
            ctx.i18n.t("waitRain", { minutes: Math.round(5 - minutes) }),
            Extra.inReplyTo(ctx.message.message_id)
        ).then((msg) => markForDelete(ctx, msg));
        return false;
    }
}

module.exports = {
    testCommand,
    anyCommand,
    tipCallback,
    checkReteweetTimer,
    leftChatMember,
    newChatMember,
    doPotBet,
    calcPotTimerStart,
    calcLotteryTimerStart,
    processLottery,
    selfKillCommand,
    calcCheckMembersTimerStart
};
