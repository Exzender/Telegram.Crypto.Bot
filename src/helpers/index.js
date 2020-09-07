const inspect = require('util').inspect;
const logger = require('./logger');

const debug = function(data) {
    logger.debug(inspect(data, {
        showHidden: true,
        colors: true,
        depth: 10,
    }));
};

module.exports = {
    debug,
    logger
};
