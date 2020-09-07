const Markup = require("telegraf/markup");

const walletMenuButtons = (ctx) => {
    const buttons = [];

    buttons.push(
        [ctx.i18n.t("balanceButton"), ctx.i18n.t("coldStakingButton")],
        [ctx.i18n.t("depositButton"), ctx.i18n.t("withdrawButton")],
        [ctx.i18n.t("mainMenuButton")]
    );

    return Markup.keyboard(buttons).resize();
};

module.exports = {
    walletMenuButtons
};
