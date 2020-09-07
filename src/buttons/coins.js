const Markup = require("telegraf/markup");

const coinsButtons = (ctx, coins, prefix, all) => {
    const buttons = [];
    // ctx.logger.debug("coinsButtons");
    let cnt = 0;
    let row = [];
    const keys = Object.keys(coins);
    for (const key of keys) {
        cnt++;
        row.push(Markup.callbackButton(`${key}`, `${prefix}_${key}`));
        if (cnt === 3) {
            cnt = 0;
            buttons.push(row);
            row = [];
        }
    }
    buttons.push(row);
    if (all) {
        row = [];
        row.push(Markup.callbackButton(all, `${prefix}_ALL`));
        buttons.push(row);
    }
    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    coinsButtons,
};
