const { isPrivateChat } = require('./privateChat');

async function checkChatMembers(ctx, chatRef) {
    const chats = chatRef ? [chatRef] : [...ctx.chatsMap.keys()];
    // const templ = [/([\s\S])*/i];

    const users = await ctx.database.findUsers("user_id", { $ne: null });

    ctx.logger.debug("checkChatMembers count: %s", users.length);

    let toDb = [];
    let cnt = 0;
    let ctr = 0;

    for (let i = 0; i < chats.length; i++) {
        const chatId = chats[i];
        await ctx.database.clearChatUsers(chatId);

        for (let j = 0; j < users.length; j++) {
            const userId = users[j].user_id;

            try {
                const tgUser = await ctx.telegram.getChatMember(chatId, userId);

                if (
                    tgUser &&
                    tgUser.status !== "left" && // (chatUser.status !== 'restricted') &&
                    tgUser.status !== "kicked"
                ) {
                    toDb.push({ chat_id: chatId, user_id: userId });
                    cnt++;

                    if (cnt === 100) {
                        ctx.database.insertChatUsers(toDb);
                        toDb = [];
                        if (isPrivateChat(ctx)) {
                            ctx.replyWithHTML(`Found ${cnt} users`).catch((e) =>
                                ctx.logger.error("TG error: %s", e.description)
                            );
                        } else {
                            ctx.logger.debug(`Found ${cnt} users`);
                        }
                        cnt = 0;
                    }
                }
            } catch (e) {
                if (killChat(ctx, chatId, e)) break;
            } finally {
                ctr++;
                if (ctr % 50 === 0) {
                    if (isPrivateChat(ctx)) {
                        ctx.replyWithHTML(`Parsed ${ctr} users. ChatID: ${chatId}`).catch((e) =>
                            ctx.logger.error("TG error: %s", e.description)
                        );
                    } else {
                        ctx.logger.debug(`Parsed ${ctr} users. ChatID: ${chatId}`);
                    }
                }
            }
        }

        if (toDb.length) {
            if (isPrivateChat(ctx)) {
                ctx.replyWithHTML(`ChatID: ${chatId} Written ${cnt}`).catch((e) =>
                    ctx.logger.error("TG error: %s", e.description)
                );
            } else {
                ctx.logger.debug(`ChatID: ${chatId} Written ${cnt}`);
            }
            ctx.database.insertChatUsers(toDb);
            toDb = [];
            cnt = 0;
        }
    }

    if (isPrivateChat(ctx)) {
        ctx.replyWithHTML(`Checked ${ctr} users`).catch((e) =>
            ctx.logger.error("TG error: %s", e.description)
        );
    }
}

function killChat(ctx, chatId, e) {
    const eStr = e.toString();
    if (eStr.indexOf("was kicked") !== -1 || eStr.indexOf("chat not found") !== -1) {
        if (ctx.chat) {
            if (isPrivateChat(ctx)) {
                ctx.replyWithHTML(`Wrong chat ${chatId}`).catch((e) =>
                    ctx.logger.error("TG error: %s", e.description)
                );
            }
        }
        ctx.database.deleteChat(chatId);
        ctx.chatsMap.delete(chatId);
        return true;
    } else return false;
}

async function checkChatMembersGlobal(ctx) {
    const chats =[...ctx.chatsMap.keys()];

    const users = await ctx.database.findUsers("user_id", { $ne: null });

    ctx.logger.debug("checkChatMembers count: %s", users.length);

    let toDb = [];
    let cntDel = 0;
    let cntAdd = 0;

    const telegram = ctx.telegram ? ctx.telegram : ctx.tg;

    for (let i = 0; i < chats.length; i++) {
        const chatId = chats[i];
        let cntU = 0;

        ctx.logger.debug('- = - check chat %s (%s)', ctx.chatsMap.get(chatId).title, chatId);

        for (let j = 0; j < users.length; j++) {
            const userId = users[j].user_id;

            const chatUser = await ctx.database.getChatUser(chatId, userId);
            // if (chatUser) ctx.logger.debug('chat user: %s', userId);
            try {
                let tgUser = await telegram.getChatMember(chatId, userId);

                if (tgUser &&
                    tgUser.status !== "left" && // (chatUser.status !== 'restricted') &&
                    tgUser.status !== "kicked"
                ) {
                    cntU++;
                    // ctx.logger.debug('tg user: %s %s', tgUser.user.id, tgUser.status);
                    if (!chatUser) {
                        toDb.push({chat_id: chatId, user_id: userId});
                        ctx.logger.debug('adding to chat %s user %s', chatId, userId);
                        cntAdd++;
                    } else {
                        // ctx.logger.debug('yes DB, yes TG');
                    }
                } else {
                    if (chatUser) {
                        ctx.database.deleteChatUser(chatId, userId);
                        ctx.logger.debug('removing in Try %s user %s', chatId, userId);
                        cntDel++;
                    } else {
                        // ctx.logger.debug('no DB, no TG');
                    }
                }
            } catch (e) {
                // ctx.logger.debug('TG error (userId: %s): %s',userId, e.description);
                // ctx.logger.debug('TG response: %s', e.response);
                if (killChat(ctx, chatId, e)) break;
                if (chatUser) {
                    ctx.database.deleteChatUser(chatId, userId);
                    ctx.logger.debug('removing in Error %s user %s', chatId, userId);
                    cntDel++;
                }
            }
        }

        ctx.logger.debug('- = - users in chat %s: %s', chatId, cntU);
        ctx.logger.debug('to insert: %s', toDb.length);

        if (toDb.length) await ctx.database.insertChatUsers(toDb); // what max lines caould be inserted ?
        toDb = [];
    }

    const msg = `Checked: ${users.length} users\nAdded: ${cntAdd}\nRemoved: ${cntDel}`;
    if (ctx.chat) {
        if (isPrivateChat(ctx)) {
            ctx.replyWithHTML(msg).catch((e) =>
                ctx.logger.error("TG error: %s", e.description)
            );
        }
    } else {
        ctx.logger.debug(msg);
    }
}

module.exports = {
    checkChatMembers,
    checkChatMembersGlobal
};
