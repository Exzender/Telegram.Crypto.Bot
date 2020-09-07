/**
 * Module with response functions to Actions in Private chats
 */

const Extra = require("telegraf/extra");
const QRCode = require('qrcode');
const { getFeeItem } = require("./../blockchain");
const {
    withdrawAddressButtons,
    withdrawValueButtons,
    stakingValueButtons,
    donateValueButtons
} = require("./../buttons");
const { startTextValueQuery } = require("./../scenes");
const {
    withdrawAddressEntered,
    walletAddressCheck,
    withdrawValueEntered,
    withdrawValueCheck,
    defaultsEntered,
    defaultsCheck,
    stakeValueEntered,
    setPwdConfirm,
    encryptConfirm,
    showMainMenu,
    donateValueEntered
} = require("./../commands");
const { isBotAdmin, isUserRegistered, markForDelete, getInPrivPrivateKey, cleanPass } = require('./../utils');

/**
 * Private chat actions
 */
const selectLanguageAction = () => async (ctx) => {
    ctx.logger.debug("language changed %s", ctx.from.id);
    const lngCode = ctx.match[0].substring(5);
    ctx.i18n.locale(lngCode);
    ctx.answerCbQuery().then();
    return showMainMenu(ctx,"languagePrivate");
};

const showPkAction = () => async (ctx) => {
    return showAddressAction(ctx, "pkCoinMessage", "wallet_key", true);
};

const showInfoAction = () => async (ctx) => {
    return showProjectInfo(ctx);
};

const showDepositAction = () => async (ctx) => {
    return showAddressAction(ctx, "depositCoinMessage", "wallet_address");
};

const showDefaultsAction = () => async (ctx) => {
    return showDefaults(ctx);
};

const showBalanceAction = () => async (ctx) => {
    ctx.logger.info('query balance %s', ctx.from.id);

    ctx.answerCbQuery().then();

    const coinCode = ctx.match[0].substring(4);
    let token;
    if (coinCode === 'ALL') {
        token = undefined;
    } else {
        const coin = ctx.blockchain.getCoins()[coinCode];
        if (coin) {
            token = coinCode;
        } else {
            return;
        }
    }

    let text = await getUserBalance(ctx, ctx.from.id, token);

    if ((isBotAdmin(ctx)) && (!token)) {
        text += '\n Fee Balance:';
        text += await getFeeBalance(ctx);
    }

    if (text) return ctx.replyWithHTML(text);
};

const showWithdrawAction = () => async (ctx) => {
    clearCbButtons(ctx);

    const coinCode = ctx.match[0].substring(4);
    const userId = ctx.from.id;
    const coin = ctx.blockchain.getCoins()[coinCode];

    // const balance = await getCoinBalance(ctx, coin, coinCode);

    const user = await ctx.database.getUser(userId);
    const addr = user[`${coin.platform}_wallet_address`];
    const balance =  await ctx.blockchain.getBalance(coinCode, addr);


    ctx.session.coinCode = coinCode;
    ctx.session.balance = balance;
    // ctx.answerCbQuery().then();

    ctx.logger.debug("swithdrawAction %s balance %s %s", userId, balance, coinCode);

    const message = `${ctx.i18n.t("balanceMessage")} <code>${balance} ${coinCode}</code>`;
    await ctx.replyWithHTML(message);

    const minValue = coin.minValue * 10;
    if (balance < minValue) {          // check min balance for withdraw
        return ctx.replyWithHTML(
            ctx.i18n.t("minWithdrawWarning", { minval: minValue, coin: coinCode })
        );
    }

    if ((coin.assetName) || (coin.tokenType)) {
        const feeBalance = await ctx.blockchain.getFeeBalance(coinCode, addr);
        const blockchainFee = await ctx.blockchain.getTxFee(coinCode);
        if (feeBalance.balance < blockchainFee * 2) {
            ctx.logger.warn("notEnoughTxFee bal = %s %s tx = %s", feeBalance.balance, feeBalance.feeCoin, blockchainFee * 2);
            return ctx.replyWithHTML(ctx.i18n.t("notEnoughTxFee", {coin: feeBalance.feeCoin}));
        }
    }

    const addresses = await getWithdrawAddresses(ctx, userId, coinCode);
    return ctx.replyWithHTML(
        ctx.i18n.t("selectWithdrawAddress"),
        Extra.markup(withdrawAddressButtons(ctx, addresses))
    );
};

