function isPrivateChat(ctx) {
    return (ctx.chat.type === 'private');
}

module.exports = {
    isPrivateChat
};