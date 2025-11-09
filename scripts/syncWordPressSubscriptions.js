/**
 * Sync WordPress Subscriptions for Existing Users
 * 
 * This script fetches subscriptions from WordPress and updates existing users
 * Run: node scripts/syncWordPressSubscriptions.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

// WordPress API Configuration
const WP_API_URL = process.env.WP_SUBSCRIPTION_API_URL || 'https://eagle.cool/wp-json/eagle/v1/subscriptions';
const WP_API_KEY = process.env.WP_API_KEY || 'your-api-key-here';

/**
 * Connect to MongoDB
 */
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-db');
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
}

/**
 * Fetch all subscriptions from WordPress
 */
async function fetchWordPressSubscriptions() {
    try {
        console.log('🔄 Fetching subscriptions from WordPress...');
        console.log('📍 API URL:', WP_API_URL);

        const response = await axios.get(WP_API_URL, {
            headers: {
                'x-api-key': WP_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        if (!response.data || !response.data.success) {
            throw new Error('Invalid response from WordPress API');
        }

        const subscriptions = response.data.data?.subscriptions || [];
        console.log(`✅ Fetched ${subscriptions.length} subscriptions from WordPress`);

        return subscriptions;

    } catch (error) {
        console.error('❌ Error fetching WordPress subscriptions:', error.message);
        throw error;
    }
}

/**
 * Map WordPress plan name to Eagle subscription type
 */
function mapPlanToSubscriptionType(planName, total) {
    const planNameLower = planName.toLowerCase();

    if (planNameLower.includes('premium') || planNameLower.includes('pro')) {
        return 'Diamond';
    } else if (planNameLower.includes('basic')) {
        return 'Basic';
    } else if (planNameLower.includes('ultimate') || planNameLower.includes('infinity')) {
        return 'Infinity';
    } else if (planNameLower.includes('script')) {
        return 'Script';
    } else if (total > 0) {
        return 'Custom';
    }

    return 'None';
}

/**
 * Process and update a single subscription
 */
async function processSubscription(wpSub, stats) {
    try {
        const customerEmail = wpSub.customer?.email;

        if (!customerEmail) {
            stats.skipped++;
            console.log(`⚠️ Skipped subscription ${wpSub.id}: No customer email`);
            return;
        }

        // Find user by email
        const user = await User.findOne({ email: customerEmail.toLowerCase() });

        if (!user) {
            stats.userNotFound++;
            console.log(`⚠️ User not found: ${customerEmail}`);
            return;
        }

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

        const subscriptionType = mapPlanToSubscriptionType(planName, total);

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
            // Plan not found, continue with planName
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

        stats.updated++;
        console.log(`✅ Updated: ${customerEmail} - ${subscriptionType} (${subscriptionStatus})`);

    } catch (error) {
        stats.failed++;
        console.error(`❌ Error processing subscription ${wpSub.id}:`, error.message);
    }
}

/**
 * Main sync function
 */
async function syncSubscriptions() {
    console.log('\n🚀 Starting WordPress Subscription Sync...\n');

    const stats = {
        total: 0,
        updated: 0,
        failed: 0,
        skipped: 0,
        userNotFound: 0
    };

    try {
        // Fetch subscriptions from WordPress
        const wpSubscriptions = await fetchWordPressSubscriptions();
        stats.total = wpSubscriptions.length;

        if (wpSubscriptions.length === 0) {
            console.log('\n⚠️ No subscriptions found to sync');
            return;
        }

        console.log('\n🔄 Processing subscriptions...\n');

        // Process each subscription
        for (const wpSub of wpSubscriptions) {
            await processSubscription(wpSub, stats);
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 SYNC SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Subscriptions: ${stats.total}`);
        console.log(`✅ Successfully Updated: ${stats.updated}`);
        console.log(`❌ Failed: ${stats.failed}`);
        console.log(`⚠️ Skipped (No Email): ${stats.skipped}`);
        console.log(`⚠️ User Not Found: ${stats.userNotFound}`);
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        throw error;
    }
}

/**
 * Run the script
 */
async function run() {
    try {
        await connectDB();
        await syncSubscriptions();
        console.log('\n✅ Sync completed successfully!\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Script failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    run();
}

module.exports = { syncSubscriptions, fetchWordPressSubscriptions };
