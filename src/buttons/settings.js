const Markup = require('telegraf/markup');

const settingsButtons = (ctx) => {
    const buttons = [];
    buttons.push([
        ctx.i18n.t('twitterButton'),
        ctx.i18n.t('languageButton')],[
        ctx.i18n.t('defaultValue'),
        ctx.i18n.t('historyButton')],[
        ctx.i18n.t('mainMenuButton'),
        ctx.i18n.t('securityButton')
    ]);
    return Markup.keyboard(buttons).resize();
};

module.exports = {
    settingsButtons
};
