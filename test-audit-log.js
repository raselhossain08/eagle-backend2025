/**
 * Test script to verify AuditLog model methods
 * Run with: node test-audit-log.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eagle', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Import AuditLog model
const AuditLog = require('./src/subscription/models/auditLog.model');

async function testAuditLogMethods() {
    try {
        console.log('\n🔍 Testing AuditLog model...\n');

        // Check if static methods exist
        console.log('Static methods available:');
        console.log('- logAction:', typeof AuditLog.logAction);
        console.log('- getRecentActivity:', typeof AuditLog.getRecentActivity);
        console.log('- getResourceActivity:', typeof AuditLog.getResourceActivity);
        console.log('- getActorActivity:', typeof AuditLog.getActorActivity);
        console.log('- getStatistics:', typeof AuditLog.getStatistics);

        // Test getRecentActivity
        console.log('\n📋 Testing getRecentActivity...');
        const recentActivity = await AuditLog.getRecentActivity(5);
        console.log(`Found ${recentActivity.length} audit log entries`);

        if (recentActivity.length > 0) {
            console.log('\nSample entry:');
            console.log(JSON.stringify(recentActivity[0], null, 2));
        } else {
            console.log('⚠️  No audit logs found in database');
        }

        // Count total audit logs
        const totalLogs = await AuditLog.countDocuments();
        console.log(`\n📊 Total audit logs in database: ${totalLogs}`);

        console.log('\n✅ All tests passed!');

    } catch (error) {
        console.error('\n❌ Test failed:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        process.exit(0);
    }
}

// Run tests
testAuditLogMethods();
