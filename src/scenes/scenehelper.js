const startTextValueQuery = async ( ctx, caption, callBackFunc, checkValueFunc ) => {
    const session = ctx.session;
    session.textValueCaption = caption;
    session.textValueCbFunc = callBackFunc.name;
    session.textValueCheckFunc = checkValueFunc ? checkValueFunc.name : null;
    return ctx.scene.enter('callBackFunc');
};

module.exports = {
    startTextValueQuery
};
