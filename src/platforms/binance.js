const BnbApiClient = require('@binance-chain/javascript-sdk');
const EventEmitter = require('events');

class Binance extends EventEmitter {
    constructor(coins, logger, debugMode) {
        super();
        this.logger = logger;
        this.debugMode = debugMode;
        this.coins = {};
        this.txQuery = [];
        this.sendTxByInterval = this.sendTxByInterval.bind(this);
        Object.entries(coins).map(obj => {
            const key = obj[0];
            const value = obj[1];
            if (value.platform === 'binance') {
                this.coins[key] = value;
            }
        });
        this.sendTxByInterval().then();
        this.bnbClient = new BnbApiClient(this.coins['BNB'].RPC);
        this.bnbClient.chooseNetwork("mainnet");
        this.bnbClient.initChain();
        this.coinFormat = require('./../blockchain').coinFormat;
    }
}

module.exports = {
    Binance
};

