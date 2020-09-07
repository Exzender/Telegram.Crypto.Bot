const price = require('crypto-price');

function coinFormat(aValue, aPos) {
    const pow = Math.pow(10, aPos);
    return Math.floor(aValue * pow) / pow;
}

function calcFee(aValue, aPcnt, aMinValue) {
    let feeAmount = (aValue / 100) * aPcnt;

    if (feeAmount < aMinValue && aPcnt > 0) {
        feeAmount = aMinValue;
    }

    return feeAmount;
}

function getFeeByChat(ctx, feeName) {
    const chatObj = ctx.chatsMap.get(ctx.chat.id);

    const fee = chatObj[feeName] !== undefined
        ? chatObj[feeName]
        : ctx.devFee[feeName];
    ctx.logger.debug("fee %s = %s", feeName, fee);
    return fee;
}

function getMinPotValue(ctx, token) {
    const minValue = ctx.blockchain.coins[token].minValue;
    return (minValue < 1) ? minValue * 20 : minValue * 50;
}

function getFeeItem(fee, token, coin) {
    return {
        user_name: "fee",
        wallet_address: coin.feeWallet,
        value: fee,
        txType: 0,
    };
}

async function getCoinPrice(token) {
    try {
        const obj = await price.getBasePrice('USD', token);
        return ((obj.price)) / 100;
    } catch (e) {
        return null;
    }
}

module.exports = {
    coinFormat,
    calcFee,
    getFeeItem,
    getFeeByChat,
    getMinPotValue,
    getCoinPrice
};
