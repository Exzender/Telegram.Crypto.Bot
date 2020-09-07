const { Blockbook } = require('blockbook-client');
const btcClient = require('bitcoinjs-lib');
const EventEmitter = require('events');
const coinSelect = require('coinselect');
const coininfo = require('coininfo');
const rp = require('request-promise');
const satoshi = 100000000;
const defaultTxWeight = 160;

function getNetwork(platform) {
    const curr = coininfo[platform].main;    //.main;  // .test - for Test network
    const frmt = curr.toBitcoinJS();
    return {
        messagePrefix: '\x19' + frmt.name + ' Signed Message:\n',
        bech32: frmt.bech32,
        bip32: {
            public: frmt.bip32.public,
            private: frmt.bip32.private
        },
        pubKeyHash: frmt.pubKeyHash,
        scriptHash: frmt.scriptHash,
        wif: frmt.wif
    }
}

class Bitcoin extends EventEmitter {
    constructor(coins, logger, debugMode, platform) {
        super();
        this.txQuery = [];
        this.btcClient = btcClient;
        this.logger = logger;
        this.debugMode = debugMode;
        this.coins = {};
        this.sendTxByInterval = this.sendTxByInterval.bind(this);
        Object.entries(coins).map(obj => {
            const key = obj[0];
            const value = obj[1];
            if (value.platform === platform) {
                this.coins[key] = value;
                this.txInterval = value.txInterval;
                this.blockbook = new Blockbook({
                    nodes: [value.RPC],
                    disableTypeValidation: true,
                });
                this.network = getNetwork(platform);
            }
        });
        this.sendTxByInterval().then();
        this.coinFormat = require('./../blockchain').coinFormat;
    }
}

module.exports = {
    Bitcoin
};
