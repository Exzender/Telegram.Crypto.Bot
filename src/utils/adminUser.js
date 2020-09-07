async function isChatAdmin(ctx) {
    if (ctx.chat.type === 'channel') {
        return true;
    }
    const chatMember = await ctx.getChatMember(ctx.from.id);
    if (chatMember) {
        ctx.logger.debug('isChatAdmin %s', chatMember.status);
        return (['creator', 'administrator'].includes(chatMember.status));
    } else {
        return false;
    }
}

function isBotAdmin(ctx) {
    if (ctx.chat.type === 'channel') {
        return false;
    }
    return (ctx.admins.includes(ctx.from.username));
}

module.exports = {
    isChatAdmin,
    isBotAdmin
};
