const User = require('../../user/models/user.model');
const MigrationHistory = require('../../models/MigrationHistory');
const wordpressAuthService = require('../../services/wordpressAuth.service');
const MembershipPlan = require('../../subscription/models/membershipPlan.model');
const bcrypt = require('bcryptjs');
const axios = require('axios');

/**
 * Migrate a WordPress user to the Eagle system with subscription
 * 
 * This endpoint allows bulk migration of WordPress users with their subscriptions.
 * It creates users in the local database with their WordPress credentials and subscription data.
 */
const migrateWordPressUser = async (req, res) => {
    try {
        const {
            wpUserId,
            username,
            email,
            displayName,
            firstName,
            lastName,
            role,
            registeredDate,
            password, // Optional: if provided, set as user password
            subscription, // WordPress subscription data
            wpApiUrl, // WordPress API URL to fetch subscription
            wpApiKey // WordPress API Key
        } = req.body;

        // Validation
        if (!wpUserId || !username || !email) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: wpUserId, username, email'
            });
        }

        // Check migration history first (faster than User query)
        const { isMigrated, migration } = await MigrationHistory.isUserMigrated(wpUserId);

        if (isMigrated) {
            const existingUser = await User.findById(migration.userId);

            // Log this duplicate attempt
            await MigrationHistory.create({
                wpUserId,
                userId: migration.userId,
                username,
                email: email.toLowerCase(),
                status: 'already_exists',
                migrationType: 'single',
                migrationSource: 'dashboard',
                errorMessage: 'User already migrated',
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            return res.status(200).json({
                success: true,
                alreadyExists: true,
                userId: existingUser._id,
                migrationDate: migration.createdAt,
                message: `User already migrated on ${migration.createdAt.toLocaleDateString()}`,
                user: {
                    id: existingUser._id,
                    email: existingUser.email,
                    name: existingUser.name || existingUser.fullName,
                    wordpressId: existingUser.wordpressId,
                    subscription: existingUser.subscription
                }
            });
        }

        // Check if user already exists (safety check)
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { wordpressId: wpUserId },
                { username: username }
            ]
        });

        if (existingUser) {
            // Create migration history for existing user
            await MigrationHistory.create({
                wpUserId,
                userId: existingUser._id,
                username,
                email: email.toLowerCase(),
                status: 'already_exists',
                migrationType: 'single',
                migrationSource: 'dashboard',
                wordPressData: { displayName, firstName, lastName, role, registeredDate },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            return res.status(200).json({
                success: true,
                alreadyExists: true,
                userId: existingUser._id,
                message: `User already exists: ${email}`,
                user: {
                    id: existingUser._id,
                    email: existingUser.email,
                    name: existingUser.name || existingUser.fullName,
                    wordpressId: existingUser.wordpressId
                }
            });
        }

        // Map WordPress role to system role
        const systemRole = wordpressAuthService.mapWordPressRole(role || 'subscriber');

        // Generate temporary password if not provided
        const userPassword = password || `WP_MIGRATE_${wpUserId}_${Date.now()}`;

        // Prepare user data
        const userData = {
            firstName: firstName || displayName?.split(' ')[0] || 'User',
            lastName: lastName || displayName?.split(' ').slice(1).join(' ') || '',
            name: displayName || username,
            username: username,
            email: email.toLowerCase(),
            password: userPassword, // Will be hashed by pre-save hook
            wordpressId: wpUserId,
            isWordPressUser: true,
            isEmailVerified: true, // WordPress users are already verified
            isActive: true,
            role: systemRole,
            subscription: 'None', // Default subscription
            subscriptionStatus: 'none',
            lastSyncedAt: new Date(),
            lastLoginAt: registeredDate ? new Date(registeredDate) : new Date(),
            source: 'wordpress'
        };

        // Try to fetch and add subscription data
        let subscriptionData = null;
        if (subscription) {
            // Subscription data provided directly
            subscriptionData = await processSubscriptionData(subscription, email);
        } else if (wpApiUrl && wpApiKey) {
            // Fetch subscription from WordPress API
            try {
                subscriptionData = await fetchWordPressSubscription(email, wpApiUrl, wpApiKey);
            } catch (subError) {
                console.log(`⚠️ Could not fetch subscription for ${email}:`, subError.message);
            }
        }

        // Merge subscription data if found
        if (subscriptionData) {
            Object.assign(userData, subscriptionData);
            console.log(`📦 Added subscription data for ${email}: ${subscriptionData.subscription}`);
        }

        // Create new user
        const newUser = await User.create(userData);

        // Create migration history record
        await MigrationHistory.create({
            wpUserId,
            userId: newUser._id,
            username,
            email: email.toLowerCase(),
            status: 'success',
            migrationType: 'single',
            migrationSource: 'dashboard',
            wordPressData: {
                displayName,
                firstName,
                lastName,
                role,
                registeredDate
            },
            completedAt: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        console.log(`✅ WordPress user migrated successfully: ${email}`);

        res.status(201).json({
            success: true,
            message: 'User migrated successfully',
            userId: newUser._id,
            user: {
                id: newUser._id,
                email: newUser.email,
                name: newUser.name,
                wordpressId: newUser.wordpressId,
                role: newUser.role,
                subscription: newUser.subscription
            }
        });

    } catch (error) {
        console.error('❌ Error migrating WordPress user:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to migrate user',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Check if a user exists in the system
 */
const checkUserExists = async (req, res) => {
    try {
        const { email, wpUserId, username } = req.query;

        if (!email && !wpUserId && !username) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email, wpUserId, or username'
            });
        }

        const query = {
            $or: []
        };

        if (email) query.$or.push({ email: email.toLowerCase() });
        if (wpUserId) query.$or.push({ wordpressId: parseInt(wpUserId) });
        if (username) query.$or.push({ username: username });

        const user = await User.findOne(query);

        res.json({
            success: true,
            exists: !!user,
            user: user ? {
                id: user._id,
                email: user.email,
                name: user.name,
                wordpressId: user.wordpressId,
                role: user.role
            } : null
        });

    } catch (error) {
        console.error('Error checking user existence:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check user existence',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Bulk migrate WordPress users with subscriptions
 */
const bulkMigrateWordPressUsers = async (req, res) => {
    try {
        const { users, wpApiUrl, wpApiKey } = req.body;

        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of users to migrate'
            });
        }

        const results = {
            total: users.length,
            success: 0,
            failed: 0,
            alreadyExists: 0,
            withSubscription: 0,
            details: []
        };

        console.log(`🔄 Starting bulk migration of ${users.length} users...`);

        for (const wpUser of users) {
            try {
                const existingUser = await User.findOne({
                    $or: [
                        { email: wpUser.email?.toLowerCase() },
                        { wordpressId: wpUser.wpUserId },
                        { username: wpUser.username }
                    ]
                });

                if (existingUser) {
                    results.alreadyExists++;
                    results.details.push({
                        wpUserId: wpUser.wpUserId,
                        email: wpUser.email,
                        status: 'exists',
                        userId: existingUser._id
                    });
                    continue;
                }

                const systemRole = wordpressAuthService.mapWordPressRole(wpUser.role || 'subscriber');
                const userPassword = wpUser.password || `WP_MIGRATE_${wpUser.wpUserId}_${Date.now()}`;

                // Prepare base user data
                const userData = {
                    firstName: wpUser.firstName || wpUser.displayName?.split(' ')[0] || 'User',
                    lastName: wpUser.lastName || wpUser.displayName?.split(' ').slice(1).join(' ') || '',
                    name: wpUser.displayName || wpUser.username,
                    username: wpUser.username,
                    email: wpUser.email.toLowerCase(),
                    password: userPassword,
                    wordpressId: wpUser.wpUserId,
                    isWordPressUser: true,
                    isEmailVerified: true,
                    isActive: true,
                    role: systemRole,
                    subscription: 'None',
                    subscriptionStatus: 'none',
                    lastSyncedAt: new Date(),
                    lastLoginAt: wpUser.registeredDate ? new Date(wpUser.registeredDate) : new Date(),
                    source: 'wordpress'
                };

                // Try to add subscription data
                let hasSubscription = false;
                if (wpUser.subscription) {
                    // Subscription data provided directly
                    const subscriptionData = await processSubscriptionData(wpUser.subscription, wpUser.email);
                    if (subscriptionData) {
                        Object.assign(userData, subscriptionData);
                        hasSubscription = true;
                    }
                } else if (wpApiUrl && wpApiKey) {
                    // Fetch subscription from WordPress API
                    try {
                        const subscriptionData = await fetchWordPressSubscription(wpUser.email, wpApiUrl, wpApiKey);
                        if (subscriptionData) {
                            Object.assign(userData, subscriptionData);
                            hasSubscription = true;
                        }
                    } catch (subError) {
                        console.log(`⚠️ Could not fetch subscription for ${wpUser.email}`);
                    }
                }

                const newUser = await User.create(userData);

                if (hasSubscription) {
                    results.withSubscription++;
                }

                results.success++;
                results.details.push({
                    wpUserId: wpUser.wpUserId,
                    email: wpUser.email,
                    status: 'created',
                    userId: newUser._id,
                    hasSubscription: hasSubscription,
                    subscription: userData.subscription,
                    subscriptionStatus: userData.subscriptionStatus
                });

                console.log(`✅ Migrated: ${wpUser.email} ${hasSubscription ? '(with subscription)' : ''}`);

            } catch (error) {
                results.failed++;
                results.details.push({
                    wpUserId: wpUser.wpUserId,
                    email: wpUser.email,
                    status: 'failed',
                    error: error.message
                });
                console.error(`❌ Failed to migrate ${wpUser.email}:`, error.message);
            }
        }

        console.log(`✅ Bulk migration completed: ${results.success} success, ${results.failed} failed, ${results.alreadyExists} already exist, ${results.withSubscription} with subscriptions`);

        res.json({
            success: true,
            message: 'Bulk migration completed',
            results
        });

    } catch (error) {
        console.error('Error in bulk migration:', error);
        res.status(500).json({
            success: false,
            message: 'Bulk migration failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Helper: Fetch WordPress subscription for a user
 */
async function fetchWordPressSubscription(email, wpApiUrl, wpApiKey) {
    try {
        const response = await axios.get(wpApiUrl, {
            headers: {
                'x-api-key': wpApiKey,
                'Content-Type': 'application/json'
            },
            params: {
                customer_email: email
            },
            timeout: 10000
        });

        if (!response.data || !response.data.success) {
            return null;
        }

        const subscriptions = response.data.data?.subscriptions || [];

        // Find active subscription or most recent one
        const activeSubscription = subscriptions.find(s => s.status === 'active') || subscriptions[0];

        if (!activeSubscription) {
            return null;
        }

        return await processSubscriptionData(activeSubscription, email);

    } catch (error) {
        console.error(`Error fetching WP subscription for ${email}:`, error.message);
        return null;
    }
}

/**
 * Helper: Process WordPress subscription data
 */
async function processSubscriptionData(wpSub, email) {
    try {
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
            'year': 'annual'
        };

        const billingCycle = billingCycleMap[wpSub.billing_period] || 'monthly';

        // Calculate MRR (Monthly Recurring Revenue)
        const total = parseFloat(wpSub.total) || 0;
        const mrr = billingCycle === 'annual' ? (total / 12) : total;

        // Get product/plan name
        const planName = wpSub.items && wpSub.items.length > 0
            ? wpSub.items[0].name
            : 'WordPress Subscription';

        // Map plan name to Eagle subscription types
        let subscriptionType = 'None';
        const planNameLower = planName.toLowerCase();

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

        // Try to find matching plan in database
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
        const endDate = wpSub.end_date && wpSub.end_date !== 0 && wpSub.end_date !== '0'
            ? new Date(wpSub.end_date)
            : null;
        const nextPaymentDate = wpSub.next_payment_date && wpSub.next_payment_date !== 0 && wpSub.next_payment_date !== '0'
            ? new Date(wpSub.next_payment_date)
            : null;

        // Build subscription data object
        const subscriptionData = {
            // Subscription fields
            subscription: subscriptionType,
            subscriptionStatus: subscriptionStatus,
            subscriptionStartDate: startDate,
            subscriptionEndDate: endDate,
            nextBillingDate: nextPaymentDate,
            billingCycle: billingCycle,
            mrr: mrr,

            // Plan information
            currentPlan: matchingPlan ? matchingPlan.displayName : planName,
            currentPlanId: matchingPlan ? matchingPlan._id : null,
            planType: matchingPlan ? matchingPlan.category : 'subscription',

            // Payment information
            lastPaymentAmount: total,
            currency: wpSub.currency || 'USD',

            // WordPress metadata
            wpSubscriptionId: wpSub.id ? wpSub.id.toString() : null,
            wpParentOrderId: wpSub.parent_order_id ? wpSub.parent_order_id.toString() : null,
            wpPaymentMethod: wpSub.payment_method || null,

            // Update active status based on subscription
            isActive: subscriptionStatus === 'active'
        };

        return subscriptionData;

    } catch (error) {
        console.error('Error processing subscription data:', error);
        return null;
    }
}

module.exports = {
    migrateWordPressUser,
    checkUserExists,
    bulkMigrateWordPressUsers,
    getMigrationStats,
    getMigrationHistory,
    checkMigrationStatus,
    fetchWordPressSubscription,
    processSubscriptionData
};

/**
 * Get migration statistics
 */
async function getMigrationStats(req, res) {
    try {
        const stats = await MigrationHistory.getMigrationStats();

        // Get recent migrations count
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentCount = await MigrationHistory.countDocuments({
            createdAt: { $gte: last24Hours }
        });

        // Get total WordPress users count
        const totalWPUsers = await User.countDocuments({ isWordPressUser: true });

        res.json({
            success: true,
            stats: {
                ...stats,
                totalWPUsers,
                last24Hours: recentCount
            }
        });

    } catch (error) {
        console.error('Error fetching migration stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch migration stats',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Get migration history with pagination
 */
async function getMigrationHistory(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const query = {};

        // Filter by status
        if (req.query.status) {
            query.status = req.query.status;
        }

        // Filter by date range
        if (req.query.startDate || req.query.endDate) {
            query.createdAt = {};
            if (req.query.startDate) {
                query.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                query.createdAt.$lte = new Date(req.query.endDate);
            }
        }

        const total = await MigrationHistory.countDocuments(query);
        const history = await MigrationHistory.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'name email subscription subscriptionStatus')
            .populate('migratedBy', 'name email')
            .lean();

        res.json({
            success: true,
            history,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching migration history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch migration history',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Check migration status of multiple WordPress users
 */
async function checkMigrationStatus(req, res) {
    try {
        const { wpUserIds } = req.body;

        if (!Array.isArray(wpUserIds) || wpUserIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of WordPress user IDs'
            });
        }

        // Find all migration records for these users
        const migrations = await MigrationHistory.find({
            wpUserId: { $in: wpUserIds },
            status: { $in: ['success', 'already_exists'] }
        }).select('wpUserId userId status createdAt');

        // Create a map of migrated users
        const migratedMap = {};
        migrations.forEach(m => {
            migratedMap[m.wpUserId] = {
                isMigrated: true,
                userId: m.userId,
                status: m.status,
                migratedAt: m.createdAt
            };
        });

        // Fill in non-migrated users
        const result = wpUserIds.map(wpUserId => ({
            wpUserId,
            ...(migratedMap[wpUserId] || { isMigrated: false })
        }));

        res.json({
            success: true,
            statuses: result
        });

    } catch (error) {
        console.error('Error checking migration status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check migration status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}
