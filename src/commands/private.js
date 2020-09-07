const Extra = require("telegraf/extra");
const bcrypt = require('bcrypt');
const { encryptAsync, decryptAsync } = require('./../utils');

const Exec = require("child_process").exec;
const {
    isPrivateChat,
//    splitLongMessage,
    formatUserName,
    isBotAdmin,
    parseSendMessageError,
    isUserRegistered,
    checkChatMembers,
    getInPrivPrivateKey,
    cleanPass,
    checkChatMembersGlobal
} = require("./../utils");
const {
    settingsButtons,
    mainMenuButtons,
    coinsButtons,
    stakingMenuButtons,
    withdrawValueButtons,
    languageButtons,
    confirmButtons,
    securityButtons,
    walletMenuButtons,
    infoMenuButtons,
    projectsButtons,
    getInfoMenuButtons
} = require("./../buttons");
const { startTextValueQuery } = require("./../scenes");
const { calcFee, coinFormat } = require("./../blockchain");
const { processLottery } = require("./group");

const oneHourMs = 60 * 60 * 1000;
const oneDayMs = oneHourMs * 24;
const days27 = 27 * oneDayMs;
const saltRounds = 11;

/**
 * Private chat Commands
 */
const helpCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.replyWithHTML(ctx.i18n.t("help"), Extra.webPreview(false));
        if (isBotAdmin(ctx)) {
            ctx.replyWithHTML(ctx.i18n.t("helpAdmin"), Extra.webPreview(false));
        }
    }
};

const startCommand = () => async (ctx) => {
    ctx.logger.debug("start command %s", ctx.from.id);
    if (isPrivateChat(ctx)) {
        ctx.database.logStartCommand(ctx.from.id, ctx.from.username);
        return showMainMenu(ctx, "greeting");
    }
};

const reportCommand = () => async (ctx) => {
    if (ctx.chat.id === ctx.devFee.reportChat) {
        if (ctx.message.reply_to_message) {

            // ctx.logger.debug("got reply message %s", JSON.stringify(ctx.message.reply_to_message));

            if (ctx.message.reply_to_message.forward_from) {
                ctx.telegram.sendMessage(ctx.message.reply_to_message.forward_from.id, "Reply: " + ctx.message.text);
            } else {
                ctx.replyWithHTML(`Can not reply to user "${ctx.message.reply_to_message.forward_sender_name}"`);
            }
        }
    }
};

const donateCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("donate command %s", ctx.from.id);
        return doDonate(ctx, ctx.from.id);
    }
};

const infoCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        const user = await isUserRegistered(ctx, ctx.from.id, true);
        if (!user) return;

        return ctx.replyWithHTML(ctx.i18n.t("infoMenu"), Extra.markup(infoMenuButtons(ctx)));
    }
};

const walletCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        const user = await isUserRegistered(ctx, ctx.from.id, true);
        if (!user) return;

        return ctx.replyWithHTML(ctx.i18n.t("walletMenu"), Extra.markup(walletMenuButtons(ctx)));
    }
};

const settingsCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        const user = await isUserRegistered(ctx, ctx.from.id, true);
        if (!user) return;

        return ctx.replyWithHTML(ctx.i18n.t("settingsMenu"), Extra.markup(settingsButtons(ctx)));
    }
};

const mainMenuCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        return showMainMenu(ctx, "mainMenu");
    }
};

const stakingMenuCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        return ctx.replyWithHTML(ctx.i18n.t("stakingMenu"), Extra.markup(stakingMenuButtons(ctx)));
    }
};

const balanceCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("display balance Command %s", ctx.from.id);
        return showDepositAddress(ctx, ctx.from.id, "balMessage", "bal", "balanceAll");
    }
};

const depositCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("show deposit addres %s", ctx.from.id);
        return showDepositAddress(ctx, ctx.from.id, "depositMessage", "dep");
    }
};

const withdrawCommand = () => async  (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("withdraw command %s", ctx.from.id);
        return doWithdraw(ctx, ctx.from.id);
    }
};

const earnCloCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        return ctx.replyWithHTML(ctx.i18n.t("earnCloMessage"), Extra.webPreview(false));
    }
};

const partnersCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        const coins = ctx.blockchain.getCoins();
        return ctx.replyWithHTML(ctx.i18n.t("projectsMenu"), Extra.markup(projectsButtons(ctx, coins)));
    }
};

const contactCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        return startTextValueQuery(ctx, "enterMessage", sprtMessageEntered);
    }
};

const unlockCommand = () => async (ctx) => {
    ctx.logger.debug("unlockCommand");
    if (isPrivateChat(ctx)) {
        return processUnlock(ctx);
    }
};

const newUserCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.debug("Adding new user %s", ctx.from.id);
        return regNewUser(ctx, ctx.from.id);
    }
};

const setTwitterCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("Link twitter %s", ctx.from.id);

        const user = await isUserRegistered(ctx, ctx.from.id, true);
        if (!user) return;

        await getTwitterName(ctx, ctx.from.id);
        return startTextValueQuery(ctx, "enterTwitter", twitterNameEntered, twitterNameCheck);
    }
};

const setLanguageCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("set language %s", ctx.from.id);
        return ctx.replyWithHTML(ctx.i18n.t("languageMessage"), Extra.markup(languageButtons(ctx)));
    }
};

const displayPkCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("displayPkCommand %s", ctx.from.id);

        if (ctx.passwords.has(ctx.from.id)) return oldPasswordPkEntered(ctx, '')
        else return startTextValueQuery(ctx, "enterPassword", oldPasswordPkEntered, passwordHashCheck);
    }
};

const setPwdCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("setPwdCommand %s", ctx.from.id);

        return ctx.replyWithHTML(
            ctx.i18n.t("passwordWarning"),
            Extra.markup(confirmButtons(ctx, "pwd"))
        );
    }
};

const changePwdCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("changePwdCommand %s", ctx.from.id);
        return startTextValueQuery(ctx, "enterOldPassword", oldPasswordEntered, passwordHashCheck);
    }
};

const encryptCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {

        ctx.logger.info("encryptCommand %s", ctx.from.id);

        return ctx.replyWithHTML(
            ctx.i18n.t("encryptdWarning"),
            Extra.markup(confirmButtons(ctx, "enc"))
        );
        // return startTextValueQuery(ctx, "enterPassword", encryptPasswordEntered, passwordHashCheck);
    }
};

const displayHistoryCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("displayHistoryCommand %s", ctx.from.id);
        return showOpHistory(ctx, ctx.from.id);
    }
};

const setDefaultsCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("setDefaultsCommand %s", ctx.from.id);
        return showDepositAddress(ctx, ctx.from.id, "defsMessage", "dfv");
    }
};

const securityMenuCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("securityMenuCommand %s", ctx.from.id);
        return drawSecurityMenu(ctx, "securityMessage");
    }
};

const getStakeStatusCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("getStakeStatusCommand %s", ctx.from.id);
        return showStakeStatus(ctx, ctx.from.id);
    }
};

const startStakeCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("startStakeCommand %s", ctx.from.id);
        return startStake(ctx, ctx.from.id);
    }
};

const claimStakeCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("claimStakeCommand %s", ctx.from.id);
        return claimStake(ctx, ctx.from.id);
    }
};

const withdrawStakeCommand = () => async (ctx) => {
    if (isPrivateChat(ctx)) {
        ctx.logger.info("withdrawStakeCommand %s", ctx.from.id);
        return withdrawStake(ctx, ctx.from.id);
    }
};

/**
 * Admin commands
 */
const newCoinCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("newCoinCommand %s %s", ctx.from.id, ctx.state.command.args);
        return addNewCoin(ctx);
    }
};

const importCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("importCommand %s %s", ctx.from.id, ctx.state.command.args);
        return importUsers(ctx);
    }
};

const restartCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("restartCommand %s %s", ctx.from.id, ctx.state.command.args);
        botRestart(ctx);
    }
};

const stopCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("stopCommand %s %s", ctx.from.id, ctx.state.command.args);
        botStop(ctx);
    }
};

const userInfoCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("userInfoCommand %s %s", ctx.from.id, ctx.state.command.args);
        return getUserInfo(ctx);
    }
};

const messageCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("messageCommand %s %s", ctx.from.id, ctx.state.command.args);
        return sendMessageAsBot(ctx);
    }
};

const checkMembersGlobalCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("checkMembersGlobalCommand %s %s", ctx.from.id, ctx.state.command.args);
        checkChatMembersGlobal(ctx).catch((e) => ctx.logger.error(e));
    }
};

const checkMembersCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("checkMembersCommand %s %s", ctx.from.id, ctx.state.command.args);
        const chatId = Number(ctx.state.command.args);
        checkChatMembers(ctx, isNaN(chatId) ? null : chatId).catch((e) => ctx.logger.error(e));
    }
};

const startLotteryCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("startLotteryCommand %s %s", ctx.from.id, ctx.state.command.args);
        const shift = Number(ctx.state.command.args);
        return processLottery(ctx, isNaN(shift) ? 0 : shift);
    }
};

const countStartCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("countStartCommand %s %s", ctx.from.id, ctx.state.command.args);
        return countStartUsers(ctx);
    }
};

const messageChatsCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("messageChatsCommand %s %s", ctx.from.id, ctx.state.command.args);
        return sendChatsMessageAsBot(ctx);
    }
};

const messageUsersCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("messageUsersCommand %s %s", ctx.from.id, ctx.state.command.args);
        return sendUsersMessageAsBot(ctx);
    }
};

const messageAdminsCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("messageAdminsCommand %s %s", ctx.from.id, ctx.state.command.args);
        return sendAdminMessageAsBot(ctx);
    }
};

const chatListCommand = () => async (ctx) => {
    if (isPrivateChat(ctx) && isBotAdmin(ctx)) {
        ctx.logger.info("chatListCommand %s %s", ctx.from.id, ctx.state.command.args);
        getChatList(ctx);
    }
};

/**
 * Callback functions
 */
const encryptConfirm = (ctx) => {
    return startTextValueQuery(ctx, "enterPassword", encryptPasswordEntered, passwordHashCheck);
}

const setPwdConfirm = (ctx) => {
    return startTextValueQuery(ctx, "enterPassword", passwordEntered, passwordCheck);
}

const withdrawAddressEntered = (ctx, text) => {
    ctx.logger.debug("withdrawAddressEntered %s", text);
    ctx.session.address = text;
    return ctx.replyWithHTML(
        ctx.i18n.t("enterWithdrawValue", { address: text }),
        Extra.markup(withdrawValueButtons(ctx))
    );
};

const walletAddressCheck = (ctx, text) => {
    const coinCode = ctx.session.coinCode;
    const isValidAddress = ctx.blockchain.checkAddress(coinCode, text);
    if (isValidAddress) {
        return null;
    } else {
        return ctx.i18n.t("invalidAddress");
    }
};

const stakeValueEntered = (ctx, text) => {
    ctx.logger.debug("stakeValueEntered %s", text);
    const value = Number(text.replace(",", "."));
    ctx.session.txValue = value;
    const params = {
        aValue: value,
        coinName: ctx.session.coinCode,
    };
    return ctx.replyWithHTML(
        ctx.i18n.t("stakeFinalWarning", params),
        Extra.markup(confirmButtons(ctx, "sss"))
    );
};

