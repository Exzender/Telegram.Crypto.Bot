const Markup = require('telegraf/markup');

const securityButtons = (ctx, isPwd, isEncryped) => {
    const buttons = [];
    let row = [];

    if (!isEncryped) {
        if (isPwd) row.push(ctx.i18n.t('changePwdButton'));
        else row.push(ctx.i18n.t('setPwdButton'));
    }

    if ((!isEncryped) && (isPwd))  row.push(ctx.i18n.t('encryptButton'));

    if (row.length) buttons.push(row);
    row = [];

    row.push(ctx.i18n.t('mainMenuButton'));
    if (isPwd || isEncryped) row.push(ctx.i18n.t('pkButton'));

    buttons.push(row);

    return Markup.keyboard(buttons).resize();
};

module.exports = {
    securityButtons
};
