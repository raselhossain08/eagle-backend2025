const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../src/user/models/user.model');

const createTestSubscriptions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend');
        console.log('✅ Connected to database\n');

        const currentDate = new Date();

        // Create test users with different subscription scenarios
        const testUsers = [
            // User expiring in 2 days (critical)
            {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@test.com',
                password: 'Test1234!',
                subscription: 'Diamond',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 28 * 24 * 60 * 60 * 1000), // 28 days ago
                subscriptionEndDate: new Date(currentDate.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                billingCycle: 'monthly',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567890',
                address: {
                    country: 'United States'
                }
            },
            // User expiring in 5 days (medium)
            {
                firstName: 'Jane',
                lastName: 'Smith',
                email: 'jane.smith@test.com',
                password: 'Test1234!',
                subscription: 'Basic',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 25 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
                billingCycle: 'monthly',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567891',
                address: {
                    country: 'Canada'
                }
            },
            // User expiring in 6 days (medium)
            {
                firstName: 'Mike',
                lastName: 'Johnson',
                email: 'mike.johnson@test.com',
                password: 'Test1234!',
                subscription: 'Infinity',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 24 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
                billingCycle: 'monthly',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567892',
                address: {
                    country: 'United Kingdom'
                }
            },
            // User expiring in 15 days (outside 7-day window)
            {
                firstName: 'Sarah',
                lastName: 'Williams',
                email: 'sarah.williams@test.com',
                password: 'Test1234!',
                subscription: 'Diamond',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 15 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
                billingCycle: 'monthly',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567893',
                address: {
                    country: 'Australia'
                }
            },
            // User with no end date (lifetime/manual)
            {
                firstName: 'Robert',
                lastName: 'Brown',
                email: 'robert.brown@test.com',
                password: 'Test1234!',
                subscription: 'Script',
                subscriptionStatus: 'active',
                subscriptionStartDate: new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: null, // No end date
                billingCycle: 'lifetime',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567894',
                address: {
                    country: 'Germany'
                }
            },
            // Inactive subscription
            {
                firstName: 'Emily',
                lastName: 'Davis',
                email: 'emily.davis@test.com',
                password: 'Test1234!',
                subscription: 'Basic',
                subscriptionStatus: 'inactive',
                subscriptionStartDate: new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000),
                subscriptionEndDate: new Date(currentDate.getTime() - 5 * 24 * 60 * 60 * 1000), // expired 5 days ago
                billingCycle: 'monthly',
                isActive: true,
                isEmailVerified: true,
                phone: '+1234567895',
                address: {
                    country: 'France'
                }
            }
        ];

        console.log('📝 Creating test users with subscriptions...\n');

        for (const userData of testUsers) {
            // Check if user already exists
            const existingUser = await User.findOne({ email: userData.email });

            if (existingUser) {
                console.log(`⚠️  User ${userData.email} already exists, skipping...`);
                continue;
            }

            const user = new User(userData);
            await user.save();

            const daysRemaining = userData.subscriptionEndDate ?
                Math.ceil((userData.subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24)) :
                'N/A';

            console.log(`✅ Created: ${userData.firstName} ${userData.lastName}`);
            console.log(`   Email: ${userData.email}`);
            console.log(`   Subscription: ${userData.subscription} (${userData.subscriptionStatus})`);
            console.log(`   Billing Cycle: ${userData.billingCycle}`);
            console.log(`   End Date: ${userData.subscriptionEndDate ? userData.subscriptionEndDate.toISOString().split('T')[0] : 'N/A'}`);
            console.log(`   Days Remaining: ${daysRemaining}`);
            console.log('');
        }

        // Summary
        console.log('\n📊 Summary:');
        const totalCreated = await User.countDocuments({ email: { $in: testUsers.map(u => u.email) } });
        console.log(`   Total users created/verified: ${totalCreated}`);

        const expiringIn7Days = await User.countDocuments({
            subscription: { $ne: 'None', $ne: null },
            subscriptionEndDate: {
                $gte: currentDate,
                $lte: new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
            },
            isActive: true
        });
        console.log(`   Users expiring in next 7 days: ${expiringIn7Days}`);

        console.log('\n🎉 Test data created successfully!');
        console.log('\n📋 You can now test the API:');
        console.log('   GET http://localhost:5000/api/subscription/expiring-soon?days=7');
        console.log('   GET http://localhost:5000/api/subscription/due-for-renewal?days=7');
        console.log('   GET http://localhost:5000/api/subscription/expiring-soon?days=7&showAll=true');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
};

createTestSubscriptions();
