const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

const createCompleteTestData = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database\n');

        // Get all plans from database
        const plans = await MembershipPlan.find({ status: 'active' }).limit(5);
        console.log(`📋 Found ${plans.length} active plans\n`);

        if (plans.length === 0) {
            console.log('⚠️  No active plans found in database. Creating test without plan references.');
        }

        const currentDate = new Date();

        // Create comprehensive test users with all fields populated
        const testUsers = [
            {
                firstName: 'Alex',
                lastName: 'Thompson',
                email: 'alex.thompson@testuser.com',
                password: 'Test1234!',
                phone: '+1-555-0101',
                username: 'alexthompson',

                // Subscription - Active Diamond (expires in 3 days)
                subscription: 'Diamond',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 27 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 3 * 24 * 60 * 60 * 1000),
                nextBillingDate: new Date(currentDate.getTime() + 3 * 24 * 60 * 60 * 1000),
                lastBillingDate: new Date(currentDate.getTime() - 27 * 24 * 60 * 60 * 1000),
                billingCycle: 'monthly',
                subscriptionPlanId: plans[0]?._id || null,

                // Payment info
                stripeCustomerId: 'cus_test_001',
                stripeSubscriptionId: 'sub_test_001',
                paymentMethodId: 'pm_test_001',
                totalSpent: 149.99,
                lifetimeValue: 449.97,

                // User details
                role: 'premium_user',
                userType: 'individual',
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(currentDate.getTime() - 25 * 24 * 60 * 60 * 1000),

                // Address
                address: {
                    country: 'United States',
                    streetAddress: '123 Main Street',
                    townCity: 'New York',
                    stateCounty: 'NY',
                    postcodeZip: '10001'
                },

                // Social
                discordUsername: 'alexthompson#1234',
                telegramUsername: '@alexthompson',

                // Login info
                lastLoginAt: new Date(currentDate.getTime() - 2 * 60 * 60 * 1000),
                lastLoginIP: '192.168.1.100',
                loginCount: 45,

                // Preferences
                preferences: {
                    emailNotifications: true,
                    marketingEmails: false,
                    newsletter: true,
                    theme: 'dark'
                },

                source: 'website'
            },
            {
                firstName: 'Sarah',
                lastName: 'Martinez',
                email: 'sarah.martinez@testuser.com',
                password: 'Test1234!',
                phone: '+1-555-0102',
                username: 'sarahmartinez',

                // Subscription - Active Infinity (expires in 5 days)
                subscription: 'Infinity',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 25 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
                nextBillingDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
                lastBillingDate: new Date(currentDate.getTime() - 25 * 24 * 60 * 60 * 1000),
                billingCycle: 'monthly',
                subscriptionPlanId: plans[1]?._id || null,

                // Payment info
                stripeCustomerId: 'cus_test_002',
                stripeSubscriptionId: 'sub_test_002',
                paymentMethodId: 'pm_test_002',
                totalSpent: 599.88,
                lifetimeValue: 1199.76,

                // User details
                role: 'vip_user',
                userType: 'business',
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(currentDate.getTime() - 24 * 24 * 60 * 60 * 1000),

                // Address
                address: {
                    country: 'Canada',
                    streetAddress: '456 Oak Avenue',
                    townCity: 'Toronto',
                    stateCounty: 'ON',
                    postcodeZip: 'M5H 2N2'
                },

                // Company info
                company: {
                    name: 'Martinez Consulting',
                    website: 'https://martinezconsulting.com',
                    industry: 'Finance',
                    size: '11-50'
                },

                // Social
                discordUsername: 'sarahm#5678',

                // Login info
                lastLoginAt: new Date(currentDate.getTime() - 5 * 60 * 60 * 1000),
                lastLoginIP: '192.168.1.101',
                loginCount: 89,

                // Preferences
                preferences: {
                    emailNotifications: true,
                    marketingEmails: true,
                    newsletter: true,
                    theme: 'light'
                },

                source: 'website',
                tags: ['premium', 'business', 'active']
            },
            {
                firstName: 'Michael',
                lastName: 'Chen',
                email: 'michael.chen@testuser.com',
                password: 'Test1234!',
                phone: '+1-555-0103',
                username: 'michaelchen',

                // Subscription - Active Basic (expires in 10 days)
                subscription: 'Basic',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000),
                nextBillingDate: new Date(currentDate.getTime() + 10 * 24 * 60 * 60 * 1000),
                lastBillingDate: new Date(currentDate.getTime() - 20 * 24 * 60 * 60 * 1000),
                billingCycle: 'monthly',
                subscriptionPlanId: plans[2]?._id || null,

                // Payment info
                stripeCustomerId: 'cus_test_003',
                stripeSubscriptionId: 'sub_test_003',
                paymentMethodId: 'pm_test_003',
                totalSpent: 59.99,
                lifetimeValue: 59.99,

                // User details
                role: 'user',
                userType: 'individual',
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(currentDate.getTime() - 19 * 24 * 60 * 60 * 1000),

                // Address
                address: {
                    country: 'United Kingdom',
                    streetAddress: '789 Park Lane',
                    townCity: 'London',
                    postcodeZip: 'SW1A 1AA'
                },

                // Login info
                lastLoginAt: new Date(currentDate.getTime() - 1 * 24 * 60 * 60 * 1000),
                lastLoginIP: '192.168.1.102',
                loginCount: 23,

                // Preferences
                preferences: {
                    emailNotifications: true,
                    marketingEmails: false,
                    newsletter: true,
                    theme: 'auto'
                },

                source: 'api'
            },
            {
                firstName: 'Emma',
                lastName: 'Wilson',
                email: 'emma.wilson@testuser.com',
                password: 'Test1234!',
                phone: '+1-555-0104',

                // Subscription - Trial (expires in 5 days)
                subscription: 'Diamond',
                subscriptionStatus: 'trial',
                subscriptionStartDate: new Date(currentDate.getTime() - 9 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
                nextBillingDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000),
                billingCycle: 'monthly',
                subscriptionPlanId: plans[0]?._id || null,

                // Payment info (trial - no charges yet)
                stripeCustomerId: 'cus_test_004',
                totalSpent: 0,
                lifetimeValue: 0,

                // User details
                role: 'user',
                userType: 'individual',
                isActive: true,
                isEmailVerified: true,
                emailVerifiedAt: new Date(currentDate.getTime() - 8 * 24 * 60 * 60 * 1000),

                // Address
                address: {
                    country: 'Australia',
                    streetAddress: '321 Beach Road',
                    townCity: 'Sydney',
                    stateCounty: 'NSW',
                    postcodeZip: '2000'
                },

                // Login info
                lastLoginAt: new Date(currentDate.getTime() - 3 * 60 * 60 * 1000),
                lastLoginIP: '192.168.1.103',
                loginCount: 12,

                source: 'website',
                tags: ['trial', 'new-user']
            },
            {
                firstName: 'David',
                lastName: 'Kumar',
                email: 'david.kumar@testuser.com',
                password: 'Test1234!',
                phone: '+1-555-0105',
                username: 'davidkumar',

                // Subscription - Expired
                subscription: 'Basic',
                subscriptionStatus: 'expired',
                subscriptionStartDate: new Date(currentDate.getTime() - 90 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() - 10 * 24 * 60 * 60 * 1000),
                lastBillingDate: new Date(currentDate.getTime() - 40 * 24 * 60 * 60 * 1000),
                billingCycle: 'monthly',

                // Payment info
                stripeCustomerId: 'cus_test_005',
                totalSpent: 179.97,
                lifetimeValue: 179.97,

                // User details
                role: 'subscriber',
                userType: 'individual',
                isActive: true,
                isEmailVerified: true,

                // Address
                address: {
                    country: 'India',
                    streetAddress: '654 Tech Park',
                    townCity: 'Bangalore',
                    postcodeZip: '560001'
                },

                // Login info
                lastLoginAt: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
                lastLoginIP: '192.168.1.104',
                loginCount: 56,

                source: 'website',
                tags: ['churned', 'win-back']
            }
        ];

        console.log('📝 Creating comprehensive test users with full data...\n');

        let createdCount = 0;
        let skippedCount = 0;

        for (const userData of testUsers) {
            try {
                // Check if user exists
                const existingUser = await User.findOne({ email: userData.email });

                if (existingUser) {
                    console.log(`⚠️  User ${userData.email} already exists, skipping...`);
                    skippedCount++;
                    continue;
                }

                // Create user
                const user = new User(userData);
                await user.save();

                createdCount++;

                const daysRemaining = userData.subscriptionEndDate ?
                    Math.ceil((userData.subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24)) :
                    'N/A';

                console.log(`✅ Created: ${userData.firstName} ${userData.lastName}`);
                console.log(`   Email: ${userData.email}`);
                console.log(`   Subscription: ${userData.subscription} (${userData.subscriptionStatus})`);
                console.log(`   Days Remaining: ${daysRemaining}`);
                console.log(`   Total Spent: $${userData.totalSpent}`);
                console.log(`   Stripe Customer: ${userData.stripeCustomerId || 'N/A'}`);
                console.log('');
            } catch (error) {
                console.error(`❌ Error creating ${userData.email}:`, error.message);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📊 Test Data Creation Summary:');
        console.log('='.repeat(80));
        console.log(`   Users created: ${createdCount}`);
        console.log(`   Users skipped: ${skippedCount}`);
        console.log(`   Total plans available: ${plans.length}`);

        // Show statistics
        const activeCount = await User.countDocuments({
            subscriptionStatus: 'active',
            subscription: { $ne: 'None' }
        });

        const trialCount = await User.countDocuments({
            subscriptionStatus: 'trial'
        });

        const expiringCount = await User.countDocuments({
            subscription: { $ne: 'None' },
            subscriptionEndDate: {
                $gte: currentDate,
                $lte: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            },
            subscriptionStatus: 'active'
        });

        console.log('\n📈 Database Statistics:');
        console.log(`   Active subscriptions: ${activeCount}`);
        console.log(`   Trial subscriptions: ${trialCount}`);
        console.log(`   Expiring in 7 days: ${expiringCount}`);

        console.log('\n🎉 Test data created successfully!');
        console.log('\n🧪 Test the APIs:');
        console.log('   GET http://localhost:5000/api/subscription?page=1&limit=20');
        console.log('   GET http://localhost:5000/api/subscription/expiring-soon?days=7');
        console.log('   GET http://localhost:5000/api/subscription/due-for-renewal?days=7');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

createCompleteTestData();
