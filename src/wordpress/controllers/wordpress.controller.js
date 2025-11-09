const WordPressData = require('../models/wordpressData.model');
const axios = require('axios');

// @desc    Fetch data from WordPress API and save to database
// @route   POST /api/wordpress/sync/:endpoint
// @access  Private (requires authentication)
exports.syncWordPressEndpoint = async (req, res) => {
    try {
        const { endpoint } = req.params;
        const { wpUrl, apiKey } = req.body;

        if (!wpUrl || !apiKey) {
            return res.status(400).json({
                success: false,
                message: 'WordPress URL and API Key are required'
            });
        }

        // Validate endpoint
        const validEndpoints = ['customers', 'orders', 'subscriptions', 'analytics', 'payment-methods', 'coupons'];
        if (!validEndpoints.includes(endpoint)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid endpoint'
            });
        }

        // Fetch data from WordPress API
        const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/${endpoint}`;

        try {
            const wpResponse = await axios.get(wpApiUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey
                },
                timeout: 30000 // 30 seconds timeout
            });

            const wpData = wpResponse.data.data || wpResponse.data;

            // Save to database
            const savedData = await WordPressData.saveEndpointData(
                endpoint,
                wpData,
                wpUrl
            );

            res.status(200).json({
                success: true,
                message: `${endpoint} data synced successfully`,
                data: {
                    id: savedData._id,
                    endpoint: savedData.endpoint,
                    itemCount: savedData.metadata.itemCount,
                    lastSynced: savedData.metadata.lastSynced
                }
            });

        } catch (wpError) {
            console.error('WordPress API Error:', wpError.message);
            return res.status(502).json({
                success: false,
                message: 'Failed to fetch data from WordPress API',
                error: wpError.message
            });
        }

    } catch (error) {
        console.error('Sync Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while syncing WordPress data',
            error: error.message
        });
    }
};

// @desc    Sync all endpoints at once
// @route   POST /api/wordpress/sync-all
// @access  Private
exports.syncAllEndpoints = async (req, res) => {
    try {
        const { wpUrl, apiKey } = req.body;

        if (!wpUrl || !apiKey) {
            return res.status(400).json({
                success: false,
                message: 'WordPress URL and API Key are required'
            });
        }

        const endpoints = ['customers', 'orders', 'subscriptions', 'analytics', 'payment-methods', 'coupons'];
        const results = [];
        const errors = [];

        for (const endpoint of endpoints) {
            try {
                const wpApiUrl = `${wpUrl.replace(/\/$/, '')}/${endpoint}`;
                const wpResponse = await axios.get(wpApiUrl, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': apiKey
                    },
                    timeout: 30000
                });

                const wpData = wpResponse.data.data || wpResponse.data;
                const savedData = await WordPressData.saveEndpointData(endpoint, wpData, wpUrl);

                results.push({
                    endpoint,
                    success: true,
                    itemCount: savedData.metadata.itemCount
                });
            } catch (error) {
                errors.push({
                    endpoint,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Sync completed',
            results,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Sync All Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while syncing all endpoints',
            error: error.message
        });
    }
};

// @desc    Get latest data for a specific endpoint
// @route   GET /api/wordpress/:endpoint
// @access  Private
exports.getEndpointData = async (req, res) => {
    try {
        const { endpoint } = req.params;

        const data = await WordPressData.getLatestByEndpoint(endpoint);

        if (!data) {
            return res.status(404).json({
                success: false,
                message: `No data found for ${endpoint}. Please sync first.`
            });
        }

        res.status(200).json({
            success: true,
            data: data.data,
            metadata: data.metadata,
            timestamp: data.createdAt
        });

    } catch (error) {
        console.error('Get Endpoint Data Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching endpoint data',
            error: error.message
        });
    }
};

// @desc    Get all endpoints status
// @route   GET /api/wordpress/status
// @access  Private
exports.getEndpointsStatus = async (req, res) => {
    try {
        const endpoints = ['customers', 'orders', 'subscriptions', 'analytics', 'payment-methods', 'coupons'];
        const status = [];

        for (const endpoint of endpoints) {
            const latestData = await WordPressData.getLatestByEndpoint(endpoint);

            status.push({
                endpoint,
                hasSyncedData: !!latestData,
                lastSynced: latestData?.metadata.lastSynced || null,
                itemCount: latestData?.metadata.itemCount || 0
            });
        }

        res.status(200).json({
            success: true,
            data: status
        });

    } catch (error) {
        console.error('Get Status Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching status',
            error: error.message
        });
    }
};

// @desc    Test WordPress connection
// @route   POST /api/wordpress/test-connection
// @access  Private
exports.testConnection = async (req, res) => {
    try {
        const { wpUrl, apiKey } = req.body;

        if (!wpUrl || !apiKey) {
            return res.status(400).json({
                success: false,
                message: 'WordPress URL and API Key are required'
            });
        }

        // Try to fetch customers endpoint as a test
        const testUrl = `${wpUrl.replace(/\/$/, '')}/customers`;

        await axios.get(testUrl, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            timeout: 10000
        });

        res.status(200).json({
            success: true,
            message: 'Connection successful'
        });

    } catch (error) {
        console.error('Connection Test Error:', error);
        res.status(502).json({
            success: false,
            message: 'Failed to connect to WordPress API',
            error: error.message
        });
    }
};

// @desc    Delete old sync data
// @route   DELETE /api/wordpress/cleanup
// @access  Private/Admin
exports.cleanupOldData = async (req, res) => {
    try {
        const daysToKeep = req.query.days || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const result = await WordPressData.deleteMany({
            createdAt: { $lt: cutoffDate }
        });

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} old records`,
            deletedCount: result.deletedCount
        });

    } catch (error) {
        console.error('Cleanup Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while cleaning up data',
            error: error.message
        });
    }
};
