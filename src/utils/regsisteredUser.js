const { isPrivateChat } = require("./privateChat");
const Extra = require("telegraf/extra");

async function isUserRegistered(ctx, userId, replyNotExists = false) {
    ctx.logger.debug("isUserRegistered = Finding by UserId %s", userId);
    const user = await ctx.database.getUser(userId);
    if (user) {
        // check if user changed name
        if (ctx.from.id === userId) {
            let compareOk = true;
            let updateFields = {};
            const from = ctx.from;
            if (user.user_name !== from.username && (from.username || user.user_name)) {
                ctx.logger.debug("username %s %s", user.user_name, from.username);
                compareOk = false;
                updateFields.user_name = from.username;
                user.user_name = from.username;
            }
            if (user.user_first_name !== from.first_name && (from.first_name || user.user_first_name)) {
                ctx.logger.debug("first_name %s %s", user.user_first_name, from.first_name);
                compareOk = false;
                updateFields.user_first_name = from.first_name;
                user.user_first_name = from.first_name;
            }
            if (user.user_last_name !== from.last_name && (from.last_name || user.user_last_name)) {
                ctx.logger.debug("last_name %s %s", user.user_last_name, from.last_name);
                compareOk = false;
                updateFields.user_last_name = from.last_name;
                user.user_last_name = from.last_name;
            }
            if (!compareOk) {
                ctx.logger.debug("updating user info %s", userId);
                ctx.database.updateUser(userId, updateFields);
            }
        }
        if (isPrivateChat(ctx)) {
            if (user.inactive && user.inactive !== "blacklist") {
                ctx.database.setActiveUser(user.user_id);
            }
        }
    } else {
        if (replyNotExists) {
            ctx.logger.info("isUserRegistered = user not exists: %s", userId);

            if (isPrivateChat(ctx)) {
                ctx.replyWithHTML(ctx.i18n.t("userNotExists")).then();
            } else {
                const msgId = ctx.message ? ctx.message.message_id : 0;
                ctx.replyWithHTML(
                    ctx.i18n.t("pleaseRegister", { botName: `@${ctx.botName}` }),
                    Extra.inReplyTo(msgId))
                    .then((msg) => markForDelete(ctx, msg));
            }

            return null;
        }
    }
    return user;
}

function markForDelete(ctx, msg, interval) {
    const toDelete = ctx.chatsMap.has(ctx.chat.id)
        ? ctx.chatsMap.get(ctx.chat.id).delete_reply
        : ctx.globalOpts.deleteMessages;
    if (toDelete) {
        const timeout = interval || ctx.globalOpts.deleteInterval;
        setTimeout(deleteBotMessage, timeout, ctx, msg);
    }
}

function deleteBotMessage(ctx, msg) {
    ctx.telegram.deleteMessage(msg.chat.id, msg.message_id).catch(function (Error) {
        ctx.logger.error(Error);
    });
}

module.exports = {
    isUserRegistered,
    markForDelete,
    deleteBotMessage,
};
