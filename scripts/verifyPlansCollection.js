require("dotenv").config();
const mongoose = require("mongoose");
const Plan = require("../src/plans/models/plan.model");

async function verifyPlansCollection() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error("MongoDB URI not found in environment variables");
        }
        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB");

        // Check model details
        console.log("\n📋 Model Details:");
        console.log(`Model Name: ${Plan.modelName}`);
        console.log(`Collection Name: ${Plan.collection.name}`);

        // Count total plans
        const totalPlans = await Plan.countDocuments();
        console.log(`\n📊 Total Plans: ${totalPlans}`);

        // Count active plans
        const activePlans = await Plan.countDocuments({
            isActive: true,
            isDeleted: false
        });
        console.log(`✅ Active Plans: ${activePlans}`);

        // Get sample plans
        const samplePlans = await Plan.find({ isDeleted: false })
            .limit(3)
            .select("name displayName planType category isActive")
            .lean();

        console.log("\n📝 Sample Plans:");
        samplePlans.forEach((plan, index) => {
            console.log(`${index + 1}. ${plan.displayName} (${plan.name})`);
            console.log(`   Type: ${plan.planType}, Category: ${plan.category}, Active: ${plan.isActive}`);
        });

        // Test the query used by getAllPlans service
        const query = { isDeleted: false };
        const testPlans = await Plan.find(query)
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        console.log(`\n🔍 Test Query Result: Found ${testPlans.length} plans`);

        // Check for deleted plans
        const deletedPlans = await Plan.countDocuments({ isDeleted: true });
        console.log(`\n🗑️ Deleted Plans: ${deletedPlans}`);

        await mongoose.disconnect();
        console.log("\n✅ Verification Complete!");

    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

verifyPlansCollection();
