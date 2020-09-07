const Markup = require('telegraf/markup');

const stakingMenuButtons = (ctx) => {
    const buttons = [];
    buttons.push([
        ctx.i18n.t('statusButton'),
        ctx.i18n.t('startStkButton')],[
        ctx.i18n.t('claimStkButton'),
        ctx.i18n.t('withdrawStkButton')],[
        ctx.i18n.t('mainMenuButton')
    ]);
    return Markup.keyboard(buttons).resize();
};

const stakingValueButtons = (ctx, balance) => {
    ctx.logger.debug('stakingValueButtons');
    const coin = ctx.blockchain.getCoins()['CLO'];
    const minCoinValue = coin.minValue;
    let row = [];
    const buttons = [];

    const val25 = Number(balance) * 0.25;
    const txtVal25 = `${val25} (25%)`;
    const val50 = Number(balance) * 0.5;
    const txtVal50 = `${val50} (50%)`;
    const txtVal100 = `${balance-1} (100%)`;

    if (val25 > minCoinValue * 10 ) {
        row.push(Markup.callbackButton(txtVal25, `stv_${val25}`));
    }
    if (val50 > minCoinValue * 10 ) {
        row.push(Markup.callbackButton(txtVal50, `stv_${val50}`));
    }
    row.push(Markup.callbackButton(txtVal100, `stv_${balance-1}`));
    buttons.push(row);
    row = [];
    row.push(Markup.callbackButton(ctx.i18n.t('withdrawVlueManual'), `stv0`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    stakingMenuButtons,
    stakingValueButtons
};
