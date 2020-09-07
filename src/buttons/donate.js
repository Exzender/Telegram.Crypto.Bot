const Markup = require('telegraf/markup');

const donateValueButtons = (ctx, balance, minVal, token) => {
    ctx.logger.debug('generateDonateValueMessage');

    let row = [];
    const buttons = [];

    const val10 = minVal * 10;
    const val50 = minVal * 50;
    const val100 = minVal * 100;
    const val500 = minVal * 500;

    if (balance > val10) {
        row.push(Markup.callbackButton(`${val10} ${token}`, `dnv_${val10}`));
    }
    if (balance > val50) {
        row.push(Markup.callbackButton(`${val50} ${token}`, `dnv_${val50}`));
    }
    if (balance > val100) {
        row.push(Markup.callbackButton(`${val100} ${token}`, `dnv_${val100}`));
    }
    if (balance > val500) {
        row.push(Markup.callbackButton(`${val500} ${token}`, `dnv_${val500}`));
    }
    if (!row.length) row.push(Markup.callbackButton(`${minVal} ${token}`, `dnv_${minVal}`));

    buttons.push(row);
    row = [];
    row.push(Markup.callbackButton(ctx.i18n.t('withdrawVlueManual'), `dnv0`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    donateValueButtons
};
