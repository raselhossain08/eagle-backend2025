/**
 * Fix double-hashed passwords for users who set password during the bug
 * 
 * Run with: node scripts/fixDoubleHashedPassword.js <email> <new-password>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/user/models/user.model');

async function fixUserPassword(email, newPassword) {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        console.log(`🔍 Finding user: ${email}`);
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            console.error('❌ User not found');
            process.exit(1);
        }

        console.log('✅ User found:', {
            email: user.email,
            name: user.name,
            isPendingUser: user.isPendingUser,
            isEmailVerified: user.isEmailVerified
        });

        // Set new password (will be hashed by pre-save hook)
        user.password = newPassword;
        user.isPendingUser = false;
        user.isEmailVerified = true;
        user.activationToken = undefined;
        user.activationTokenExpiry = undefined;

        await user.save();

        console.log('✅ Password updated successfully!');
        console.log('✅ User can now login with the new password');

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Get email and password from command line
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
    console.error('Usage: node scripts/fixDoubleHashedPassword.js <email> <new-password>');
    console.error('Example: node scripts/fixDoubleHashedPassword.js user@example.com MyNewPass123');
    process.exit(1);
}

fixUserPassword(email, newPassword);
