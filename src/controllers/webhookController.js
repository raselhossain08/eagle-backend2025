const Webhook = require('../models/Webhook');
const WebhookDelivery = require('../models/WebhookDelivery');
const axios = require('axios');
const crypto = require('crypto');
const paymentTransactionService = require('../transaction/services/paymentTransaction.service');

// @desc    Get all webhooks
// @route   GET /api/webhooks
// @access  Private (Admin/Super Admin)
exports.getAllWebhooks = async (req, res) => {
    try {
        const webhooks = await Webhook.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 });

        // Sanitize webhooks (mask secrets)
        const sanitizedWebhooks = webhooks.map(webhook => webhook.sanitize());

        res.status(200).json({
            success: true,
            count: webhooks.length,
            data: sanitizedWebhooks
        });
    } catch (error) {
        console.error('Get webhooks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve webhooks',
            error: error.message
        });
    }
};

// @desc    Get single webhook
// @route   GET /api/webhooks/:id
// @access  Private (Admin/Super Admin)
exports.getWebhook = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        res.status(200).json({
            success: true,
            data: webhook.sanitize()
        });
    } catch (error) {
        console.error('Get webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve webhook',
            error: error.message
        });
    }
};

// @desc    Create new webhook
// @route   POST /api/webhooks
// @access  Private (Admin/Super Admin)
exports.createWebhook = async (req, res) => {
    try {
        const { name, url, events, retryPolicy, maxRetries, timeout, verifySsl, authHeaders } = req.body;

        // Validation
        if (!name || !url || !events || events.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide webhook name, URL, and at least one event'
            });
        }

        // Validate URL format
        if (!/^https?:\/\/.+/.test(url)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid HTTP/HTTPS URL'
            });
        }

        // Generate secret
        const secret = Webhook.generateSecret();

        // Create webhook
        const webhook = await Webhook.create({
            name,
            url,
            events,
            secret,
            retryPolicy: retryPolicy || 'exponential',
            maxRetries: maxRetries || 3,
            timeout: timeout || 30,
            verifySsl: verifySsl !== false,
            authHeaders: authHeaders || [],
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Webhook created successfully',
            data: webhook.sanitize()
        });
    } catch (error) {
        console.error('Create webhook error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create webhook',
            error: error.message
        });
    }
};

// @desc    Update webhook
// @route   PUT /api/webhooks/:id
// @access  Private (Admin/Super Admin)
exports.updateWebhook = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        const { name, url, events, enabled, retryPolicy, maxRetries, timeout, verifySsl, authHeaders } = req.body;

        // Update fields
        if (name !== undefined) webhook.name = name;
        if (url !== undefined) {
            if (!/^https?:\/\/.+/.test(url)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid HTTP/HTTPS URL'
                });
            }
            webhook.url = url;
        }
        if (events !== undefined) {
            if (events.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one event must be selected'
                });
            }
            webhook.events = events;
        }
        if (enabled !== undefined) {
            webhook.enabled = enabled;
            webhook.status = enabled ? 'active' : 'disabled';
        }
        if (retryPolicy !== undefined) webhook.retryPolicy = retryPolicy;
        if (maxRetries !== undefined) webhook.maxRetries = maxRetries;
        if (timeout !== undefined) webhook.timeout = timeout;
        if (verifySsl !== undefined) webhook.verifySsl = verifySsl;
        if (authHeaders !== undefined) webhook.authHeaders = authHeaders;

        webhook.updatedBy = req.user._id;

        await webhook.save();

        res.status(200).json({
            success: true,
            message: 'Webhook updated successfully',
            data: webhook.sanitize()
        });
    } catch (error) {
        console.error('Update webhook error:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: error.message
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update webhook',
            error: error.message
        });
    }
};

// @desc    Delete webhook
// @route   DELETE /api/webhooks/:id
// @access  Private (Admin/Super Admin)
exports.deleteWebhook = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        await webhook.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Webhook deleted successfully'
        });
    } catch (error) {
        console.error('Delete webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete webhook',
            error: error.message
        });
    }
};

// @desc    Regenerate webhook secret
// @route   POST /api/webhooks/:id/regenerate-secret
// @access  Private (Admin/Super Admin)
exports.regenerateSecret = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        webhook.secret = Webhook.generateSecret();
        webhook.updatedBy = req.user._id;
        await webhook.save();

        res.status(200).json({
            success: true,
            message: 'Webhook secret regenerated successfully',
            data: webhook.sanitize()
        });
    } catch (error) {
        console.error('Regenerate secret error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to regenerate secret',
            error: error.message
        });
    }
};

