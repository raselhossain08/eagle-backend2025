require("dotenv").config();
const mongoose = require("mongoose");

async function addIsDeletedFieldToPlans() {
    try {
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log("✅ Connected to MongoDB\n");

        const db = mongoose.connection.db;
        const plansCollection = db.collection("plans");

        // Update all plans to add isDeleted field
        const result = await plansCollection.updateMany(
            { isDeleted: { $exists: false } }, // Only update plans that don't have the field
            { $set: { isDeleted: false } }
        );

        console.log("📊 Migration Results:");
        console.log(`✅ Matched Documents: ${result.matchedCount}`);
        console.log(`✅ Modified Documents: ${result.modifiedCount}`);

        // Verify the update
        const totalPlans = await plansCollection.countDocuments();
        const withIsDeleted = await plansCollection.countDocuments({
            isDeleted: { $exists: true }
        });

        console.log("\n📋 Verification:");
        console.log(`Total Plans: ${totalPlans}`);
        console.log(`Plans with isDeleted field: ${withIsDeleted}`);

        // Show sample plans
        const samplePlans = await plansCollection
            .find({})
            .limit(3)
            .toArray();

        console.log("\n✅ Sample Plans After Migration:");
        samplePlans.forEach((plan, index) => {
            console.log(`${index + 1}. ${plan.displayName}: isDeleted = ${plan.isDeleted}`);
        });

        await mongoose.disconnect();
        console.log("\n✅ Migration Complete!");

    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

addIsDeletedFieldToPlans();
