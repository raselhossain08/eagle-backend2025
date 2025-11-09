/**
 * Rate Limiting Middleware for Subscription Management
 * Prevents API abuse and protects against DDoS attacks
 * Uses express-rate-limit with different limits for different operations
 */

const rateLimit = require('express-rate-limit');

/**
 * General subscription operations rate limiter
 * Allows 100 requests per 15 minutes per IP
 * Used for: GET, LIST, SEARCH operations
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Skip rate limiting for certain IPs (e.g., internal services)
    skip: (req) => {
        const trustedIPs = ['127.0.0.1', '::1']; // localhost
        return trustedIPs.includes(req.ip);
    }
});

/**
 * Mutation operations rate limiter (stricter)
 * Allows 30 requests per 15 minutes per IP
 * Used for: CREATE, UPDATE, DELETE operations
 */
const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // Limit each IP to 30 requests per windowMs
    message: {
        success: false,
        message: 'Too many modification requests, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    skip: (req) => {
        const trustedIPs = ['127.0.0.1', '::1'];
        return trustedIPs.includes(req.ip);
    }
});

/**
 * Critical operations rate limiter (most strict)
 * Allows 10 requests per 15 minutes per IP
 * Used for: CANCEL, DELETE, SUSPEND operations
 */
const criticalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        success: false,
        message: 'Too many critical operations, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    skip: (req) => {
        const trustedIPs = ['127.0.0.1', '::1'];
        return trustedIPs.includes(req.ip);
    },
    // Store rate limit data
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many critical operations attempted. Please wait before trying again.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60) + ' minutes'
        });
    }
});

/**
 * Bulk operations rate limiter (very strict)
 * Allows 5 requests per 30 minutes per IP
 * Used for: BULK operations, SAMPLE DATA creation
 */
const bulkOperationLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Too many bulk operations, please try again after 30 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    skip: (req) => {
        const trustedIPs = ['127.0.0.1', '::1'];
        return trustedIPs.includes(req.ip);
    },
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Bulk operations are rate-limited. Please wait before creating more sample data.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60) + ' minutes'
        });
    }
});

/**
 * Analytics operations rate limiter
 * Allows 50 requests per 15 minutes per IP
 * Used for: ANALYTICS, STATS, REPORTS
 */
const analyticsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 requests per windowMs
    message: {
        success: false,
        message: 'Too many analytics requests, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false
});

module.exports = {
    generalLimiter,
    mutationLimiter,
    criticalLimiter,
    bulkOperationLimiter,
    analyticsLimiter
};
