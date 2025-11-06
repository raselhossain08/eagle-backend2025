const mongoose = require('mongoose');
require('dotenv').config();

const checkPlansCollection = async () => {
    try {
        const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-backend';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to database');
        console.log('');

        // List all collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);

        console.log('📋 Looking for plan-related collections...\n');

        const planCollections = collectionNames.filter(name =>
            name.toLowerCase().includes('plan') ||
            name.toLowerCase().includes('membership')
        );

        if (planCollections.length > 0) {
            console.log('✅ Found plan collections:');
            planCollections.forEach(name => console.log(`   - ${name}`));
            console.log('');

            // Check each collection for documents
            for (const collectionName of planCollections) {
                const count = await mongoose.connection.db.collection(collectionName).countDocuments();
                console.log(`📊 ${collectionName}: ${count} documents`);

                if (count > 0) {
                    const sample = await mongoose.connection.db.collection(collectionName).findOne();
                    console.log(`   Sample document fields:`, Object.keys(sample).join(', '));
                    console.log('');
                }
            }
        } else {
            console.log('❌ No plan-related collections found');
            console.log('\n📋 All collections:');
            collectionNames.forEach(name => console.log(`   - ${name}`));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkPlansCollection();
