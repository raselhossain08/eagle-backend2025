/**
 * Script to check Plans collection data in MongoDB
 * Run with: node scripts/checkPlansData.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../src/plans/models/plan.model');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function checkPlansData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        console.log('📍 URI:', MONGODB_URI ? MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@') : 'NOT SET');

        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Connected to MongoDB successfully!\n');

        // Get total count
        const totalCount = await Plan.countDocuments();
        console.log('📊 PLANS COLLECTION STATISTICS');
        console.log('═══════════════════════════════════════');
        console.log(`📦 Total Plans: ${totalCount}\n`);

        if (totalCount === 0) {
            console.log('⚠️  No plans found in the database.');
            console.log('💡 You may need to seed the database with initial plan data.\n');
        } else {
            // Get all plans
            console.log('📋 FETCHING ALL PLANS...\n');
            const plans = await Plan.find({}).lean();

            // Display summary
            console.log('📊 PLANS SUMMARY');
            console.log('═══════════════════════════════════════\n');

            plans.forEach((plan, index) => {
                console.log(`${index + 1}. ${plan.displayName || plan.name}`);
                console.log(`   📌 ID: ${plan._id}`);
                console.log(`   🏷️  Name: ${plan.name}`);
                console.log(`   📝 Type: ${plan.planType || 'N/A'}`);
                console.log(`   📂 Category: ${plan.category || 'N/A'}`);
                console.log(`   💰 Pricing:`);

                if (plan.pricing) {
                    if (plan.pricing.monthly) {
                        console.log(`      - Monthly: $${plan.pricing.monthly.price || 0}`);
                    }
                    if (plan.pricing.annual) {
                        console.log(`      - Annual: $${plan.pricing.annual.price || 0}`);
                    }
                    if (plan.pricing.oneTime) {
                        console.log(`      - One-time: $${plan.pricing.oneTime.price || 0}`);
                    }
                }

                if (plan.features && plan.features.length > 0) {
                    console.log(`   ✨ Features: ${plan.features.length} items`);
                }

                console.log(`   🔄 Status: ${plan.isActive ? '✅ Active' : '❌ Inactive'}`);
                console.log(`   📅 Created: ${plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : 'N/A'}`);
                console.log('');
            });

            // Group by type
            console.log('\n📊 PLANS BY TYPE');
            console.log('═══════════════════════════════════════');
            const byType = plans.reduce((acc, plan) => {
                const type = plan.planType || 'unknown';
                acc[type] = (acc[type] || 0) + 1;
                return acc;
            }, {});

            Object.entries(byType).forEach(([type, count]) => {
                console.log(`   ${type}: ${count} plan(s)`);
            });

            // Group by category
            console.log('\n📊 PLANS BY CATEGORY');
            console.log('═══════════════════════════════════════');
            const byCategory = plans.reduce((acc, plan) => {
                const category = plan.category || 'unknown';
                acc[category] = (acc[category] || 0) + 1;
                return acc;
            }, {});

            Object.entries(byCategory).forEach(([category, count]) => {
                console.log(`   ${category}: ${count} plan(s)`);
            });

            // Active vs Inactive
            console.log('\n📊 ACTIVE STATUS');
            console.log('═══════════════════════════════════════');
            const active = plans.filter(p => p.isActive).length;
            const inactive = plans.filter(p => !p.isActive).length;
            console.log(`   ✅ Active: ${active}`);
            console.log(`   ❌ Inactive: ${inactive}`);

            // Full details option
            console.log('\n\n📄 DETAILED PLAN DATA (JSON)');
            console.log('═══════════════════════════════════════');
            console.log(JSON.stringify(plans, null, 2));
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

// Run the script
checkPlansData();
