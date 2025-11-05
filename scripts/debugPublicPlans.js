/**
 * Debug script to test getPublicPlans query
 * Run with: node scripts/debugPublicPlans.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../src/plans/models/plan.model');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function debugPublicPlans() {
    try {
        console.log('🔌 Connecting to MongoDB...');

        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB!\n');

        // Test the exact query from getPublicPlans
        const query = {
            isActive: true,
            isDeleted: false,
        };

        console.log('🔍 Testing query:', JSON.stringify(query, null, 2));
        console.log('');

        const plans = await Plan.find(query)
            .select("-stripe -paypal -analytics -createdBy -updatedBy")
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();

        console.log(`📦 Found ${plans.length} plans matching query\n`);

        if (plans.length === 0) {
            console.log('⚠️  No plans found with query conditions:');
            console.log('   - isActive: true');
            console.log('   - isDeleted: false\n');

            // Check all plans
            const allPlans = await Plan.find({}).lean();
            console.log(`📊 Total plans in database: ${allPlans.length}\n`);

            if (allPlans.length > 0) {
                console.log('📋 Plan Status Breakdown:');
                allPlans.forEach(plan => {
                    console.log(`   - ${plan.displayName || plan.name}:`);
                    console.log(`     isActive: ${plan.isActive}`);
                    console.log(`     isDeleted: ${plan.isDeleted !== undefined ? plan.isDeleted : 'undefined'}`);
                });
            }
        } else {
            // Group by planType
            const grouped = plans.reduce((acc, plan) => {
                if (!acc[plan.planType]) {
                    acc[plan.planType] = [];
                }
                acc[plan.planType].push({
                    name: plan.name,
                    displayName: plan.displayName,
                    planType: plan.planType,
                    category: plan.category,
                    isActive: plan.isActive,
                });
                return acc;
            }, {});

            console.log('📊 Grouped Plans by Type:');
            console.log(JSON.stringify(grouped, null, 2));
        }

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed.');
        process.exit(0);
    }
}

debugPublicPlans();
