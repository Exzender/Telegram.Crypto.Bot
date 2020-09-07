const winston = require('winston');

/**
 * Init Winston logger
 */
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'DD.MM.YYYY HH:mm:ss'
        }),
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.printf(info => `[${info.timestamp}][${info.level}] ${info.message}`) // ${rest(info)}`)
    ),
    transports: [
        new winston.transports.File({ filename: 'cryptpBot_errors.log', level: 'error' }),
        new winston.transports.File({ filename: 'cryptpBot_info.log', level: 'verbose' }),
        new winston.transports.Console({level: 'debug'})
    ]
    // exceptionHandlers: [
    //     new winston.transports.File({ filename: 'exceptions.log' })
    // ]
});

// if (process.env.NODE_ENV !== 'production') {
//     logger.add();
// }

module.exports = logger;