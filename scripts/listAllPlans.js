require('dotenv').config();
const mongoose = require('mongoose');
const MembershipPlan = require('../src/subscription/models/membershipPlan.model');

async function listAllPlans() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const plans = await MembershipPlan.find({}).lean();

        console.log(`📋 Found ${plans.length} membership plan(s) in database\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📦 ALL MEMBERSHIP PLANS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        plans.forEach((plan, index) => {
            console.log(`Plan ${index + 1}:`);
            console.log(`   ID: ${plan._id}`);
            console.log(`   name: "${plan.name}"`);
            console.log(`   displayName: "${plan.displayName || 'N/A'}"`);
            console.log(`   planType: "${plan.planType || 'N/A'}"`);
            console.log(`   category: "${plan.category || 'N/A'}"`);
            console.log(`   accessLevel: ${plan.accessLevel || 'N/A'}`);
            console.log(`   isActive: ${plan.isActive !== false ? 'Yes' : 'No'}`);

            // Show pricing
            if (plan.pricing) {
                console.log(`   Pricing:`);
                if (plan.pricing.monthly?.price !== undefined) {
                    console.log(`      Monthly: $${plan.pricing.monthly.price}`);
                }
                if (plan.pricing.annual?.price !== undefined) {
                    console.log(`      Annual: $${plan.pricing.annual.price}`);
                }
                if (plan.pricing.oneTime?.price !== undefined) {
                    console.log(`      One-Time: $${plan.pricing.oneTime.price}`);
                }
            }

            console.log('   ─────────────────────────────────────────────────────────────\n');
        });

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n💡 RECOMMENDED SUBSCRIPTION MAPPING:');
        console.log('   Use the "displayName" field for user subscriptions:\n');

        plans.forEach((plan) => {
            const identifier = plan.name || plan.category || 'unknown';
            const displayName = plan.displayName || plan.name || 'Unknown';
            console.log(`   "${identifier}" → "${displayName}"`);
        });

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

listAllPlans();