const inputWithdrawAddressAction = () => async (ctx) => {
    clearCbButtons(ctx);
    return startTextValueQuery(ctx, "enterAddress", withdrawAddressEntered, walletAddressCheck);
};

const showWithdrawValueAction = () => async (ctx) => {
    clearCbButtons(ctx);
    const addr = ctx.match[0].substring(6);
    ctx.logger.debug("showWithdrawValueAction %s", addr);
    ctx.session.address = addr;
    return ctx.replyWithHTML(
        ctx.i18n.t("enterWithdrawValue", { address: addr }),
        Extra.markup(withdrawValueButtons(ctx, addr))
    );
};

const showDonateValueAction = () => async (ctx) => {
    clearCbButtons(ctx);

    const coinCode = ctx.match[1];
    const userId = ctx.from.id;
    const coin = ctx.blockchain.getCoins()[coinCode];

    const user = await ctx.database.getUser(userId);
    const addr = user[`${coin.platform}_wallet_address`];
    const balance =  await ctx.blockchain.getBalance(coinCode, addr);

    ctx.session.balance = balance;
    ctx.session.coinCode = coinCode;

    const message = `${ctx.i18n.t("balanceMessage")} <code>${balance} ${coinCode}</code>`;
    await ctx.replyWithHTML(message);

    if (balance < coin.minValue) {
        return ctx.replyWithHTML(ctx.i18n.t("minWithdrawWarning", { minval: coin.minValue, coin: coinCode }));
    }

    return ctx.replyWithHTML(
        ctx.i18n.t("enterDonateValue"),
        Extra.markup(donateValueButtons(ctx, balance, coin.minValue, coinCode))
    );
};

const showStakeConfirmAction = () => async (ctx) => {
    clearCbButtons(ctx);
    const valueText = ctx.match[0].substring(4);
    ctx.logger.debug("showStakeConfirmAction %s", valueText);
    return stakeValueEntered(ctx, valueText);
};

const showWithdrawConfirmAction = () => async (ctx) => {
    clearCbButtons(ctx);
    const valueText = ctx.match[0].substring(4);
    ctx.logger.debug("showWithdrawConfirmAction %s", valueText);
    return withdrawValueEntered(ctx, valueText);
};

const donateConfirmAction = () => async (ctx) => {
    clearCbButtons(ctx);
    const value = ctx.match[1];
    return donateValueEntered(ctx, value);
};

const inputDonateValueAction = () => async (ctx) => {
    clearCbButtons(ctx);
    return startTextValueQuery(ctx, "enterValue", donateValueEntered, withdrawValueCheck);
};

const inputWithdrawValueAction = () => async (ctx) => {
    clearCbButtons(ctx);
    return startTextValueQuery(ctx, "enterValue", withdrawValueEntered, withdrawValueCheck);
};

const passwordConfirmAction = () => async (ctx) => {
    clearWithdrawSession(ctx);
    setPwdConfirm(ctx);
}

const encryptConfirmAction = () => async (ctx) => {
    clearWithdrawSession(ctx);
    encryptConfirm(ctx);
}

const withdrawConfirmAction = () => async (ctx) => {
    const user = await ctx.database.getUser(ctx.from.id);

    if (user) {
        const usersQueue = [];
        let bxFee = await ctx.blockchain.getTxFee(ctx.session.coinCode);

        bxFee *= 2;

        ctx.logger.debug("blockchain fee : %s %s", bxFee, ctx.session.coinCode);

        const coin = ctx.blockchain.getCoins()[ctx.session.coinCode];
        if (ctx.session.txFee) {
            const feeItem = getFeeItem(ctx.session.txFee, ctx.session.coinCode, coin); // NOTE: all network feess now payd by User
            if ((coin.tokenType) || (coin.assetName)) {
                bxFee = 0;
            } else {
                bxFee += bxFee;
            }
            usersQueue.push(feeItem);
            ctx.session.txValue -= ctx.session.txFee;
        }

        const itemDest = {
            user_name: "",
            wallet_address: ctx.session.address,
            value: ctx.session.txValue - bxFee ,
            txType: 1,
        };
        usersQueue.push(itemDest);

        user.token = ctx.session.coinCode;

        const key = await getInPrivPrivateKey(ctx, user, coin);
        if (key) {
            user.wallet_key = key;
            ctx.blockchain.addMultiTxQuery(user, usersQueue, ctx);
        }

    }
    clearWithdrawSession(ctx);
};