const donateValueEntered = async (ctx, text) => {
    ctx.logger.debug("donateValueEntered %s", text);

    const value = Number(text.replace(",", "."));

    const user = await ctx.database.getUser(ctx.from.id);

    if (user) {
        const usersQueue = [];
        let bxFee = await ctx.blockchain.getTxFee(ctx.session.coinCode);

        ctx.logger.debug("blockchain fee : %s %s", bxFee, ctx.session.coinCode);

        const coin = ctx.blockchain.getCoins()[ctx.session.coinCode];

        const itemDest = {
            user_name: "",
            wallet_address: coin.feeWallet,
            value: value - bxFee,
            txType: 10,
        };
        usersQueue.push(itemDest);

        user.token = ctx.session.coinCode;

        const key = await getInPrivPrivateKey(ctx, user, coin);
        if (key) {
            user.wallet_key = key;
            ctx.blockchain.addMultiTxQuery(user, usersQueue, ctx);
        }
    }

    ctx.session.coinCode = null;
    ctx.session.balance = null;

};

const withdrawValueEntered = (ctx, text) => {
    ctx.logger.debug("withdrawValueEntered %s", text);
    const feePcnt = ctx.devFee.withdrawFee;
    const value = Number(text.replace(",", "."));
    const coin = getCoinFromContext(ctx);
    const fee = calcFee(value, feePcnt, coin.minValue);
    const finValue = value - fee;
    ctx.session.txValue = value;
    ctx.session.txFee = fee;
    const params = {
        address: ctx.session.address,
        value: value,
        finValue: finValue,
        fee: feePcnt,
        token: ctx.session.coinCode,
    };
    return ctx.replyWithHTML(
        ctx.i18n.t("withdrawConfirmation", params),
        Extra.markup(confirmButtons(ctx, "wdy"))
    );
};

const withdrawValueCheck = (ctx, text) => {
    const val = Number(text.replace(",", "."));
    if (isNaN(val)) {
        return ctx.i18n.t("invalidValue");
    } else {
        const coin = getCoinFromContext(ctx);
        const coinCode = ctx.session.coinCode;
        const minValue = coin.minValue; // * 10; // note: minimal value decreased
        if (val < minValue) {
            return ctx.i18n.t("minWithdrawWarning", { minval: minValue, coin: coinCode });
        }
        if (val > ctx.session.balance) {
            return ctx.i18n.t("notEnoughValue", { val: ctx.session.balance, coin: coinCode });
        }
    }
    return null;
};

const twitterNameCheck = async (ctx, text) => {
    try {
        const data = await ctx.twitter.getTwitterId(text, ctx.from.id);
        const item = await ctx.database.findUser("twit_user_id", data.id_str);
        if (item && ctx.from.id !== item.user_id) {
            ctx.logger.info("dup twitter: %s", item.twit_user_id);
            return ctx.i18n.t("dupTwitter");
        } else {
            ctx.logger.info("clean twitter");
            return null;
        }
    } catch (e) {
        ctx.logger.info("Twitter error: %s", JSON.stringify(e));
        return `<code>${text}</code> ${ctx.i18n.t("notInTwitter")}`;
    }
};

const sprtMessageEntered = async (ctx) => {
    const text = ctx.message.text;
    const btns = getInfoMenuButtons(ctx);
    if (btns.includes(text)) {
        if (text === btns[0]) return helpCommand()(ctx)
        else if (text === btns[1]) return partnersCommand()(ctx)
        else if (text === btns[2]) return earnCloCommand()(ctx)
        else if (text === btns[3]) return contactCommand()(ctx)
        else return mainMenuCommand()(ctx);
    }
    await ctx.telegram.forwardMessage(ctx.devFee.reportChat, ctx.chat.id, ctx.message.message_id);
    await ctx.telegram.sendMessage(ctx.devFee.reportChat, `from: ${ctx.chat.id}`);
    ctx.replyWithHTML(ctx.i18n.t("messageSent"));
};

const twitterNameEntered = (ctx, text) => {
    const userId = ctx.from.id;
    ctx.logger.info("setTwitUser %s %s", userId, text);
    ctx.twitter.getTwitterId(text, userId).then((data) => {
        if (!data) return;

        const values = {
            twit_user_name: data.screen_name,
            twit_user_id: data.id_str,
        };
        ctx.database
            .updateUser(userId, values)
            .then(() => ctx.replyWithHTML(ctx.i18n.t("linkSuccess")))
            .catch((e) => ctx.logger.error("mongo error: %s", e));
    });
};

const passwordCheck = async (ctx, text) => {
    ctx.logger.info("passwordCheck %s", ctx.from.id);

    ctx.deleteMessage();

    const txt = text.trim();

    if (txt.length < 9) {
        return ctx.i18n.t("shortPassword");
    } else if (txt.length > 28) {
        return ctx.i18n.t("longPassword");
    } else if ((txt === ctx.i18n.t("setPwdButton")) || (txt === ctx.i18n.t("mainMenuButton")) ) {
        return ctx.i18n.t("wrongPassword");
    } else {
        return null;
    }
};

const unlockPasswordEntered  = async (ctx, text) => {
    const userId = ctx.from.id;
    ctx.logger.info("passwordEntered %s", userId);

    const user = await ctx.database.getUser(userId);

    const pass = text.trim();

    cleanPass(ctx);

    try {
        await decryptAsync(user.ether_wallet_key, pass);
        const passObj = {
            pass: pass,
            time: new Date()
        }
        ctx.passwords.set(userId, passObj);
        return ctx.replyWithHTML(ctx.i18n.t('unlockSuccess'));
    } catch (e) {
        return ctx.replyWithHTML(ctx.i18n.t('decryptError'));
    }
}

