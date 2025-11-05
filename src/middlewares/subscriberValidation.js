const { body } = require('express-validator');

// Minimal validation middleware stubs for subscriber routes

const createSubscriberValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('subscription').optional().isIn(['None', 'Basic', 'Diamond', 'Infinity', 'Script']).withMessage('Invalid subscription')
];

const updateSubscriberValidation = [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('firstName').optional().isString().trim(),
    body('lastName').optional().isString().trim(),
    body('subscription').optional().isIn(['None', 'Basic', 'Diamond', 'Infinity', 'Script']).withMessage('Invalid subscription')
];

const bulkUpdateValidation = [
    body('subscriberIds').isArray({ min: 1 }).withMessage('subscriberIds must be a non-empty array'),
    body('action').isIn(['activate', 'deactivate', 'updatePlan', 'delete']).withMessage('Invalid bulk action')
];

module.exports = {
    createSubscriberValidation,
    updateSubscriberValidation,
    bulkUpdateValidation
};
