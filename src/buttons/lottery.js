const Markup = require('telegraf/markup');

const lotteryButtons = (ctx, token) => {
    const buttons = [];
    let row = [];

    row.push(Markup.callbackButton(ctx.i18n.t('ticketBtn'), `pot_1_${token}`));
    // row.push(Markup.callbackButton(ctx.i18n.t('ticket3Btn'), `pot_3_${token}`));
    row.push(Markup.callbackButton(ctx.i18n.t('ticket10Btn'), `pot_10_${token}`));
    buttons.push(row);
    row = [];
    row.push(Markup.callbackButton(ctx.i18n.t('ticket50Btn'), `pot_50_${token}`));
    // row.push(Markup.callbackButton(ctx.i18n.t('ticket3Btn'), `pot_3_${token}`));
    row.push(Markup.callbackButton(ctx.i18n.t('ticket100Btn'), `pot_100_${token}`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    lotteryButtons
};