const encryptPasswordEntered = async (ctx, text) => {
    const userId = ctx.from.id;
    ctx.logger.info("passwordEntered %s", userId);

    const password = text.trim();

    let user;
    try {
        user = await ctx.database.getUser(userId);
    } catch (e) {
        ctx.logger.error(e.stack);
    }

    if (user) {
        const platforms = ctx.blockchain.getPlatforms();

        const values = {
            password: null,
            encrypted: 1
        };

        for (let i = 0; i < platforms.length; i++) {
            const platform = platforms[i];
            const fieldName = `${platform}_wallet_key`;
            const walletKey = user[fieldName];
            try {
                values[fieldName] = await encryptAsync(walletKey, password);
            } catch (e) {
                ctx.logger.error(e.stack);
                return ctx.replyWithHTML(ctx.i18n.t('encryptError'));
            }
        }

        await ctx.database.updateUser(userId, values);

        ctx.session.password = null;

        return drawSecurityMenu(ctx, "encryptedSuccess");
    }
};

const passwordEntered = (ctx, text) => {
    const userId = ctx.from.id;
    ctx.logger.info("passwordEntered %s", userId);

    ctx.session.password = text.trim();

    return startTextValueQuery(ctx, "repeatPassword", passwordRepeated, passwordCheck);
};

const passwordRepeated = (ctx, text) => {
    const userId = ctx.from.id;
    ctx.logger.info("passwordRepeated %s", userId);

    if (ctx.session.password === text.trim()) {

        bcrypt.hash(ctx.session.password, saltRounds)
            .then((hash) => {
                const values = { password: hash };
                ctx.database
                    .updateUser(userId, values)
                    .then(() => drawSecurityMenu(ctx, "setPwdSuccess"))
                    .catch((e) => ctx.logger.error("mongo error: %s", e));
            });
        ctx.session.password = null;

    } else {
        ctx.replyWithHTML(ctx.i18n.t("pwdNotMatch"));
    }
};

const oldPasswordDntEntered = (ctx) => {
    const userId = ctx.from.id;
    ctx.logger.info("oldPasswordDntEntered %s", userId);

    continueDonate(ctx);
};

const oldPasswordWdrEntered = (ctx) => {
    const userId = ctx.from.id;
    ctx.logger.info("oldPasswordWdrEntered %s", userId);

    continueWithdraw(ctx);
};

const oldPasswordPkEntered = (ctx) => {
    const userId = ctx.from.id;
    ctx.logger.info("oldPasswordPkEntered %s", userId);

    return showDepositAddress(ctx, ctx.from.id, "prkMessage", "prk");
};

const oldPasswordEntered = (ctx) => {
    const userId = ctx.from.id;
    ctx.logger.info("oldPasswordEntered %s", userId);

    return startTextValueQuery(ctx, "enterNewPassword", passwordEntered, passwordCheck);
};

const passwordHashCheck = async (ctx, text) => {
    ctx.logger.info("passwordHashCheck");

    ctx.deleteMessage();

    const user = await ctx.database.getUser(ctx.from.id);
    if (!user) return ctx.i18n.t("cantCheckPassword");

    if (user.encrypted) {
        ctx.session.password = text.trim();
        return null;
    }

    const oldPassword = user.password;

    let result = false;

    try {
        result = await bcrypt.compare(text.trim(), oldPassword);
    } catch (e) {
        ctx.logger.error(e);
    }

    if (result) {
        return null;
    } else {
        return ctx.i18n.t("wrongPassword");
    }
};

const defaultsEntered = async (ctx, text) => {
    ctx.logger.debug("defaultsEntered %s", text);
    const defs = text.split(/(\s+)/).filter((e) => e.trim().length > 0);
    const coinCode = ctx.session.coinCode;
    const values = {
        [`${coinCode}_tip_value`]: Number(defs[0]),
        [`${coinCode}_rain_value`]:
            defs.length > 1 ? Number(defs[1]) : ctx.blockchain.getCoins()[coinCode].minValue * 10,
    };

    await ctx.database.updateUser(ctx.from.id, values);
    return ctx.replyWithHTML(ctx.i18n.t("defaultsSuccess"));
};

const defaultsCheck = (ctx, text) => {
    ctx.logger.debug("defaultsCheck %s", text);
    const defs = text.split(/(\s+)/).filter((e) => e.trim().length > 0);
    let val = Number(defs[0].replace(",", "."));
    if (isNaN(val)) {
        return ctx.i18n.t("errorDefaults");
    }
    if (defs.length < 2) return null;
    val = Number(defs[1].replace(",", "."));
    if (isNaN(val)) {
        return ctx.i18n.t("errorDefaults");
    }
    return null;
};

const withdrawCallback = (srcObj, destObj, aValue, coinCode, ctx, txHash, txType) => {
    ctx.database.logOperationDb(txType, srcObj, destObj, aValue, txHash, ctx.chat.id, coinCode);
    const coin = ctx.blockchain.getCoins()[coinCode];
    const text = (txType === 1) ? "withdrawSent" : "donationSent";
    return ctx.replyWithHTML(
        ctx.i18n.t(text, { txExplorer: coin.txExplorer, hash: txHash, val: aValue, token: coinCode }),
        Extra.webPreview(false)
    );
};

const startStakeCallback = (srcObj, destObj, aValue, coinCode, ctx, txHash) => {
    ctx.database.logOperationDb(7, srcObj, destObj, aValue, txHash, ctx.chat.id, coinCode);
    return showStakeStatus(ctx, srcObj.id);
};

const claimStakeCallback = (txType, [srcObj, coinCode, ctx, txHash]) => {
    const item = {
        address: srcObj.ether_wallet_address,
        name: formatUserName(srcObj),
        id: srcObj.user_id,
    };
    ctx.database.logOperationDb(8, item, item, 0, txHash, ctx.chat.id, coinCode);
    const txt = (txType === 8) ? "stkClaimSuccess" : "stkWithdrawSuccess";
    return ctx.replyWithHTML(ctx.i18n.t(txt));
    // return showStakeStatus(ctx, item.id);
};

/**
 * Helper functions
 */