// @desc    Test webhook delivery
// @route   POST /api/webhooks/:id/test
// @access  Private (Admin/Super Admin)
exports.testWebhook = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        const { event, payload } = req.body;

        // Use provided event or first event in webhook's event list
        const testEvent = event || webhook.events[0];

        // Create test payload
        const testPayload = payload || {
            event: testEvent,
            data: {
                id: 'test_' + Date.now(),
                timestamp: new Date().toISOString(),
                test: true
            }
        };

        // Deliver webhook
        const result = await deliverWebhook(webhook, testEvent, testPayload, true);

        res.status(200).json({
            success: result.success,
            message: result.success ? 'Test webhook delivered successfully' : 'Test webhook delivery failed',
            data: {
                statusCode: result.statusCode,
                duration: result.duration,
                response: result.response,
                error: result.error
            }
        });
    } catch (error) {
        console.error('Test webhook error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to test webhook',
            error: error.message
        });
    }
};

// @desc    Get webhook deliveries
// @route   GET /api/webhooks/:id/deliveries
// @access  Private (Admin/Super Admin)
exports.getWebhookDeliveries = async (req, res) => {
    try {
        const webhook = await Webhook.findOne({
            _id: req.params.id,
            createdBy: req.user._id
        });

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook not found'
            });
        }

        const limit = parseInt(req.query.limit) || 10;
        const deliveries = await WebhookDelivery.getRecentDeliveries(webhook._id, limit);

        res.status(200).json({
            success: true,
            count: deliveries.length,
            data: deliveries
        });
    } catch (error) {
        console.error('Get deliveries error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve deliveries',
            error: error.message
        });
    }
};

// Helper function to deliver webhook
async function deliverWebhook(webhook, event, payload, isTest = false) {
    const startTime = Date.now();
    let attempt = 1;
    let lastError = null;

    while (attempt <= (isTest ? 1 : webhook.maxRetries)) {
        try {
            // Create signature
            const signature = createSignature(webhook.secret, payload);

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': signature,
                'X-Webhook-Event': event,
                'X-Webhook-Attempt': attempt.toString(),
                'User-Agent': 'Eagle-Webhook/1.0'
            };

            // Add custom auth headers
            if (webhook.authHeaders && webhook.authHeaders.length > 0) {
                webhook.authHeaders.forEach(header => {
                    headers[header.name] = header.value;
                });
            }

            // Make HTTP request
            const response = await axios.post(webhook.url, payload, {
                headers,
                timeout: webhook.timeout * 1000,
                validateStatus: () => true, // Accept all status codes
                httpsAgent: webhook.verifySsl ? undefined : new (require('https').Agent)({
                    rejectUnauthorized: false
                })
            });

            const duration = Date.now() - startTime;
            const success = response.status >= 200 && response.status < 300;

            // Log delivery
            if (!isTest) {
                await WebhookDelivery.create({
                    webhook: webhook._id,
                    event,
                    payload,
                    statusCode: response.status,
                    response: JSON.stringify(response.data).substring(0, 5000),
                    duration,
                    success,
                    attempt
                });

                // Update webhook stats
                webhook.lastDelivery = new Date();
                webhook.deliveryStats.total += 1;
                if (success) {
                    webhook.deliveryStats.successful += 1;
                } else {
                    webhook.deliveryStats.failed += 1;
                }
                await webhook.save();
            }

            if (success) {
                return {
                    success: true,
                    statusCode: response.status,
                    response: response.data,
                    duration,
                    attempt
                };
            }

            lastError = `HTTP ${response.status}: ${response.statusText}`;

        } catch (error) {
            const duration = Date.now() - startTime;
            lastError = error.message;

            // Log failed delivery
            if (!isTest) {
                await WebhookDelivery.create({
                    webhook: webhook._id,
                    event,
                    payload,
                    statusCode: error.response?.status || 0,
                    response: error.response?.data ? JSON.stringify(error.response.data).substring(0, 5000) : null,
                    duration,
                    success: false,
                    attempt,
                    error: error.message
                });

                webhook.deliveryStats.total += 1;
                webhook.deliveryStats.failed += 1;
                await webhook.save();
            }
        }

        // Calculate retry delay
        if (attempt < webhook.maxRetries) {
            const delay = webhook.retryPolicy === 'exponential'
                ? Math.min(1000 * Math.pow(2, attempt - 1), 30000) // Max 30 seconds
                : 5000; // 5 seconds for linear

            await new Promise(resolve => setTimeout(resolve, delay));
        }

        attempt++;
    }

    return {
        success: false,
        statusCode: 0,
        error: lastError,
        duration: Date.now() - startTime,
        attempt: attempt - 1
    };
}

// Helper function to create HMAC signature
function createSignature(secret, payload) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
}

// Export deliverWebhook for use in other parts of the application
exports.deliverWebhook = deliverWebhook;
