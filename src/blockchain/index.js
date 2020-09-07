/**
 * Module with Blockchain functions
 */
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const EventEmitter = require('events');

const { Binance, EtherPlatform, Bitcoin } = require('./../platforms');
const { coinFormat, calcFee, getFeeItem, getFeeByChat, getMinPotValue, getCoinPrice } = require('./utils');
const { formatUserName, formatUserMention } = require('./../utils');

class Blockchain extends EventEmitter {
    constructor(logger, debugMode, eventsHandler) {
        super();

        const data = fs.readFileSync(path.resolve(__dirname, 'coins.yaml'), 'utf8');
        this.coins = yaml.safeLoad(data);
        this.logger = logger;
        this.platformMap = new Map();

        /** Binance (BNB, TWT) **/
        const binance = new Binance(this.coins, logger, debugMode);
        binance.on('txError', eventsHandler.txError);
        binance.on('txSuccess', eventsHandler.txSuccess);
        this.platformMap.set('binance', binance);

        /** Ethereum (ETH, ETC, CLO) **/
        const ether = new EtherPlatform(this.coins, logger, debugMode);
        ether.on('txError', eventsHandler.txError);
        ether.on('txSuccess', eventsHandler.txSuccess);
        this.platformMap.set('ether', ether);

        /** Bitcoin (BTC, LTC) **/
        const bitcoin = new Bitcoin(this.coins, logger, debugMode, 'bitcoin');
        bitcoin.on('txError', eventsHandler.txError);
        bitcoin.on('txSuccess', eventsHandler.txSuccess);
        this.platformMap.set('bitcoin', bitcoin);

        const litecoin = new Bitcoin(this.coins, logger, debugMode, 'litecoin');
        litecoin.on('txError', eventsHandler.txError);
        litecoin.on('txSuccess', eventsHandler.txSuccess);
        this.platformMap.set('litecoin', litecoin);

        /** parent events **/
        this.on('txError', eventsHandler.txError);
        this.on('txSuccess', eventsHandler.txSuccess);
        this.on('txHangUp', eventsHandler.txHangUp);

        /** hang-up checking timer **/
        this.monitorMap = new Map();
        this.checkTxQuery = this.checkTxQuery.bind(this);
        setInterval(this.checkTxQuery, 3 * 60 * 1000);
    }

    async checkTxQuery() {
        const platforms = [ ...this.platformMap.values() ];
        for (let i = 0; i < platforms.length; i++) {
            const platform = platforms[i];
            const queries = platform.getTxQuery();

            for (let j = 0; j < queries.length; j++) {
                const txQuery = queries[j][1];
                const key = queries[j][0];
                // this.logger.debug('checkTxQuery %s', key);

                let globalCheckObj = this.monitorMap.get(key);
                const obj = txQuery.length ? txQuery[0] : {};

                if (globalCheckObj !== obj) {
                    globalCheckObj = obj;
                    this.monitorMap.set(key, globalCheckObj);
                } else {
                    this.emit('txHangUp', key);
                }
            }
        }
    }

    async getBalance(coinCode, address) {
        const coin = this.coins[coinCode];
        const platform = this.platformMap.get(coin.platform);
        return await platform.getBalance(coinCode, address);
    }

    async getFeeBalance(coinCode, address) {
        const coin = this.coins[coinCode];
        let feeCoinName;
        if (coin.tokenType === 'ERC20') {
            feeCoinName = 'ETH';
        } else if (coin.assetName) {
            feeCoinName = 'BNB';
        } else {
            feeCoinName = coinCode;
        }
        const balance = await this.getBalance(feeCoinName, address);
        return {balance: balance, feeCoin: feeCoinName};
    }

    getPlatforms() {
        return [...this.platformMap.keys()];
    }

    getCoins() {
        return this.coins;
    }

    registerWallet(platformName) {
        const platform = this.platformMap.get(platformName);
        return platform.registerWallet();
    }

    checkAddress(coinCode, address) {
        const coin = this.coins[coinCode];
        if (!coin) return false;
        const platform = this.platformMap.get(coin.platform);
        return platform.checkAddress(address);
    }

    getTxFee(coinCode) {
        const coin = this.coins[coinCode];
        const platform = this.platformMap.get(coin.platform);
        return platform.getTxFee(coinCode);
    }

