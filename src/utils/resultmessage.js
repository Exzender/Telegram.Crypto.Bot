const Extra = require("telegraf/extra");

function resultMessage(ctx, msgTemplate, paramsObj) {
    let msg = ctx.i18n.t(msgTemplate, paramsObj);
    if (ctx.globalOpts.messageFooter) msg += "\n" + ctx.i18n.t("messageFooter", {botName: ctx.botName});
    ctx.replyWithHTML(msg, Extra.webPreview(false)).catch((e) => ctx.logger.error(e.stack));
}

module.exports = {
    resultMessage
};
