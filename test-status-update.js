require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/user/models/user.model');

async function testStatusUpdate() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/eagle-db');
        console.log('✅ Connected to MongoDB');

        // Get first user
        const user = await User.findOne();
        if (!user) {
            console.log('❌ No users found in database');
            process.exit(1);
        }

        console.log('📋 Original User:', {
            id: user._id,
            name: user.name,
            isActive: user.isActive,
            isBlocked: user.isBlocked,
            emailVerified: user.emailVerified
        });

        // Try to update
        const updateData = {
            isActive: false,
            isBlocked: false
        };

        console.log('🔄 Attempting update with:', updateData);

        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        console.log('✅ Updated User:', {
            id: updatedUser._id,
            name: updatedUser.name,
            isActive: updatedUser.isActive,
            isBlocked: updatedUser.isBlocked,
            emailVerified: updatedUser.emailVerified
        });

        // Verify from database
        const verifyUser = await User.findById(user._id);
        console.log('🔍 Verified from DB:', {
            id: verifyUser._id,
            name: verifyUser.name,
            isActive: verifyUser.isActive,
            isBlocked: verifyUser.isBlocked,
            emailVerified: verifyUser.emailVerified
        });

        console.log('✅ Status update test completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

testStatusUpdate();
