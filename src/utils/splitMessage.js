const Extra = require('telegraf/extra');
const { sleep } = require('./sleeper');

async function splitLongMessage(aLongMsg, aNewMsg, ctx) {
    let replyMessage = aLongMsg;
    const longMsg = replyMessage + aNewMsg + '\n';
    let msgId;
    if (longMsg.length > 4096) {
        msgId = await ctx.replyWithHTML(replyMessage, Extra.webPreview(false));
        ctx.logger.debug(replyMessage);
        await sleep(5000);
        replyMessage = ''  + aNewMsg + '\n';
    } else {
        replyMessage += aNewMsg + '\n';
    }
    return { replyMessage, msgId };
}

module.exports = {
    splitLongMessage
};
