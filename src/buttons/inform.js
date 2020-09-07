const Markup = require("telegraf/markup");

const infoButtonsList = ["helpButton", "partnersButton", "earnCloButton", "contactButton", "mainMenuButton"];

const getInfoMenuButtons = (ctx) => {
    const list = [];
    for (let i = 0; i < infoButtonsList.length; i++) {
        list.push(ctx.i18n.t(infoButtonsList[i]));
    }
    return list;
}

const infoMenuButtons = (ctx) => {
    const buttons = [];
    let cnt = 0;
    let row = [];

    const list = getInfoMenuButtons(ctx);

    for (let i = 0; i < list.length; i++) {
        cnt++;
        row.push(list[i]);
        if (cnt === 2) {
            cnt = 0;
            buttons.push(row);
            row = [];
        }
    }
    if (row.length) buttons.push(row);

    return Markup.keyboard(buttons).resize();
};

module.exports = {
    infoMenuButtons,
    getInfoMenuButtons
};
