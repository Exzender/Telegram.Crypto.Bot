const crypto = require('crypto');

function getRandomInt(aMin, aMax) {
    return Math.floor(Math.random() * (aMax - aMin + 1)) + aMin;
}

function getCryptoRandomInt(aMin, aMax) {
    let buf;
    let mult;
    let rnd;
    if (aMax > 255) {
        mult = 65535 / aMax;
        buf = crypto.randomBytes(2);
        rnd = buf.readUIntBE(0,2);
    } else {
        mult = 255 / aMax;
        buf = crypto.randomBytes(1);
        rnd = buf.readUIntBE(0,1);
    }
    console.log('crypto random: ' + rnd);
    return Math.floor(rnd / mult) + aMin;
}

module.exports = {
    getRandomInt,
    getCryptoRandomInt
};
