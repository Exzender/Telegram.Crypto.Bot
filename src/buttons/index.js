const { settingsButtons } = require('./settings');
const { mainMenuButtons } = require('./main');
const { stakingMenuButtons, stakingValueButtons } = require('./staking');
const { withdrawAddressButtons, withdrawValueButtons, confirmButtons } = require('./withdraw');
const { languageButtons } = require('./language');
const { coinsButtons } = require('./coins');
const { giveButtons } = require('./giveaway');
const { lotteryButtons } = require('./lottery');
const { securityButtons } = require('./security');
const { walletMenuButtons } = require('./wallet');
const { infoMenuButtons, getInfoMenuButtons } = require('./inform');
const { projectsButtons } = require('./projects');
const { donateValueButtons } = require('./donate');

module.exports = {
    settingsButtons,
    mainMenuButtons,
    stakingMenuButtons,
    languageButtons,
    coinsButtons,
    withdrawAddressButtons,
    withdrawValueButtons,
    confirmButtons,
    stakingValueButtons,
    giveButtons,
    lotteryButtons,
    securityButtons,
    walletMenuButtons,
    infoMenuButtons,
    projectsButtons,
    getInfoMenuButtons,
    donateValueButtons
};
