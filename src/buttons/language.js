const Markup = require('telegraf/markup');
const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

// load flags
let data = fs.readFileSync(path.resolve(__dirname, 'lng_flags.yaml'), 'utf8');
const flags = yaml.safeLoad(data);
data = fs.readFileSync(path.resolve(__dirname, 'lng_names.yaml'), 'utf8');
const lng_names = yaml.safeLoad(data);

const languageButtons = (ctx) => {
    const buttons = [];
    ctx.logger.debug('languageButtons');
    ctx.logger.info(ctx.locales);
    let cnt = 0;
    let row = [];
    ctx.locales.forEach( item => {
        cnt ++;
        row.push(Markup.callbackButton(`${flags[item]} ${lng_names[item]}`, `lang_${item}`));
        if (cnt === 2) {
            cnt = 0;
            buttons.push(row);
            row = [];
        }
    });
    buttons.push(row);
    return Markup.inlineKeyboard(buttons);
};

module.exports = {
    languageButtons
};
