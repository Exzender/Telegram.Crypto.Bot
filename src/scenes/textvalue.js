const enterTVScene = () => async (ctx) => {
    ctx.logger.debug('entering text value scene');
    const text = `${ctx.i18n.t(ctx.session.textValueCaption)}`;
    return ctx.replyWithHTML(text);
};

const leaveTVScene = () => (ctx) => {
    ctx.logger.debug('leaving text value scene');
};

const onTextTVScene = () => async (ctx) => {
    const text = ctx.message.text;
    let doSave = true;
    if (ctx.session.textValueCheckFunc) {
        const repText = await ctx.cmds[ctx.session.textValueCheckFunc](ctx, text);
        ctx.logger.debug('repText in check text value: %s', repText);
        if (repText) { // requery text value
            const text = `${repText}`;
            ctx.replyWithHTML(text).then();
            doSave = false;
        }
    }
    if (doSave) ctx.cmds[ctx.session.textValueCbFunc](ctx, text);
    return ctx.scene.leave();
};

const onMessageTVScene = () => (ctx) => {
    return ctx.scene.leave();
};

module.exports = {
    enterTVScene,
    leaveTVScene,
    onTextTVScene,
    onMessageTVScene
};