const withdrawCancelAction = () => async (ctx) => {
    clearWithdrawSession(ctx);

    return ctx.replyWithHTML(ctx.i18n.t("cancelStartStake"));
};

const cancelAction = () => async (ctx) => {
    clearCbButtons(ctx);

    return ctx.replyWithHTML(ctx.i18n.t("cancelStartStake"));
};

const stakeWarnConfirmAction = () => async (ctx) => {
    clearCbButtons(ctx);

    return ctx.replyWithHTML(
        ctx.i18n.t("stakeValueMsg"),
        Extra.markup(stakingValueButtons(ctx, ctx.session.balance))
    );
};

const inputStakeValueAction = () => async (ctx) => {
    clearCbButtons(ctx);

    return startTextValueQuery(ctx, "enterValue", stakeValueEntered, withdrawValueCheck);
};

const startStakeAction = () => async (ctx) => {
    clearCbButtons(ctx);

    const user = await ctx.database.getUser(ctx.from.id);

    const coin = ctx.blockchain.getCoins()['CLO'];
    const key = await getInPrivPrivateKey(ctx, user, coin);
    // ctx.logger.debug('key: %s', key);
    if (key) {
        user.wallet_key = key;
        ctx.blockchain.startStake(user, ctx.session.txValue, ctx);
    }
    // ctx.blockchain.startStake(user, ctx.session.txValue, ctx);
};

const claimStakeAction = () => async (ctx) => {
    clearCbButtons(ctx);

    const user = await ctx.database.getUser(ctx.from.id);

    const coin = ctx.blockchain.getCoins()['CLO'];
    const key = await getInPrivPrivateKey(ctx, user, coin);
    if (key) {
        user.wallet_key = key;
        return ctx.blockchain.claimStake(user, ctx);
    }
};

const withdrawStakeAction = () => async (ctx) => {
    clearCbButtons(ctx);

    const user = await ctx.database.getUser(ctx.from.id);

    const coin = ctx.blockchain.getCoins()['CLO'];
    const key = await getInPrivPrivateKey(ctx, user, coin);
    if (key) {
        user.wallet_key = key;
        return ctx.blockchain.withdrawStake(user, ctx);
    }
};

/**
 * Helper functions
 */
async function getFeeBalance(ctx) {
    const coins = ctx.blockchain.getCoins();
    let messageText = '';
    for (const [key, value] of Object.entries(coins)) {
        const addr = value.feeWallet;
        const balance = await ctx.blockchain.getBalance(key, addr);
        messageText += `\n${key}: <code>${balance}</code>`;
    }
    return messageText;
}

async function getUserBalance(ctx, userId, token) {
    ctx.logger.info('getUserBalance: %s %s', userId, token);
    const user = await isUserRegistered(ctx, userId, true);
    if (!user) return;

    let messageText = ctx.i18n.t('balanceMessage');

    if (token) {
        const value = ctx.blockchain.getCoins()[token];
        const addr = user[`${value.platform}_wallet_address`];
        const balance = await ctx.blockchain.getBalance(token, addr);
        messageText += `\n${token}: <code>${balance}</code>`;
    } else {
        const coins = ctx.blockchain.getCoins();
        for (const [key, value] of Object.entries(coins)) {
            const addr = user[`${value.platform}_wallet_address`];
            const balance = await ctx.blockchain.getBalance(key, addr);
            if (balance > 0) messageText += `\n${key}: <code>${balance}</code>`;
        }
    }

    ctx.logger.debug('FINISH getUserBalance: %s', userId);
    return messageText;
}

