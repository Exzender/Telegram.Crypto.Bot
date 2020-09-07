const Markup = require('telegraf/markup');

const withdrawAddressButtons = (ctx, addresses) => {
    const buttons = [];
    ctx.logger.debug('withdrawAddressButtons');

    const cnt = (addresses.length < 4) ? addresses.length : 4 ;
    let row = [];
    const lst = new Set();

    for (let i = 0; i < cnt; i++) {
        let nm = addresses[i];
        if (!lst.has(nm)) {
            lst.add(nm);
            ctx.logger.debug('withdraw address %s', nm);
            row.push(Markup.callbackButton(generateWithdrawName(nm), `wdrad_${nm}`));
            if (nm.length === 2 || nm.length === 4) {
                buttons.push(row);
                row = [];
            }
        }
    }

    if (row.length) {
        buttons.push(row);
    }

    buttons.push([Markup.callbackButton(ctx.i18n.t('withdrawAddressManual'), 'wdrad0')]);
    return Markup.inlineKeyboard(buttons);
};

function generateWithdrawName(aText) {
    return aText.substr(0, 6) + '...' + aText.substr(aText.length-7,7);
}

const confirmButtons = (ctx, prefix) => {
    const buttons = [];
    const row = [];

    row.push(Markup.callbackButton(ctx.i18n.t('yesBtn'), `${prefix}_yes`));
    row.push(Markup.callbackButton(ctx.i18n.t('cancelBtn'), `${prefix}_cancel`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

const withdrawValueButtons = (ctx) => {
    ctx.logger.debug('generateWithdrawValueMessage');
    const balance = ctx.session.balance;
    const coinCode = ctx.session.coinCode;
    const coin = ctx.blockchain.getCoins()[coinCode];
    const minCoinValue = coin.minValue;
    let row = [];
    const buttons = [];

    const val25 = Number(balance) * 0.25;
    const txtVal25 = `${val25} (25%)`;
    const val50 = Number(balance) * 0.5;
    const txtVal50 = `${val50} (50%)`;
    // const val100 = Number(balance) - minCoinValue;
    const txtVal100 = `${balance} (100%)`;

    if (val25 > minCoinValue * 10 ) {
        row.push(Markup.callbackButton(txtVal25, `wdv_${val25}`));
    }
    if (val50 > minCoinValue * 10 ) {
        row.push(Markup.callbackButton(txtVal50, `wdv_${val50}`));
    }
    row.push(Markup.callbackButton(txtVal100, `wdv_${balance}`));
    buttons.push(row);
    row = [];
    row.push(Markup.callbackButton(ctx.i18n.t('withdrawVlueManual'), `wdv0`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    withdrawAddressButtons,
    withdrawValueButtons,
    confirmButtons
};
