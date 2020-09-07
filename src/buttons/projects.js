const Markup = require("telegraf/markup");

const projectsButtons = (ctx, coins) => {
    const buttons = [];
    let cnt = 0;
    let row = [];
    const keys = Object.keys(coins);
    for (const key of keys) {
        cnt++;
        const coin = coins[key];
        row.push(Markup.callbackButton(`${coin.fullName}`, `prj_${key}`));
        if (cnt === 2) {
            cnt = 0;
            buttons.push(row);
            row = [];
        }
    }
    buttons.push(row);
    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    projectsButtons,
};