async function showMainMenu(ctx, text) {
    const user = await isUserRegistered(ctx, ctx.from.id, false);
    const isRegistered = !(!user);

    ctx.session.password = null;

    ctx.replyWithHTML(
        ctx.i18n.t(text),
        Extra.markup(mainMenuButtons(ctx, isRegistered)).webPreview(false)
    ).catch((e) => ctx.logger.error("TG error: %s", e.description));
}

async function processUnlock(ctx) {
    const user = await ctx.database.getUser(ctx.from.id);
    if (!user) return;

    if (user.encrypted) {
        return startTextValueQuery(ctx, "enterPassword", unlockPasswordEntered, passwordHashCheck);
    } else {
        return showMainMenu(ctx,"notLockedMessage");
    }
}

async function drawSecurityMenu(ctx, msgValue) {
    const user = await ctx.database.getUser(ctx.from.id);
    let isPwd = false;
    let isEncrypted = false;
    if (user) {
        if (user.password) isPwd = true;
        if (user.encrypted) isEncrypted = true;
    }
    return ctx.replyWithHTML(ctx.i18n.t(msgValue), Extra.markup(securityButtons(ctx, isPwd, isEncrypted)));
}

function getCoinFromContext(ctx) {
    const coinCode = ctx.session.coinCode;
    return ctx.blockchain.getCoins()[coinCode];
}

async function getTwitterName(ctx, userId) {
    let messageText = `${ctx.i18n.t("noteTwitter")}`;
    const user = await ctx.database.getUser(userId);
    if (user) {
        if (user.twit_user_name) {
            messageText = `${ctx.i18n.t("linkedTwitter")} @${user.twit_user_name}
${ctx.i18n.t("noteTwitter")}
${ctx.i18n.t("anotherTwitter")}`;
        }
    }
    return ctx.replyWithHTML(messageText);
}

async function doDonate(ctx, userId) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    if ((user.password) || (user.encrypted)) {
        if (ctx.passwords.has(ctx.from.id)) return continueDonate(ctx)
        else return startTextValueQuery(ctx, "enterPassword", oldPasswordDntEntered, passwordHashCheck);
    } else return continueDonate(ctx);
}

function continueDonate(ctx) {
    return showDepositAddress(ctx, ctx.from.id, "donateMessage", "dnt");
}

async function doWithdraw(ctx, userId) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    if ((user.password) || (user.encrypted)) {
        if (ctx.passwords.has(ctx.from.id)) return continueWithdraw(ctx)
        else return startTextValueQuery(ctx, "enterPassword", oldPasswordWdrEntered, passwordHashCheck);
    } else return continueWithdraw(ctx);
}

function continueWithdraw(ctx) {
    const coins = ctx.blockchain.getCoins();
    return ctx.replyWithHTML(
        ctx.i18n.t("withdrawMessage"),
        Extra.markup(coinsButtons(ctx, coins, "wdr"))
    );
}

async function showDepositAddress(ctx, userId, msgValue, btnPrefix, all) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    const coins = ctx.blockchain.getCoins();
    const allTxt = all ? ctx.i18n.t(all) : undefined;
    return ctx.replyWithHTML(
        ctx.i18n.t(msgValue),
        Extra.markup(coinsButtons(ctx, coins, btnPrefix, allTxt))
    );
}

function stakeTimesCalc(aTtime) {
    let stkObj = {};
    let dt = new Date(Number(aTtime) * 1000);
    const dtNow = new Date();

    let days = Math.floor((dtNow.getTime() - dt.getTime()) / (oneHourMs * 24));
    const nround = Math.floor(days / 27) + 1;
    days = 27 - (days - (nround - 1) * 27); // days to claim

    // let prgrs = Math.round((27 - days) / 27 * 10000) / 100;

    const hours = Math.abs(
        Math.round((dtNow.getTime() - dt.getTime() - nround * days27) / oneHourMs)
    );
    let prgrs = Math.round(10000 - ((hours % 648) / 648) * 10000) / 100;
    if (nround > 1) {
        prgrs = 100;
    }

    dt.setTime(dt.getTime() + nround * days27);
    stkObj.date = dt;
    stkObj.days = days;
    stkObj.round = nround;
    stkObj.prgrs = prgrs;
    stkObj.hours = hours;
    return stkObj;
}

async function showStakeStatus(ctx, userId) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    const wallet = user.ether_wallet_address;
    ctx.logger.debug("showStakeStatus: %s", wallet);
    const { stkValue, stkTime } = await ctx.blockchain.getStaker(wallet);
    if (stkValue > 0) {
        ctx.logger.debug("Staking time: %s", stkTime);

        const stkObj = stakeTimesCalc(stkTime);
        let wrd = ctx.i18n.t("wordDays");
        let days = stkObj.days;

        if (days < 2) {
            // if days < 1 - show Hours
            wrd = ctx.i18n.t("wordHours");
            days = stkObj.hours;
        }

        const lang = ctx.i18n.locale();
        const balance = await ctx.blockchain.getBalance("CLO", wallet);
        const reward = await ctx.blockchain.getStakeReward(wallet);
        ctx.logger.debug("Stake reward: %s", reward);
        const options = {
            balance: balance,
            coinName: "CLO",
            val: stkValue,
            reward: reward,
            prgrs: stkObj.prgrs,
            round: stkObj.round,
            stkDate: stkObj.date.toLocaleString(lang),
            wrd: wrd,
            days: days,
        };
        return ctx.replyWithHTML(ctx.i18n.t("stakingInfoMsg", options));
    } else {
        return ctx.replyWithHTML(ctx.i18n.t("notStaking"));
    }
}

