const Telegraf = require('telegraf');
const I18n = require('telegraf-i18n');
const Stage = require('telegraf/stage');
const Scene = require('telegraf/scenes/base');
const match = I18n.match;

/**
 * modules
 */
const DbClient = require('./database');
const { logger } = require('./helpers');
const { TwObject } = require('./twitter');
const { mongoSessionMiddleware } = require('./middlewares');
const commandParts = require('./middlewares/commandParts');
const { botInfo } = require('./utils');
const Commands = require('./commands');
const Actions = require('./actions');
const Scenes = require('./scenes');
const { Blockchain } = require('./blockchain');
const { EventsHandler } = require('./handlers');

/** globals */
const botConfig = require('./config.json');
const textValueScene = new Scene('callBackFunc');
const giveawayScene = new Scene('giveaway');
const oneHourMs = 60 * 60 * 1000;
let storedSession;

/**
 * i18n translation middelware init
 */
const i18n = new I18n(botConfig.i18n);
i18n.templateData = { pluralize: I18n.pluralize };

/**
 * Bot init
 */
const botOptions = {
    channelMode: true
};
const bot = new Telegraf(process.env.BOT_TOKEN, botOptions);
const stage = new Stage([textValueScene, giveawayScene]);

/**
 * Middlewares
 */
bot.use( (...args) => storedSession.middleware(...args) );
bot.use( i18n.middleware() );
bot.use(commandParts());
bot.use(stage.middleware());

/**
 * Mongo DB init
 */
bot.context.i18 = i18n;
bot.context.tg = bot.telegram;
bot.context.restartTimeOut = true;
bot.context.database = new DbClient(logger);
bot.context.database.connect(botConfig.mongo.db)
    .then(function(db) {
        storedSession = new mongoSessionMiddleware(db, botConfig.TelegrafSession);
        bot.context.mongoSession = storedSession;
        bot.context.database.getChats()
            .then(chats => {
                const chatsMap = new Map();
                chats.forEach(chat => chatsMap.set(chat.chat_id, chat));
                bot.context.chatsMap = chatsMap;
                Commands.calcPotTimerStart(bot.context);
                Commands.calcLotteryTimerStart(bot.context);
                Commands.calcCheckMembersTimerStart(bot.context);
            })
            .catch(e => logger.error(e));
        bot.telegram.sendMessage(botConfig.devFee.devChat, 'Bot (re)started!').then();
        setTimeout(finishedRestart, 10000);
        Commands.checkReteweetTimer(bot.context);
        setTimeout(onPasswordsTimer, 1000 * 120, bot.context.passwords);
        setTimeout(startBotPolling, 5000);
    });

/**
 * Blockchain init
 */
const eventsHandler = new EventsHandler(bot, i18n);
bot.context.blockchain = new Blockchain(logger, botConfig.global.debugMode, eventsHandler);

/**
 * Twitter Object init
 */
const twitter = new TwObject(eventsHandler);
bot.context.twitter = twitter;

/** Set bot globals */
bot.context.logger = logger;
bot.context.locales = i18n.availableLocales();
bot.context.cmds = Commands; // dirty hack to bypass Functions through Mongo Session middleware
bot.context.devFee = botConfig.devFee;
bot.context.admins = botConfig.admins;
bot.context.globalOpts = botConfig.global;
bot.context.giveMap = new Map();
bot.context.rainMap = new Map();
bot.context.giveStateMap = new Map();
bot.context.twitterTimeoutHandle = new Map();
bot.context.passwords = new Map();

/** Get bot info on Start */
bot.telegram.getMe().then( me => {
    botInfo(me, bot.context);
    bot.options.username = me.username;
    bot.context.botName = me.username;
} );

/**
 * Private chat commands
 */
bot.start(Commands.startCommand());
bot.command('register', Commands.newUserCommand());
bot.hears(match('registerButton'), Commands.newUserCommand());
bot.hears(match('mainMenuButton'), Commands.mainMenuCommand());
bot.hears(match('settingsButton'), Commands.settingsCommand());
bot.hears(match('unlockButton'), Commands.unlockCommand());
bot.hears(match('walletButton'), Commands.walletCommand());
bot.hears(match('infoButton'), Commands.infoCommand());
bot.hears(match('donateButton'), Commands.donateCommand());
/** wallet commands */
bot.hears(match('balanceButton'), Commands.balanceCommand());
bot.hears(match('depositButton'), Commands.depositCommand());
bot.hears(match('withdrawButton'), Commands.withdrawCommand());
bot.hears(match('coldStakingButton'), Commands.stakingMenuCommand());
/** info commands */
bot.hears(match('partnersButton'), Commands.partnersCommand());
bot.hears(match('contactButton'), Commands.contactCommand());
bot.hears(match('helpButton'), Commands.helpCommand());
bot.hears(match('earnCloButton'), Commands.earnCloCommand());
/** config commands */
bot.hears(match('twitterButton'), Commands.setTwitterCommand());
bot.hears(match('languageButton'), Commands.setLanguageCommand());
bot.hears(match('historyButton'), Commands.displayHistoryCommand());
bot.hears(match('defaultValue'), Commands.setDefaultsCommand());
bot.hears(match('securityButton'), Commands.securityMenuCommand());
/** security commands */
bot.hears(match('pkButton'), Commands.displayPkCommand());
bot.hears(match('setPwdButton'), Commands.setPwdCommand());
bot.hears(match('changePwdButton'), Commands.changePwdCommand());
bot.hears(match('encryptButton'), Commands.encryptCommand());
/** staking commands */
bot.hears(match('statusButton'), Commands.getStakeStatusCommand());
bot.hears(match('startStkButton'), Commands.startStakeCommand());
bot.hears(match('claimStkButton'), Commands.claimStakeCommand());
bot.hears(match('withdrawStkButton'), Commands.withdrawStakeCommand());
/** admin commands */
bot.command('addcoin', Commands.newCoinCommand());
bot.command('import', Commands.importCommand());
bot.command('restart', Commands.restartCommand());
bot.command('stop', Commands.stopCommand());
bot.command('userinfo', Commands.userInfoCommand());
bot.command('msgallchats', Commands.messageChatsCommand());
bot.command('msgallusers', Commands.messageUsersCommand());
bot.command('msgadmins', Commands.messageAdminsCommand());
bot.command('chatlist', Commands.chatListCommand());
bot.command('message', Commands.messageCommand());
bot.command('checkmembers', Commands.checkMembersCommand());
bot.command('lottery', Commands.startLotteryCommand());
bot.command('startcount', Commands.countStartCommand());
bot.command('checkmembersg', Commands.checkMembersGlobalCommand());
/** monitor users */
bot.on('new_chat_members', Commands.newChatMember());
bot.on('left_chat_member', Commands.leftChatMember());

