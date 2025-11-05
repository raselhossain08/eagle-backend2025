const winston = require('winston');
const path = require('path');

// Define log levels
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
};

// Define log colors
const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue'
};

// Add colors to winston
winston.addColors(logColors);

// Create log directory
const logDir = path.join(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

// Create console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
    })
);

// Create transports
const transports = [];

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            level: 'debug',
            format: consoleFormat
        })
    );
}

// File transport for all logs
transports.push(
    new winston.transports.File({
        filename: path.join(logDir, 'payment.log'),
        level: 'info',
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 10,
        tailable: true
    })
);

// Error log file
transports.push(
    new winston.transports.File({
        filename: path.join(logDir, 'payment-error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 10485760, // 10MB
        maxFiles: 5,
        tailable: true
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels: logLevels,
    format: logFormat,
    defaultMeta: {
        service: 'payment-service',
        module: 'payment'
    },
    transports,
    exitOnError: false
});

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logDir, 'payment-exceptions.log'),
        format: logFormat
    })
);

logger.rejections.handle(
    new winston.transports.File({
        filename: path.join(logDir, 'payment-rejections.log'),
        format: logFormat
    })
);

// Add request logging method
logger.logRequest = (req, res, duration) => {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user._id : null
    };

    const level = res.statusCode >= 400 ? 'error' : 'info';
    logger.log(level, `${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`, logData);
};

// Add payment specific logging methods
logger.logPayment = (action, data, metadata = {}) => {
    logger.info(`Payment ${action}`, {
        action,
        ...data,
        ...metadata,
        category: 'payment'
    });
};

logger.logPaymentError = (action, error, data = {}) => {
    logger.error(`Payment ${action} failed`, {
        action,
        error: error.message,
        stack: error.stack,
        ...data,
        category: 'payment-error'
    });
};

logger.logWebhook = (provider, event, data = {}) => {
    logger.info(`Webhook received from ${provider}`, {
        provider,
        event,
        ...data,
        category: 'webhook'
    });
};

logger.logIntegration = (provider, action, data = {}) => {
    logger.info(`Integration ${provider} - ${action}`, {
        provider,
        action,
        ...data,
        category: 'integration'
    });
};

// Performance logging
logger.logPerformance = (operation, duration, metadata = {}) => {
    const level = duration > 5000 ? 'warn' : 'info'; // Warn if operation takes more than 5 seconds
    logger.log(level, `Performance: ${operation} completed in ${duration}ms`, {
        operation,
        duration,
        ...metadata,
        category: 'performance'
    });
};

// Security logging
logger.logSecurity = (event, data = {}) => {
    logger.warn(`Security event: ${event}`, {
        event,
        ...data,
        category: 'security'
    });
};

module.exports = {
    logger,
    logLevels,
    logColors
};