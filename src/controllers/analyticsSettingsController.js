const AnalyticsSettings = require('../models/AnalyticsSettings');
const axios = require('axios');

// Get analytics settings
exports.getAnalyticsSettings = async (req, res) => {
    try {
        const settings = await AnalyticsSettings.getSettings();

        // Sanitize sensitive data for frontend
        const sanitizedSettings = {
            googleAnalytics: {
                ...settings.googleAnalytics.toObject(),
                apiSecret: settings.googleAnalytics.apiSecret ?
                    '***' + settings.googleAnalytics.apiSecret.slice(-4) : '',
                configured: settings.isProviderConfigured('googleAnalytics')
            },
            posthog: {
                ...settings.posthog.toObject(),
                projectApiKey: settings.posthog.projectApiKey ?
                    '***' + settings.posthog.projectApiKey.slice(-4) : '',
                personalApiKey: settings.posthog.personalApiKey ?
                    '***' + settings.posthog.personalApiKey.slice(-4) : '',
                configured: settings.isProviderConfigured('posthog')
            },
            plausible: {
                ...settings.plausible.toObject(),
                apiKey: settings.plausible.apiKey ?
                    '***' + settings.plausible.apiKey.slice(-4) : '',
                configured: settings.isProviderConfigured('plausible')
            },
            lastUpdated: settings.lastUpdated
        };

        res.json({
            success: true,
            data: sanitizedSettings
        });
    } catch (error) {
        console.error('Get analytics settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics settings',
            error: error.message
        });
    }
};

// Update analytics settings
exports.updateAnalyticsSettings = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const updates = req.body;

        // Validate required fields for each provider
        if (updates.googleAnalytics?.enabled && updates.googleAnalytics?.measurementId) {
            if (!updates.googleAnalytics.measurementId.startsWith('G-')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Google Analytics Measurement ID format. Should start with G-'
                });
            }
        }

        if (updates.posthog?.enabled && updates.posthog?.projectApiKey) {
            if (!updates.posthog.projectApiKey.startsWith('phc_')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid PostHog Project API Key format. Should start with phc_'
                });
            }
        }

        const settings = await AnalyticsSettings.updateSettings(updates, userId);

        // Return sanitized settings
        const sanitizedSettings = {
            googleAnalytics: {
                ...settings.googleAnalytics.toObject(),
                apiSecret: settings.googleAnalytics.apiSecret ?
                    '***' + settings.googleAnalytics.apiSecret.slice(-4) : '',
                configured: settings.isProviderConfigured('googleAnalytics')
            },
            posthog: {
                ...settings.posthog.toObject(),
                projectApiKey: settings.posthog.projectApiKey ?
                    '***' + settings.posthog.projectApiKey.slice(-4) : '',
                personalApiKey: settings.posthog.personalApiKey ?
                    '***' + settings.posthog.personalApiKey.slice(-4) : '',
                configured: settings.isProviderConfigured('posthog')
            },
            plausible: {
                ...settings.plausible.toObject(),
                apiKey: settings.plausible.apiKey ?
                    '***' + settings.plausible.apiKey.slice(-4) : '',
                configured: settings.isProviderConfigured('plausible')
            },
            lastUpdated: settings.lastUpdated
        };

        res.json({
            success: true,
            message: 'Analytics settings updated successfully',
            data: sanitizedSettings
        });
    } catch (error) {
        console.error('Update analytics settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update analytics settings',
            error: error.message
        });
    }
};

// Test analytics provider connection
exports.testAnalyticsConnection = async (req, res) => {
    try {
        const { provider } = req.params;
        const settings = await AnalyticsSettings.getSettings();

        let testResult = { success: false, message: '' };

        switch (provider) {
            case 'googleAnalytics':
                if (!settings.googleAnalytics.measurementId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Google Analytics Measurement ID is required'
                    });
                }

                // Test GA4 Measurement Protocol
                if (settings.googleAnalytics.apiSecret) {
                    try {
                        const response = await axios.post(
                            `https://www.google-analytics.com/mp/collect?measurement_id=${settings.googleAnalytics.measurementId}&api_secret=${settings.googleAnalytics.apiSecret}`,
                            {
                                client_id: 'test_client',
                                events: [{
                                    name: 'connection_test',
                                    params: {}
                                }]
                            },
                            { timeout: 5000 }
                        );
                        testResult = {
                            success: response.status === 204 || response.status === 200,
                            message: 'Google Analytics connection successful'
                        };
                    } catch (error) {
                        testResult = {
                            success: false,
                            message: `GA4 API test failed: ${error.message}`
                        };
                    }
                } else {
                    testResult = {
                        success: true,
                        message: 'Google Analytics configuration valid (API Secret not provided for server-side testing)'
                    };
                }
                break;

            case 'posthog':
                if (!settings.posthog.projectApiKey) {
                    return res.status(400).json({
                        success: false,
                        message: 'PostHog Project API Key is required'
                    });
                }

                // Test PostHog connection
                try {
                    const response = await axios.post(
                        `${settings.posthog.host}/capture/`,
                        {
                            api_key: settings.posthog.projectApiKey,
                            event: 'connection_test',
                            distinct_id: 'test_user',
                            properties: {
                                test: true
                            }
                        },
                        {
                            timeout: 5000,
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    testResult = {
                        success: response.status === 200,
                        message: 'PostHog connection successful'
                    };
                } catch (error) {
                    testResult = {
                        success: false,
                        message: `PostHog connection failed: ${error.response?.data?.message || error.message}`
                    };
                }
                break;

            case 'plausible':
                if (!settings.plausible.domain || !settings.plausible.apiKey) {
                    return res.status(400).json({
                        success: false,
                        message: 'Plausible domain and API key are required'
                    });
                }

                // Test Plausible Stats API
                try {
                    const response = await axios.get(
                        `https://plausible.io/api/v1/stats/aggregate?site_id=${settings.plausible.domain}&period=30d`,
                        {
                            headers: {
                                'Authorization': `Bearer ${settings.plausible.apiKey}`
                            },
                            timeout: 5000
                        }
                    );
                    testResult = {
                        success: response.status === 200,
                        message: 'Plausible connection successful'
                    };
                } catch (error) {
                    if (error.response?.status === 401) {
                        testResult = {
                            success: false,
                            message: 'Invalid API key'
                        };
                    } else {
                        testResult = {
                            success: false,
                            message: `Plausible connection failed: ${error.message}`
                        };
                    }
                }
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid provider specified'
                });
        }

        res.json(testResult);
    } catch (error) {
        console.error('Test analytics connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Connection test failed',
            error: error.message
        });
    }
};

// Get analytics statistics (for dashboard cards)
exports.getAnalyticsStats = async (req, res) => {
    try {
        const settings = await AnalyticsSettings.getSettings();
        const stats = {
            overview: {
                activeUsers: 0,
                pageViews: 0,
                conversions: 0
            },
            userInsights: {
                newUsers: 0,
                returningUsers: 0,
                avgSession: '0m 0s'
            },
            eventTracking: {
                subscriptions: 0,
                contracts: 0,
                payments: 0
            },
            activeProviders: [
                settings.googleAnalytics.enabled && settings.isProviderConfigured('googleAnalytics'),
                settings.posthog.enabled && settings.isProviderConfigured('posthog'),
                settings.plausible.enabled && settings.isProviderConfigured('plausible')
            ].filter(Boolean).length
        };

        // TODO: Fetch real analytics data from providers
        // This would require implementing actual API calls to each provider

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Get analytics stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics statistics',
            error: error.message
        });
    }
};

module.exports = exports;
