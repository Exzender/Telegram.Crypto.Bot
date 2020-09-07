const Markup = require("telegraf/markup");

const giveButtons = (ctx, value, token, pass = '') => {
    const buttons = [];
    const row = [];

    const userId = ctx.from.id;
    row.push(Markup.callbackButton(ctx.i18n.t("claimBtn"), `give_${userId}_${value}_${token}_${pass}`));
    row.push(Markup.callbackButton(ctx.i18n.t("cancelBtn"), `give_${userId}_cancel`));
    buttons.push(row);

    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    giveButtons,
};
