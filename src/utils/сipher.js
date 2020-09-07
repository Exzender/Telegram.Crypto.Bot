const crypto = require('crypto');
const algorithm = 'aes-256-cbc';

function getIv(password) {
    return Buffer.from(crypto.createHash('sha256').update(String(password)).digest('hex').substr(0, 32), 'hex');
}

function getKey(password) {
    return crypto.createHash('sha256').update(String(password)).digest('base64').substr(0, 32);
}

function encryptAsync(data, password) {
    const key = getKey(password);
    const iv = getIv(password);
    // console.log('key: ', key);

    return new Promise((resolve, reject) => {
        try {
            const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
            let encrypted = cipher.update(data);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            resolve(encrypted.toString('hex'));
        } catch (exception) {
            reject(exception);
        }
    });
}

function decryptAsync(data, password) {

    // console.log('decryptAsync', data, password);

    const key = getKey(password);
    const iv = getIv(password);
    const encryptedText = Buffer.from(data, 'hex');

    return new Promise((resolve, reject) => {
        try {
            const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            resolve(decrypted.toString());
        } catch (exception) {
            reject(exception);
        }
    });
}

module.exports = {
    encryptAsync,
    decryptAsync
}
