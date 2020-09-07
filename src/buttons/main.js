const Markup = require("telegraf/markup");

const mainMenuButtons = (ctx, isRegistered) => {
    const buttons = [];

    if (!isRegistered) {
        buttons.push(
            [ctx.i18n.t("registerButton"), ctx.i18n.t("helpButton")]
        )
    } else {
        buttons.push(
            [ctx.i18n.t("walletButton"), ctx.i18n.t("infoButton")],
            [ctx.i18n.t("donateButton"), ctx.i18n.t("unlockButton")],
            [ctx.i18n.t("settingsButton")]
        );
    }

    return Markup.keyboard(buttons).resize();
};

module.exports = {
    mainMenuButtons
};
