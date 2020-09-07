const { decryptAsync } = require('./сipher');
const { markForDelete } = require("./regsisteredUser");

function checkPassword(ctx, user) {
    if (user.encrypted) {
        if (ctx.passwords.has(user.user_id)) {
            return ctx.passwords.get(user.user_id).pass;
        } else {
            ctx.replyWithHTML(ctx.i18n.t('walletLocked', {botName: ctx.botName}))
                .then((msg) => markForDelete(ctx, msg));
            return null;
        }
    } else return '';
}

async function getPrivateKey(ctx, user, coin, pwd) {
    const pass = pwd || checkPassword(ctx, user);

    // ctx.logger.debug('getPrivateKey pass %s', pass); // todo hide

    const value = user[`${coin.platform}_wallet_key`];

    if (pass === '') return value;

    if (pass) {
        try {
            return await decryptAsync(value, pass);
        } catch (e) {
            ctx.logger.error(e.stack);
            ctx.replyWithHTML(ctx.i18n.t('decryptError'));
            return null;
        }
    }

    return null;
}

async function getInPrivPrivateKey(ctx, user, coin) {
    let pass;
    if (user.encrypted) {
        if (ctx.passwords.has(user.user_id)) {
            pass = ctx.passwords.get(user.user_id).pass;
        } else {
            pass = ctx.session.password;
        }
        if (!pass) {
            ctx.replyWithHTML(ctx.i18n.t("walletLocked2"));
            return null;
        }
    }

    const value = user[`${coin.platform}_wallet_key`];

    // ctx.logger.debug('getInPrivPrivateKey %s %s', pass, value);

    if (pass) {
        try {
            return await decryptAsync(value, pass);
        } catch (e) {
            ctx.logger.error(e.stack);
            ctx.replyWithHTML(ctx.i18n.t('decryptError'));
            return null;
        }
    } else {
        return value;
    }
}

async function checkEncryptedPk(ctx, user, coin, pwd) {
    const key = await getPrivateKey(ctx, user, coin, pwd);

    // ctx.logger.debug('checkEncryptedPk PK: %s', key);  // todo hide

    if (key) {
        user.wallet_key = key;
        return true;
    } else return false;
}

function cleanPass(ctx) {
    ctx.session.password = null;
    ctx.mongoSession.instSaveSession(ctx);
}

module.exports = {
    checkEncryptedPk,
    checkPassword,
    getInPrivPrivateKey,
    cleanPass
};