async function showProjectInfo(ctx) {
    const userId = ctx.from.id;

    await ctx.answerCbQuery();

    const coinCode = ctx.match[1];
    ctx.logger.debug("query project info %s %s", userId, coinCode);

    const coin = ctx.blockchain.getCoins()[coinCode];

    let typ;
    if (coin.assetName) {
        typ = "BEP2 token";
    } else if (coin.tokenType) {
        typ = coin.tokenType + " token";
    } else {
        typ = "Coin";
    }

    const obj = {
        link: coin.projectLink,
        // coin: coinCode,
        text: coin.info,
        type: typ,
        token: coinCode,
        tip: coin.minValue,
        rain: coin.minValue * 10,
        pot: (coin.minValue < 1) ? coin.minValue * 20 : coin.minValue * 50
    };

    await ctx.replyWithHTML(ctx.i18n.t("projectInfoMessage", obj), Extra.webPreview(false));
}

async function showAddressAction(ctx, msgValue, field, hide = false) {
    const userId = ctx.from.id;

    if (hide) clearCbButtons(ctx)
    else ctx.answerCbQuery().then();

    const coinCode = ctx.match[0].substring(4);
    ctx.logger.debug("query address or key %s %s", userId, coinCode);

    const coin = ctx.blockchain.getCoins()[coinCode];
    if (!coin) return;

    const user = await ctx.database.getUser(ctx.from.id);

    let obj = {
        coin: coinCode,
        name: coin.currency
    };

    let value;
    if (field === "wallet_address" ) {
        obj.link = coin.projectLink;
        value = user[`${coin.platform}_${field}`];
    } else {
        obj.link = coin.walletLink;
        value = await getInPrivPrivateKey(ctx, user, coin);
        cleanPass(ctx);
    }

    if (value) {
        await ctx.replyWithHTML(ctx.i18n.t(msgValue, obj), Extra.webPreview(false));
        const msg = await ctx.replyWithHTML(`<code>${value}</code>`);
        if (field !== "wallet_address") {
            markForDelete(ctx, msg);
        } else { // generate QRcode
            const buf = await generateQRCode(value);
            ctx.replyWithPhoto({source: buf});
        }
    }
}

function generateQRCode(url) {
    return QRCode.toBuffer(url);
}

async function showDefaults(ctx) {
    ctx.logger.debug("query defaults %s", ctx.from.id);
    ctx.answerCbQuery().then();

    const coinCode = ctx.match[0].substring(4);
    const coin = ctx.blockchain.getCoins()[coinCode];
    const user = await ctx.database.getUser(ctx.from.id);

    const tipField = `${coinCode}_tip_value`;
    const rainField = `${coinCode}_rain_value`;
    const tipValue = user[tipField] ? user[tipField] : coin.minValue;
    const rainValue = user[rainField] ? user[rainField] : coin.minValue * 10;

    const messageText = ctx.i18n.t("welcomeDefaults", {
        tipVal: tipValue,
        rainVal: rainValue,
        coinCode: coinCode,
    });

    ctx.session.coinCode = coinCode;
    await ctx.replyWithHTML(messageText);
    return startTextValueQuery(ctx, "enterDefaults", defaultsEntered, defaultsCheck);
}

function clearCbButtons(ctx) {
    ctx.editMessageText(ctx.callbackQuery.message.text).then();
    return ctx.answerCbQuery();
}

function clearWithdrawSession(ctx) {
    ctx.session.coinCode = null;
    ctx.session.balance = null;
    ctx.session.address = null;
    ctx.session.txValue = null;
    ctx.session.txFee = null;
    cleanPass(ctx);

    return clearCbButtons(ctx);
}

function getWithdrawAddresses(ctx, userId, coinCode) {
    return ctx.database.getExtAddresses(userId, coinCode);
}

module.exports = {
    selectLanguageAction,
    showDepositAction,
    showWithdrawAction,
    inputWithdrawAddressAction,
    showWithdrawValueAction,
    inputWithdrawValueAction,
    showWithdrawConfirmAction,
    showPkAction,
    withdrawConfirmAction,
    withdrawCancelAction,
    showDefaultsAction,
    cancelAction,
    stakeWarnConfirmAction,
    inputStakeValueAction,
    showStakeConfirmAction,
    startStakeAction,
    claimStakeAction,
    withdrawStakeAction,
    showBalanceAction,
    passwordConfirmAction,
    encryptConfirmAction,
    showInfoAction,
    showDonateValueAction,
    inputDonateValueAction,
    donateConfirmAction
};
