module.exports = function(me, ctx) {
    ctx.logger.info('Bot started');
    ctx.logger.verbose('Hello! My name is %s!', me.first_name);
    ctx.logger.verbose(`My id is ${me.id}.`);
    ctx.logger.verbose(`And my username is @${me.username}.`);
    ctx.botUserName = me.username;
};