async function startStake(ctx, userId) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    const wallet = user.ether_wallet_address;
    const balance = await ctx.blockchain.getBalance("CLO", wallet);

    if (balance < 10) {
        return ctx.replyWithHTML(ctx.i18n.t("stakeNotEnough"));
    } else {
        await ctx.replyWithHTML(`${ctx.i18n.t("balanceMessage")} ${balance} CLO`);
    }

    ctx.session.balance = balance;
    ctx.session.coinCode = "CLO";
    const alreadyStaking = await ctx.blockchain.isStakeActive(wallet);
    const messageText = alreadyStaking ? "stakeActiveWarning" : "stakeStartWarning";
    return ctx.replyWithHTML(ctx.i18n.t(messageText), Extra.markup(confirmButtons(ctx, "sts")));
}

async function getStake(ctx, userId, warnMsg, prefix) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    const wallet = user.ether_wallet_address;
    const aStaker = await ctx.blockchain.getStaker(wallet);

    let messageText = "";
    if (aStaker.stkValue) {
        let stkObj = stakeTimesCalc(aStaker.stkTime);
        if (stkObj.round < 2) {
            // staking is Active
            if (stkObj.days > 1) {
                messageText = `${ctx.i18n.t("stakeRoundWait")} ${stkObj.days} ${ctx.i18n.t(
                    "wordDays"
                )}`;
            } else {
                messageText = `${ctx.i18n.t("stakeRoundWait")} ${stkObj.days} ${ctx.i18n.t(
                    "wordHours"
                )}`;
            }
            return ctx.replyWithHTML(messageText);
        } else {
            return ctx.replyWithHTML(
                ctx.i18n.t(warnMsg),
                Extra.markup(confirmButtons(ctx, prefix))
            );
        }
    } else {
        return ctx.replyWithHTML(ctx.i18n.t("notStaking"));
    }
}

async function claimStake(ctx, userId) {
    return getStake(ctx, userId, "stakeClaimWarning", "stc");
}

async function withdrawStake(ctx, userId) {
    return getStake(ctx, userId, "stakeWithdrawWarning", "stw");
}

async function showOpHistory(ctx, userId) {
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    let history = await ctx.database.getOperationsSent(userId);

    const coins = ctx.blockchain.getCoins();

    let replyMessage = "";

    if (history.length) replyMessage += "<b>➡️ Send operations:</b>\n";
    for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const coin = coins[item._id];
        replyMessage += `<b>${item._id}:</b>  ${coinFormat(item.pp, coin.decimals)}\n`;
    }

    if (replyMessage.length) replyMessage += "\n";
    history = await ctx.database.getOperationsGet(userId);

    if (history.length) replyMessage += "<b>⬅️️ Receive operations:</b>\n";
    for (let i = 0; i < history.length; i++) {
        const item = history[i];
        const coin = coins[item._id];
        replyMessage += `<b>${item._id}:</b>  ${coinFormat(item.pp,coin.decimals)}\n`;
    }

    if (replyMessage.length) return ctx.replyWithHTML(replyMessage, Extra.webPreview(false))
    else return ctx.replyWithHTML(ctx.i18n.t("noOperations"));
}

// async function showOpHistoryOld(ctx, userId) {
//     const user = await isUserRegistered(ctx, userId, true);
//     if (!user) return;
//
//     const history = await ctx.database.getOperations(userId);
//     if (!history.length) {
//         return ctx.replyWithHTML(ctx.i18n.t("noOperations"));
//     }
//
//     const coins = ctx.blockchain.getCoins();
//     let replyMessage = "";
//     let opTypeStr = "";
//     for (let i = 0; i < history.length; i++) {
//         const item = history[i];
//         let locMsg = "";
//         const coin = coins[item.token];
//         const txLink = `<a href="${coin.txExplorer}${item.tx_id}">txHash</a>`;
//         if (item.op_type === 1) {
//             opTypeStr = "Withdraw";
//             locMsg += `${opTypeStr} ${item.op_amount} ${item.token} | ${txLink}`;
//         } else if (item.op_type === 7) {
//             opTypeStr = "Stake";
//             locMsg += `${opTypeStr} ${item.op_amount} ${item.token} | ${txLink}`;
//         } else if (item.op_type === 10) {
//             opTypeStr = "Donation";
//             locMsg += `${opTypeStr} ${item.op_amount} ${item.token} | ${txLink}`;
//         } else if (item.op_type === 9) {
//             opTypeStr = "Withdraw stake";
//             locMsg += `${opTypeStr} ${item.op_amount} ${item.token} | ${txLink}`;
//         } else if (item.op_type === 8) {
//             opTypeStr = "Claim stake";
//             locMsg += `${opTypeStr} ${item.op_amount} ${item.token} | ${txLink}`;
//         } else {
//             if (item.op_type === 2) {
//                 opTypeStr = "tip";
//             } else if (item.op_type === 3) {
//                 opTypeStr = "giveaway";
//             } else if (item.op_type === 4) {
//                 opTypeStr = "rain";
//             } else if (item.op_type === 5 || item.op_type === 6) {
//                 opTypeStr = "lottery";
//             }
//             if (userId === item.from_user_id) {
//                 locMsg += `${ctx.i18n.t("sent")} (${opTypeStr}) ${item.op_amount} ${
//                     item.token
//                 } -&gt; `;
//                 locMsg += `${item.to_user} | ${txLink}`;
//             } else {
//                 locMsg += `${ctx.i18n.t("received")} (${opTypeStr}) ${item.op_amount} ${
//                     item.token
//                 } &lt;- `;
//                 locMsg += `${item.from_user} | ${txLink}`;
//             }
//         }
//         const msgObj = await splitLongMessage(replyMessage, locMsg, ctx);
//         replyMessage = msgObj.replyMessage;
//     }
//     return ctx.replyWithHTML(replyMessage, Extra.webPreview(false));
// }

