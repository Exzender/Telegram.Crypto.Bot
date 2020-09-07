const Web3 = require('web3');
const FileSystem = require('fs');
const path = require('path');
const EventEmitter = require('events');
const ERC20Contract = require('erc20-contract-js');

const coinGas = 21000;
const tokenGas = 150000; // 60000 for some tokens
const tokenMaxGas = 250000; // 60000 for some tokens

class EtherPlatform extends EventEmitter {
    constructor(coins, logger, debugMode) {
        super();
        this.txQueryMap = new Map();
        this.txNonceMap = new Map();
        this.rpcMap = new Map();
        this.erc20Map = new Map();
        this.logger = logger;
        this.debugMode = debugMode;
        this.coins = {};
        this.sendTxByInterval = this.sendTxByInterval.bind(this);
        Object.entries(coins).map(obj => {
            const key   = obj[0];
            const value = obj[1];
            if (value.platform === 'ether') {
                this.coins[key] = value;
                const txQuery = [];
                this.txQueryMap.set(key, txQuery);
                const nonceMap = new Map();
                this.txNonceMap.set(key, nonceMap);
                const web = new Web3(this.coins[key].RPC);
                this.rpcMap.set(key, web);
                if (key === 'CLO') {
                    const csContractAbi = JSON.parse(FileSystem.readFileSync(path.resolve(__dirname, 'cs_user.abi'), 'utf-8'));
                    this.csContract = new web.eth.Contract(csContractAbi, this.coins['CLO'].csContract);
                }
                if (value.tokenType === 'ERC20') {
                    logger.debug('erc20 %s', value.tokenContract);
                    const ercContract = new ERC20Contract(web, value.tokenContract);
                    this.erc20Map.set(key, ercContract);
                }
                this.sendTxByInterval(key).then();
            }
        });
        this.coinFormat = require('./../blockchain').coinFormat;
    }

}

exports.EtherPlatform = EtherPlatform;
