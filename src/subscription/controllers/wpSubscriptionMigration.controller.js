/**
 * WordPress Subscription Migration Controller
 * Handles migration of WooCommerce subscriptions to Eagle User model
 */

const axios = require('axios');
const User = require('../../user/models/user.model');
const MembershipPlan = require('../models/membershipPlan.model');

/**
 * Fetch and migrate WordPress subscriptions
 * @route POST /api/subscription/migrate-wp-subscriptions
 */
exports.migrateWordPressSubscriptions = async (req, res) => {
    try {
        const { wpApiUrl, wpApiKey } = req.body;

        if (!wpApiUrl || !wpApiKey) {
            return res.status(400).json({
                success: false,
                error: 'WordPress API URL and API Key are required'
            });
        }

        console.log('🔄 Starting WordPress subscription migration...');
        console.log('📍 API URL:', wpApiUrl);

        // Fetch subscriptions from WordPress
        let response;
        try {
            response = await axios.get(wpApiUrl, {
                headers: {
                    'x-api-key': wpApiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 seconds timeout
            });
        } catch (axiosError) {
            const errorDetails = {
                message: axiosError.message,
                url: wpApiUrl,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data
            };
            console.error('❌ WordPress API request failed:', errorDetails);
            throw new Error(
                `WordPress API request failed: ${axiosError.response?.status || 'Network Error'} - ` +
                `${axiosError.response?.statusText || axiosError.message}. ` +
                `Please verify the API URL is correct and accessible.`
            );
        }

        if (!response.data || !response.data.success) {
            throw new Error('Invalid response from WordPress API');
        }

        const wpSubscriptions = response.data.data?.subscriptions || [];
        console.log(`📦 Received ${wpSubscriptions.length} subscriptions from WordPress`);

        if (wpSubscriptions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No subscriptions found to migrate',
                data: {
                    total: 0,
                    migrated: 0,
                    updated: 0,
                    failed: 0,
                    results: []
                }
            });
        }

        const results = {
            total: wpSubscriptions.length,
            migrated: 0,
            updated: 0,
            failed: 0,
            results: []
        };

        // Process each subscription
        for (const wpSub of wpSubscriptions) {
            try {
                await processSingleSubscription(wpSub, results);
            } catch (error) {
                console.error(`❌ Error processing subscription ${wpSub.id}:`, error.message);
                results.failed++;
                results.results.push({
                    wpSubscriptionId: wpSub.id,
                    email: wpSub.customer?.email,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log('✅ Migration completed:', results);

        return res.status(200).json({
            success: true,
            message: `Migration completed: ${results.migrated} created, ${results.updated} updated, ${results.failed} failed`,
            data: results
        });

    } catch (error) {
        console.error('❌ WordPress subscription migration error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to migrate WordPress subscriptions'
        });
    }
};

/**
 * Process single WordPress subscription
 */
async function processSingleSubscription(wpSub, results) {
    const customer = wpSub.customer;

    if (!customer || !customer.email) {
        throw new Error('Customer email is required');
    }

    // Map WordPress subscription status to Eagle status
    const statusMap = {
        'active': 'active',
        'cancelled': 'cancelled',
        'expired': 'expired',
        'on-hold': 'suspended',
        'pending': 'pending',
        'pending-cancel': 'cancelled'
    };

    const subscriptionStatus = statusMap[wpSub.status] || 'pending';

    // Map billing period to billing cycle
    const billingCycleMap = {
        'month': 'monthly',
        'year': 'yearly'  // Changed from 'annual' to 'yearly' to match User model enum
    };

    const billingCycle = billingCycleMap[wpSub.billing_period] || 'monthly';

    // Calculate MRR (Monthly Recurring Revenue)
    const total = parseFloat(wpSub.total) || 0;
    const mrr = billingCycle === 'yearly' ? (total / 12) : total;

    // Get product/plan name and map to valid subscription enum
    const planName = wpSub.items && wpSub.items.length > 0
        ? wpSub.items[0].name
        : 'WordPress Subscription';

    // Map WordPress plan names to valid User model subscription enum values
    const subscriptionTypeMap = {
        'eagle premium monthly': 'Diamond',
        'eagle premium annual': 'Diamond',
        'eagle premium yearly': 'Diamond',
        'basic': 'Basic',
        'diamond': 'Diamond',
        'infinity': 'Infinity',
        'script': 'Script',
        'custom': 'Custom'
    };

    const subscriptionType = subscriptionTypeMap[planName.toLowerCase()] || 'Custom';

    // Try to find matching plan
    let matchingPlan = null;
    try {
        matchingPlan = await MembershipPlan.findOne({
            $or: [
                { name: { $regex: new RegExp(planName, 'i') } },
                { displayName: { $regex: new RegExp(planName, 'i') } }
            ],
            isActive: true
        });
    } catch (error) {
        console.log('⚠️ Could not find matching plan for:', planName);
    }

    // Parse dates
    const startDate = wpSub.start_date ? new Date(wpSub.start_date) : new Date();
    const endDate = wpSub.end_date && wpSub.end_date !== 0
        ? new Date(wpSub.end_date)
        : null;
    const nextPaymentDate = wpSub.next_payment_date && wpSub.next_payment_date !== 0
        ? new Date(wpSub.next_payment_date)
        : null;

    // Check if user exists
    let user = await User.findOne({ email: customer.email });

    const subscriptionData = {
        // Subscription fields - use mapped enum value
        subscription: subscriptionType,
        subscriptionStatus: subscriptionStatus,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        nextBillingDate: nextPaymentDate,
        billingCycle: billingCycle,
        mrr: mrr,

        // Plan information - keep original name for display
        currentPlan: matchingPlan ? matchingPlan.displayName : planName,
        currentPlanId: matchingPlan ? matchingPlan._id : null,
        planType: matchingPlan ? matchingPlan.category : 'subscription',

        // Payment information
        lastPaymentAmount: total,
        currency: wpSub.currency || 'USD',

        // WordPress metadata
        wpSubscriptionId: wpSub.id.toString(),
        wpParentOrderId: wpSub.parent_order_id?.toString(),
        wpPaymentMethod: wpSub.payment_method,

        // Notes - preserve original plan name
        notes: `Migrated from WordPress. Original Plan: ${planName}, WP Subscription ID: ${wpSub.id}, Status: ${wpSub.status}`
    };

    if (user) {
        // User exists - update subscription
        console.log(`🔄 Updating subscription for existing user: ${customer.email}`);

        Object.assign(user, subscriptionData);
        await user.save();

        results.updated++;
        results.results.push({
            wpSubscriptionId: wpSub.id,
            email: customer.email,
            success: true,
            action: 'updated',
            message: 'Subscription updated for existing user'
        });

    } else {
        // User doesn't exist - create new user with subscription
        console.log(`➕ Creating new user with subscription: ${customer.email}`);

        // Extract name parts from email if not provided
        const emailUsername = customer.email.split('@')[0];
        const nameParts = emailUsername.split(/[._-]/);

        // Provide defaults for required fields
        const firstName = customer.first_name || nameParts[0] || 'User';
        const lastName = customer.last_name || (nameParts[1] || emailUsername);

        const userData = {
            // Basic user info - ensure required fields are not empty
            name: customer.first_name && customer.last_name
                ? `${customer.first_name} ${customer.last_name}`.trim()
                : `${firstName} ${lastName}`.trim(),
            email: customer.email,
            firstName: firstName,
            lastName: lastName,

            // Auth - temporary password (user should reset)
            password: Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16),
            emailVerified: true, // WordPress users are already verified

            // Subscription data
            ...subscriptionData,

            // User status
            isActive: subscriptionStatus === 'active',
            role: 'subscriber'
        };

        user = new User(userData);
        await user.save();

        results.migrated++;
        results.results.push({
            wpSubscriptionId: wpSub.id,
            email: customer.email,
            success: true,
            action: 'created',
            message: 'New user created with subscription'
        });
    }
}

/**
 * Get migration statistics
 * @route GET /api/subscription/wp-migration-stats
 */
exports.getMigrationStats = async (req, res) => {
    try {
        // Count users with WordPress subscription IDs
        const totalMigrated = await User.countDocuments({
            wpSubscriptionId: { $exists: true, $ne: null }
        });

        const activeSubscriptions = await User.countDocuments({
            wpSubscriptionId: { $exists: true, $ne: null },
            subscriptionStatus: 'active'
        });

        const cancelledSubscriptions = await User.countDocuments({
            wpSubscriptionId: { $exists: true, $ne: null },
            subscriptionStatus: 'cancelled'
        });

        // Get recent migrations (last 24 hours)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const recentMigrations = await User.countDocuments({
            wpSubscriptionId: { $exists: true, $ne: null },
            createdAt: { $gte: yesterday }
        });

        // Total MRR from WordPress subscriptions
        const mrrResult = await User.aggregate([
            {
                $match: {
                    wpSubscriptionId: { $exists: true, $ne: null },
                    subscriptionStatus: 'active'
                }
            },
            {
                $group: {
                    _id: null,
                    totalMRR: { $sum: '$mrr' }
                }
            }
        ]);

        const totalMRR = mrrResult.length > 0 ? mrrResult[0].totalMRR : 0;

        return res.status(200).json({
            success: true,
            data: {
                totalMigrated,
                activeSubscriptions,
                cancelledSubscriptions,
                recentMigrations,
                totalMRR: Math.round(totalMRR * 100) / 100
            }
        });

    } catch (error) {
        console.error('Error getting migration stats:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Check if user subscriptions are migrated
 * @route POST /api/subscription/check-wp-migration
 */
exports.checkMigrationStatus = async (req, res) => {
    try {
        const { emails } = req.body;

        if (!emails || !Array.isArray(emails)) {
            return res.status(400).json({
                success: false,
                error: 'Emails array is required'
            });
        }

        const users = await User.find(
            { email: { $in: emails } },
            { email: 1, wpSubscriptionId: 1, subscriptionStatus: 1, currentPlan: 1 }
        );

        const statusMap = {};
        users.forEach(user => {
            statusMap[user.email] = {
                isMigrated: !!user.wpSubscriptionId,
                subscriptionStatus: user.subscriptionStatus,
                currentPlan: user.currentPlan
            };
        });

        return res.status(200).json({
            success: true,
            data: statusMap
        });

    } catch (error) {
        console.error('Error checking migration status:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * Sync existing users with their WordPress subscriptions
 * @route POST /api/subscription/sync-existing-users
 */
exports.syncExistingUsers = async (req, res) => {
    try {
        const { wpApiUrl, wpApiKey } = req.body;

        if (!wpApiUrl || !wpApiKey) {
            return res.status(400).json({
                success: false,
                error: 'WordPress API URL and API Key are required'
            });
        }

        console.log('🔄 Starting sync for existing users...');

        // Fetch subscriptions from WordPress
        let response;
        try {
            response = await axios.get(wpApiUrl, {
                headers: {
                    'x-api-key': wpApiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
        } catch (axiosError) {
            const errorDetails = {
                message: axiosError.message,
                url: wpApiUrl,
                status: axiosError.response?.status,
                statusText: axiosError.response?.statusText,
                data: axiosError.response?.data
            };
            console.error('❌ WordPress API request failed:', errorDetails);
            throw new Error(
                `WordPress API request failed: ${axiosError.response?.status || 'Network Error'} - ` +
                `${axiosError.response?.statusText || axiosError.message}. ` +
                `Please verify the API URL is correct and accessible.`
            );
        }

        if (!response.data || !response.data.success) {
            throw new Error('Invalid response from WordPress API');
        }

        const wpSubscriptions = response.data.data?.subscriptions || [];
        console.log(`📦 Received ${wpSubscriptions.length} subscriptions`);

        const results = {
            total: wpSubscriptions.length,
            updated: 0,
            userNotFound: 0,
            failed: 0,
            results: []
        };

        // Process each subscription
        for (const wpSub of wpSubscriptions) {
            try {
                const customerEmail = wpSub.customer?.email;

                if (!customerEmail) {
                    results.failed++;
                    continue;
                }

                // Find user by email
                const user = await User.findOne({ email: customerEmail.toLowerCase() });

                if (!user) {
                    results.userNotFound++;
                    results.results.push({
                        email: customerEmail,
                        success: false,
                        reason: 'User not found'
                    });
                    continue;
                }

                // Process and update subscription
                await updateUserSubscription(user, wpSub);

                results.updated++;
                results.results.push({
                    email: customerEmail,
                    userId: user._id,
                    success: true,
                    subscription: user.subscription,
                    status: user.subscriptionStatus
                });

                console.log(`✅ Updated: ${customerEmail}`);

            } catch (error) {
                results.failed++;
                console.error(`❌ Error processing ${wpSub.customer?.email}:`, error.message);
            }
        }

        console.log('✅ Sync completed:', results);

        return res.status(200).json({
            success: true,
            message: `Sync completed: ${results.updated} updated, ${results.userNotFound} users not found, ${results.failed} failed`,
            data: results
        });

    } catch (error) {
        console.error('❌ Sync error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to sync subscriptions'
        });
    }
};

/**
 * Helper: Update user subscription from WordPress data
 */
async function updateUserSubscription(user, wpSub) {
    // Map status
    const statusMap = {
        'active': 'active',
        'cancelled': 'cancelled',
        'expired': 'expired',
        'on-hold': 'suspended',
        'pending': 'pending',
        'pending-cancel': 'cancelled'
    };

    const subscriptionStatus = statusMap[wpSub.status] || 'pending';

    // Map billing period
    const billingCycleMap = {
        'month': 'monthly',
        'year': 'annual'
    };

    const billingCycle = billingCycleMap[wpSub.billing_period] || 'monthly';

    // Calculate MRR
    const total = parseFloat(wpSub.total) || 0;
    const mrr = billingCycle === 'annual' ? (total / 12) : total;

    // Get plan name
    const planName = wpSub.items && wpSub.items.length > 0
        ? wpSub.items[0].name
        : 'WordPress Subscription';

    // Map to subscription type
    const planNameLower = planName.toLowerCase();
    let subscriptionType = 'None';

    if (planNameLower.includes('premium') || planNameLower.includes('pro')) {
        subscriptionType = 'Diamond';
    } else if (planNameLower.includes('basic')) {
        subscriptionType = 'Basic';
    } else if (planNameLower.includes('ultimate') || planNameLower.includes('infinity')) {
        subscriptionType = 'Infinity';
    } else if (planNameLower.includes('script')) {
        subscriptionType = 'Script';
    } else if (total > 0) {
        subscriptionType = 'Custom';
    }

    // Try to find matching plan
    let matchingPlan = null;
    try {
        matchingPlan = await MembershipPlan.findOne({
            $or: [
                { name: { $regex: new RegExp(planName, 'i') } },
                { displayName: { $regex: new RegExp(planName, 'i') } }
            ],
            isActive: true
        });
    } catch (error) {
        // Plan not found
    }

    // Parse dates
    const startDate = wpSub.start_date ? new Date(wpSub.start_date) : new Date();
    const endDate = wpSub.end_date && wpSub.end_date !== 0 && wpSub.end_date !== '0'
        ? new Date(wpSub.end_date)
        : null;
    const nextPaymentDate = wpSub.next_payment_date && wpSub.next_payment_date !== 0 && wpSub.next_payment_date !== '0'
        ? new Date(wpSub.next_payment_date)
        : null;

    // Update user
    user.subscription = subscriptionType;
    user.subscriptionStatus = subscriptionStatus;
    user.subscriptionStartDate = startDate;
    user.subscriptionEndDate = endDate;
    user.nextBillingDate = nextPaymentDate;
    user.billingCycle = billingCycle;
    user.mrr = mrr;
    user.currentPlan = matchingPlan ? matchingPlan.displayName : planName;
    user.currentPlanId = matchingPlan ? matchingPlan._id : null;
    user.planType = matchingPlan ? matchingPlan.category : 'subscription';
    user.lastPaymentAmount = total;
    user.currency = wpSub.currency || 'USD';
    user.wpSubscriptionId = wpSub.id.toString();
    user.wpParentOrderId = wpSub.parent_order_id ? wpSub.parent_order_id.toString() : null;
    user.wpPaymentMethod = wpSub.payment_method || null;
    user.isActive = subscriptionStatus === 'active';
    user.lastSyncedAt = new Date();

    await user.save();
}

module.exports = exports;