async function regNewUser(ctx, userId) {
    const user = await isUserRegistered(ctx, userId);
    if (user) {
        ctx.logger.info("regNewUser = user exists: %s", userId);
        return ctx.replyWithHTML(ctx.i18n.t("userExists"), Extra.markup(mainMenuButtons(ctx, true)));
    }

    const etherWallet = ctx.blockchain.registerWallet("ether");
    const binanceWallet = ctx.blockchain.registerWallet("binance");
    const ltcWallet = ctx.blockchain.registerWallet("litecoin");
    const btcWallet = ctx.blockchain.registerWallet("bitcoin");

    const newUser = {
        user_id: userId,
        user_name: ctx.from.username,
        user_first_name: ctx.from.first_name,
        user_last_name: ctx.from.last_name,
        user_reg_date: new Date(),
        ether_wallet_address: etherWallet.walletAddress,
        ether_wallet_key: etherWallet.walletKey,
        binance_wallet_address: binanceWallet.walletAddress,
        binance_wallet_key: binanceWallet.walletKey,
        litecoin_wallet_address: ltcWallet.walletAddress,
        litecoin_wallet_key: ltcWallet.walletKey,
        bitcoin_wallet_address: btcWallet.walletAddress,
        bitcoin_wallet_key: btcWallet.walletKey,
    };

    checkOneChatMember(ctx, userId);

    ctx.database.newUser(newUser);
    ctx.logger.info("regNewUser = registered: %s", userId);
    return ctx.replyWithHTML(ctx.i18n.t("userRegistered"), Extra.markup(mainMenuButtons(ctx, true)));
}

async function addNewCoin(ctx) {
    const platform = ctx.state.command.splitArgs[0];
    const fieldName = `${platform}_wallet_address`;

    const users = await ctx.database.findUsers(fieldName, null);

    users.forEach((user) => {
        const wallet = ctx.blockchain.registerWallet(platform);
        const values = {
            [fieldName]: wallet.walletAddress,
            [`${platform}_wallet_key`]: wallet.walletKey,
        };
        ctx.database.updateUser(user.user_id, values);
    });
}

function botRestart(ctx) {
    if (ctx.restartTimeOut) {
        ctx.logger.info("not killing - restart active");
    } else {
        ctx.logger.info("killing process");
        process.exit();
    }
}

function botStop(ctx) {
    if (ctx.restartTimeOut) {
        ctx.logger.info("not stopping - restart active");
    } else {
        ctx.logger.info("stopping process");
        Exec("pm2 stop " + ctx.globalOpts.pm2name, function (err, stdout) {
            if (err) {
                ctx.logger.error(err);
            } else {
                ctx.logger.info(stdout);
            }
        });
    }
}

async function importUsers(ctx) {
    const sourceDb = ctx.state.command.splitArgs[0];

    const users = await ctx.database.getAllUsers(sourceDb);
    if (!users) return;

    const bxFee = await ctx.blockchain.getTxFee("ETC");

    let cnt = 0;
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const userId = Number(user.user_id);
        let newUser = {
            user_id: userId,
            user_reg_date: user.user_reg_date,
            user_name: user.user_name,
            user_first_name: user.user_first_name,
            user_last_name: user.user_last_name,
            twit_user_id: user.twit_user_id,
            twit_user_name: user.twit_user_name,
            inactive: user.inactive,
            inactive_date: user.inactive_date,
            bl_chat_id: user.bl_chat_id,
        };

        if (sourceDb === "etctipbot") {
            ctx.logger.info("importing ETC users, TX fee: %s", bxFee);
            const locUser = await ctx.database.getUser(userId);
            newUser.ETC_tip_value = user.def_value;
            if (locUser) {
                // ctx.session.coinCode = 'ETC';
                const usersQueue = [];
                const balance = await ctx.blockchain.getBalance("ETC", user.wallet_address);
                locUser.value = balance - bxFee;
                locUser.txType = 10;
                if (locUser.value > 0 && user.wallet_address !== locUser.ether_wallet_address) {
                    usersQueue.push(locUser);
                    user.ether_wallet_address = user.wallet_address;
                    user.ether_wallet_key = user.wallet_key;
                    user.token = "ETC";
                    ctx.blockchain.addMultiTxQuery(user, usersQueue, ctx);
                }
            } else {
                ctx.logger.debug("new user from ETC: %s", userId);
                newUser.ether_wallet_address = user.wallet_address;
                newUser.ether_wallet_key = user.wallet_key;
            }
        } else {
            newUser.CLO_tip_value = user.def_value;
            newUser.ether_wallet_address = user.wallet_address;
            newUser.ether_wallet_key = user.wallet_key;
        }

        cnt++;
        ctx.database.updateUser(userId, newUser);
    }

    return ctx.replyWithHTML(`Imported ${cnt} users`);
}

async function getUserInfo(ctx) {
    const userId = Number(ctx.state.command.splitArgs[0]);
    let user;
    if (isNaN(userId)) {
        const userName = ctx.state.command.splitArgs[0].replace("@", "");
        user = await ctx.database.findUser("user_name", userName);
    } else {
        user = await ctx.database.getUser(userId);
    }
    if (user) {
        return ctx.replyWithHTML(JSON.stringify(user, null, 3));
    } else {
        return ctx.replyWithHTML("user not found");
    }
}

async function sendMessageAsBot(ctx) {
    let dbUserId = Number(ctx.state.command.splitArgs[0]);
    if (isNaN(dbUserId)) {
        const userName = ctx.state.command.splitArgs[0].replace("@", "");
        const user = await ctx.database.findUser("user_name", userName);
        if (user) {
            dbUserId = user.user_id;
        } else {
            return ctx.replyWithHTML("user not found");
        }
    }
    const message = ctx.state.command.splitArgs.slice(1).join(" ");
    return ctx.telegram.sendMessage(dbUserId, message);
}

async function sendUsersMessageAsBot(ctx) {
    const message = ctx.state.command.splitArgs.slice(0).join(" ");
    const templ = [/([\s\S])*/i];
    try {
        const users = await ctx.database.getUsersIds(templ);
        const list = users.map((user) => user.user_id);
        sendMultiMessage(ctx, message, list);
    } catch (e) {
        ctx.logger.error("mongo error: %s", e);
    }
}

