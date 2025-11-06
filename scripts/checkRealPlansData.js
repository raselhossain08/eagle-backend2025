require('dotenv').config();
const mongoose = require('mongoose');

async function checkRealPlans() {
    try {
        console.log('✅ Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database\n');

        const db = mongoose.connection.db;
        const plansCollection = db.collection('plans');

        // Get all plans
        const plans = await plansCollection.find({}).toArray();
        console.log(`📋 Found ${plans.length} plans in collection\n`);

        if (plans.length > 0) {
            // Show first plan structure
            console.log('📄 Sample plan structure:');
            const samplePlan = plans[0];
            console.log(JSON.stringify(samplePlan, null, 2));

            console.log('\n📊 All plans summary:');
            plans.forEach((plan, index) => {
                console.log(`\n${index + 1}. ${plan.name || plan.displayName}`);
                console.log(`   - _id: ${plan._id}`);
                console.log(`   - isActive: ${plan.isActive}`);
                console.log(`   - planType: ${plan.planType}`);
                console.log(`   - category: ${plan.category}`);
                if (plan.pricing) {
                    console.log(`   - pricing: ${JSON.stringify(plan.pricing)}`);
                }
            });
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkRealPlans();