/**
 * Private chat actions
 */
bot.action(/lang_[a-z]{2}/g, Actions.selectLanguageAction());
bot.action(/dep_([A-Z]\w+)/g, Actions.showDepositAction());
bot.action(/prk_[A-Z]\w+/g, Actions.showPkAction());
bot.action(/dfv_[A-Z]\w+/g, Actions.showDefaultsAction());
bot.action(/bal_[A-Z]\w+/g, Actions.showBalanceAction());
bot.action(/prj_([A-Z]\w+)/g, Actions.showInfoAction());
bot.action('pwd_yes', Actions.passwordConfirmAction());
bot.action('pwd_cancel', Actions.withdrawCancelAction());
bot.action('enc_yes', Actions.encryptConfirmAction());
bot.action('enc_cancel', Actions.withdrawCancelAction());
/** donate actions */
bot.action(/dnt_([A-Z]\w+)/g, Actions.showDonateValueAction());
bot.action('dnv0', Actions.inputDonateValueAction());
bot.action(/dnv_([\d]+[.,]*[\d]*)/g, Actions.donateConfirmAction());
/** withdraw actions */
bot.action(/wdr_[A-Z]\w+/g, Actions.showWithdrawAction());
bot.action(/wdrad_[a-zA-Z\d]\w+/g, Actions.showWithdrawValueAction());
bot.action('wdrad0', Actions.inputWithdrawAddressAction());
bot.action('wdv0', Actions.inputWithdrawValueAction());
bot.action(/wdv_[\d]+[.,]*[\d]*/g, Actions.showWithdrawConfirmAction());
bot.action('wdy_yes', Actions.withdrawConfirmAction());
bot.action('wdy_cancel', Actions.withdrawCancelAction());
/** stake actions */
bot.action('stv0', Actions.inputStakeValueAction());
bot.action(/stv_[\d]+[.,]*[\d]*/g, Actions.showStakeConfirmAction());
bot.action(/s[a-z]{2}_cancel/g, Actions.cancelAction());
bot.action('sss_yes', Actions.startStakeAction());
bot.action('sts_yes', Actions.stakeWarnConfirmAction());
bot.action('stc_yes', Actions.claimStakeAction());
bot.action('stw_yes', Actions.withdrawStakeAction());

/**
 * Group chat commands
 */
bot.command('test', Commands.testCommand());
bot.hears(/^\/\S*\s*/g, Commands.anyCommand());
bot.hears(/^[Cc]laim/g, Commands.selfKillCommand());
bot.hears(/^[Gg]rab/g, Commands.selfKillCommand());

/** beack message command */
bot.on("message", Commands.reportCommand());

/**
 * Group chat actions
 */
bot.action(/give_([\d]+)_([\d]+[.,]*[\d]*)_(\S*)_(\S*)/g, Actions.giveawayAction());
bot.action(/give_([\d]+)_cancel/g, Actions.cancelGiveAction());
bot.action(/pot_([\d]+)_(\S+)/g, Actions.makePotAction());

/**
 * Scenes actions
 */
/** textValue actions */
textValueScene.enter(Scenes.enterTVScene());
textValueScene.leave(Scenes.leaveTVScene());
textValueScene.on('text', Scenes.onTextTVScene());
textValueScene.on('message', Scenes.onMessageTVScene());

function onPasswordsTimer(passwords) {
    setTimeout(onPasswordsTimer, 1000 * 90, passwords);
    const time = new Date();
    for (const key of passwords.keys()) {
        const pwd = passwords.get(key);
        if ((time - oneHourMs) > pwd.time) {
            logger.debug('forgetting password for %s', key);
            passwords.delete(key);
        }
    }
}

function startBotPolling() {
    bot.startPolling();
}

function finishedRestart() {
    bot.context.restartTimeOut = false;
}

const logError = err => {
    logger.error(err.stack);
};

process.on('uncaughtException', logError);
process.on('warning', logError);
process.on('unhandledRejection', logError);