async function sendAdminMessageAsBot(ctx) {
    const message = ctx.state.command.splitArgs.slice(0).join(" ");
    const chats = [...ctx.chatsMap.keys()];
    const list = [];
    const set = new Set();
    for (let i = 0; i < chats.length; i++) {
        try {
            const admins = await ctx.telegram.getChatAdministrators(chats[i]);
            admins.forEach((admin) => {
                const userId = admin.user.id;
                if (!set.has(userId)) {
                    list.push(userId);
                    set.add(userId);
                }
            });
        } catch (e) {
            ctx.logger.error("TG error: %s", e.description);
        }
    }
    sendMultiMessage(ctx, message, list);
}

async function countStartUsers(ctx) {
    const today = new Date();
    let date = new Date();

    date.setTime(today.getTime() - oneDayMs);
    const byDay = await ctx.database.getStartUsers(date);

    date.setTime(today.getTime() - oneDayMs * 2);
    const byDayTwo = await ctx.database.getStartUsers(date);

    date.setTime(today.getTime() - oneDayMs * 3);
    const byDayThree = await ctx.database.getStartUsers(date);

    date.setTime(today.getTime() - oneDayMs * 7);
    const byWeek = await ctx.database.getStartUsers(date);

    date.setTime(today.getTime() - oneDayMs * 30);
    const byMonth = await ctx.database.getStartUsers(date);

    const byAll = await ctx.database.getStartUsers();

    const msg = `Count of Start commands:\nDay: ${byDay}\n2 Days: ${byDayTwo}\n3 Days: ${byDayThree}
Week: ${byWeek}\nMonth: ${byMonth}\nTotal: ${byAll}`;

    ctx.replyWithHTML(msg);
}

function sendChatsMessageAsBot(ctx) {
    const message = ctx.state.command.splitArgs.slice(0).join(" ");
    const list = [...ctx.chatsMap.keys()];
    sendMultiMessage(ctx, message, list);
}

function sendMultiMessage(ctx, message, chats) {
    if (!chats.length) return;

    const chatId = chats.shift();
    ctx.logger.debug("sendMultiMessage to %s / %s msg: %s", chats.length, chatId, message);

    ctx.telegram.sendMessage(chatId, message).catch((e) => {
        const eStr = e.toString();

        if (chatId < 0) {
            if (eStr.indexOf("was kicked") !== -1 || eStr.indexOf("chat not found") !== -1) {
                ctx.database.deleteChat(chatId);
                ctx.chatsMap.delete(chatId);
            }
        } else {
            const inType = parseSendMessageError(e);
            if (inType && ctx.globalOpts.markInactive) ctx.database.setInactiveUser(chatId, inType);
        }
    });

    setTimeout(sendMultiMessage, 100, ctx, message, chats);
}

function getChatList(ctx) {
    let message = "";
    for (const [key, value] of ctx.chatsMap.entries()) {
        const nm = value.user_name ? `@${value.user_name}` : value.title;
        message += `${key} | [${value.type[0]}] | ${nm} | (${value.def_coin})\n`;
    }
    return ctx.replyWithHTML(message);
}

function checkOneChatMember(ctx, userId) {
    const chats = [...ctx.chatsMap.keys()];
    for (let i = 0; i < chats.length; i++) {
        const chatId = chats[i];
        ctx.telegram
            .getChatMember(chatId, userId)
            .then((tgUser) => {
                if (
                    tgUser &&
                    tgUser.status !== "left" && // (chatUser.status !== 'restricted') &&
                    tgUser.status !== "kicked"
                ) {
                    ctx.database.newChatUser(chatId, userId);
                } else {
                    ctx.database.deleteChatUser(chatId, userId);
                }
            })
            .catch(() => {
                ctx.database.deleteChatUser(chatId, userId);
            });
    }
}

module.exports = {
    startCommand,
    newUserCommand,
    settingsCommand,
    stakingMenuCommand,
    mainMenuCommand,
    balanceCommand,
    depositCommand,
    withdrawCommand,
    earnCloCommand,
    setTwitterCommand,
    setLanguageCommand,
    displayPkCommand,
    displayHistoryCommand,
    setDefaultsCommand,
    getStakeStatusCommand,
    startStakeCommand,
    claimStakeCommand,
    withdrawStakeCommand,
    twitterNameEntered,
    twitterNameCheck,
    withdrawAddressEntered,
    walletAddressCheck,
    withdrawValueEntered,
    withdrawValueCheck,
    withdrawCallback,
    startStakeCallback,
    claimStakeCallback,
    defaultsEntered,
    defaultsCheck,
    stakeValueEntered,
    newCoinCommand,
    importCommand,
    restartCommand,
    stopCommand,
    userInfoCommand,
    messageCommand,
    chatListCommand,
    helpCommand,
    messageChatsCommand,
    messageUsersCommand,
    messageAdminsCommand,
    checkMembersCommand,
    startLotteryCommand,
    stakeTimesCalc,
    checkChatMembers,
    countStartCommand,
    unlockCommand,
    securityMenuCommand,
    setPwdCommand,
    changePwdCommand,
    encryptCommand,
    passwordCheck,
    passwordEntered,
    passwordRepeated,
    setPwdConfirm,
    oldPasswordEntered,
    passwordHashCheck,
    oldPasswordPkEntered,
    oldPasswordWdrEntered,
    oldPasswordDntEntered,
    encryptConfirm,
    encryptPasswordEntered,
    unlockPasswordEntered,
    walletCommand,
    infoCommand,
    donateCommand,
    showMainMenu,
    partnersCommand,
    contactCommand,
    sprtMessageEntered,
    reportCommand,
    donateValueEntered,
    checkMembersGlobalCommand
};