    addMultiTxQuery(itemSrc, itemDestArray, ctx) {
        const coinCode = itemSrc.token;
        const coin = this.coins[coinCode];
        const platform = this.platformMap.get(coin.platform);
        const gas = itemSrc.gas;

        let txS = [];
        itemDestArray.forEach(destItem => {
            // ctx.logger.debug('addMultiTxQuery : %s', JSON.stringify(destItem));

            txS.push(this.prepareOneTx(itemSrc, destItem, ctx, coin, coinCode, gas));

            if (txS.length === 101) { // split by 100 addreess by TX ( for BNB and BTC based coins )
                platform.addTxToQuery(txS);
                txS = [];
            }
        });

        if (txS.length) platform.addTxToQuery(txS);
    }

    prepareOneTx(itemSrc, itemDest, ctx, coin, coinCode, gas) {
        const logger = this.logger;
        const txValue = itemDest.value;
        const srcObj = {
            name: formatUserName(itemSrc),
            mention: formatUserMention(itemSrc),
            address: itemSrc.wallet_address
                ? itemSrc.wallet_address
                : itemSrc[`${coin.platform}_wallet_address`],
            key: itemSrc.wallet_key
                ? itemSrc.wallet_key
                : itemSrc[`${coin.platform}_wallet_key`],
            id: itemSrc.user_id
        };

        const destObj = {
            name: formatUserName(itemDest),
            mention: formatUserMention(itemDest),
            address: itemDest.wallet_address
                ? itemDest.wallet_address
                : itemDest[`${coin.platform}_wallet_address`],
            id: itemDest.user_id ? itemDest.user_id : null,
            value: itemDest.value,
            txType: itemDest.txType,
            potUserId: itemDest.potUserId,
        };

        // const fee = ctx.session.txFee;
        // logger.debug('addTxToQuery: %s | fee: %s', txValue, fee);
        const tx = {
            value: txValue,
            gas: gas,
            coin: coin,
            token: coinCode
        };
        logger.debug('addTxToQuery: %s %s', txValue, coinCode);

        const postProcess = {
            chatId: ctx.chat ? ctx.chat.id : 0,
            msgId: (ctx.updateType === 'message')
                ? ctx.message.message_id
                : ctx.callbackQuery
                    ? ctx.callbackQuery.message.message_id
                    : 0,
            ctx: ctx
        };

        return {
            sourceItem: srcObj,
            destItem: destObj,
            tx: tx,
            postProcess: postProcess
        };
    }

    async getStaker(address) {
        const platform = this.platformMap.get('ether');
        return platform.getStaker(address);
    }

    async getStakeReward(address) {
        const platform = this.platformMap.get('ether');
        return platform.getStakeReward(address);
    }

    async isStakeActive(address) {
        const platform = this.platformMap.get('ether');
        return platform.isStakeActive(address);
    }

    startStake(user, value, ctx) {
        user.token = 'CLO';
        user.gas = 500000;

        const contractItem = {
            user_name: "csContract",
            wallet_address: this.coins['CLO'].csContract,
            value: value,
            txType: 7
        };
        const usersQueue = [];
        usersQueue.push(contractItem);
        return this.addMultiTxQuery(user, usersQueue, ctx);
    }

    async claimStake(user, ctx) {
        const platform = this.platformMap.get('ether');
        try {
            const txHash = await platform.claimStake(user.ether_wallet_address, user.wallet_key);
            this.emit('txSuccess', 8, user, 'CLO', ctx, txHash);
        } catch(e) {
            this.logger.error(e);
            this.emit('txError', 8, ctx.chat.id, ctx.callbackQuery.message.message_id, e);
        }
    }

    async withdrawStake(user, ctx) {
        const platform = this.platformMap.get('ether');
        try {
            const txHash = await platform.withdrawStake(user.ether_wallet_address, user.wallet_key);
            this.emit('txSuccess', 9, user, 'CLO', ctx, txHash);
        } catch(e) {
            this.logger.error(e);
            this.emit('txError', 9, ctx.chat.id, ctx.callbackQuery.message.message_id, e);
        }
    }
}

module.exports = {
    coinFormat,
    calcFee,
    getFeeItem,
    getFeeByChat,
    getMinPotValue,
    getCoinPrice,
    Blockchain
};
