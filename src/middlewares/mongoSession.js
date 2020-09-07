const TelegrafMongoSession = require('telegraf-session-mongodb').TelegrafMongoSession;

class TelegrafMongoSessionExt extends TelegrafMongoSession {
    getSessionKey(ctx) {
        const { chat, callbackQuery, from } = ctx;

        if (chat && chat.type === 'channel' && !from) {
            return `ch:${chat.id}`;
        }

        const id = chat ? chat.id : (callbackQuery ? callbackQuery.chat_instance : from ? from.id : 0);
        return `${id}:${id}`;
    }

    instSaveSession(ctx) {
        const key = this.getSessionKey(ctx);
        // console.log('instSaveSession %s %s', key, ctx.session);
        this.saveSession(key, ctx.session || {}).then();
    }
}

exports.TelegrafMongoSessionExt = TelegrafMongoSessionExt;
