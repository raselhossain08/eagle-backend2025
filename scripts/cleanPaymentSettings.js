require('dotenv').config();
const mongoose = require('mongoose');

const cleanPaymentSettings = async () => {
    try {
        console.log('🔄 Cleaning corrupted payment settings...\n');

        const mongoUri = process.env.MONGO_URI;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Delete all payment settings documents
        const result = await mongoose.connection.db.collection('paymentsettings').deleteMany({});

        console.log(`🗑️  Deleted ${result.deletedCount} document(s)`);
        console.log('✅ Database cleaned successfully!\n');
        console.log('Now you can run: node scripts/migratePaymentSettings.js');

        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('❌ Cleaning failed:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

cleanPaymentSettings();
