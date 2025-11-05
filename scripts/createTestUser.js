const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../src/models/user.model');
const AdminUser = require('../src/admin/models/adminUser.model');

const createTestUser = async () => {
  try {
    // Get MongoDB URI from environment
    const mongoUri = process.env.MONGODB_URI || 
                     process.env.MONGO_URI || 
                     'mongodb://localhost:27017/eagle-investors';
    
    console.log('Connecting to database...');
    console.log('Using URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')); // Hide password in log
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to database\n');
    
    // ===================================
    // Create Regular Test User
    // ===================================
    const regularUserEmail = 'test@eagle.com';
    let existingUser = await User.findOne({ email: regularUserEmail });
    
    if (existingUser) {
      console.log('📌 Regular test user already exists:');
      console.log('   Email:', existingUser.email);
      console.log('   User ID:', existingUser._id);
      console.log('   Role:', existingUser.role);
      console.log('   Subscription:', existingUser.subscription);
    } else {
      // Create test user (password will be hashed by pre-save hook)
      const testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: regularUserEmail,
        password: 'password123', // Will be hashed by pre-save hook
        role: 'subscriber',
        subscription: 'Diamond',
        subscriptionStatus: 'active',
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
        emailVerified: true,
        phone: '+1234567890'
      });
      
      await testUser.save();
      console.log('✅ Regular test user created successfully!');
      console.log('   Email: test@eagle.com');
      console.log('   Password: password123');
      console.log('   User ID:', testUser._id);
      console.log('   Role:', testUser.role);
      console.log('   Subscription:', testUser.subscription);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // ===================================
    // Create Admin Test User
    // ===================================
    const adminUserEmail = 'admin@eagle.com';
    let existingAdmin = await AdminUser.findOne({ email: adminUserEmail });
    
    if (existingAdmin) {
      console.log('📌 Admin test user already exists:');
      console.log('   Email:', existingAdmin.email);
      console.log('   User ID:', existingAdmin._id);
      console.log('   Admin Level:', existingAdmin.adminLevel);
      console.log('   Department:', existingAdmin.department);
    } else {
      // Create admin user (password will be hashed by pre-save hook)
      const testAdmin = new AdminUser({
        firstName: 'Admin',
        lastName: 'User',
        email: adminUserEmail,
        username: 'admin_test',
        password: 'Admin@123', // Will be hashed by pre-save hook
        phone: '+1234567890',
        adminLevel: 'super_admin',
        department: 'technology',
        isActive: true,
        isEmailVerified: true,
        permissions: [
          {
            module: 'users',
            actions: ['create', 'read', 'update', 'delete']
          },
          {
            module: 'subscriptions',
            actions: ['create', 'read', 'update', 'delete']
          },
          {
            module: 'analytics',
            actions: ['read', 'execute']
          }
        ]
      });
      
      await testAdmin.save();
      console.log('✅ Admin test user created successfully!');
      console.log('   Email: admin@eagle.com');
      console.log('   Username: admin_test');
      console.log('   Password: Admin@123');
      console.log('   User ID:', testAdmin._id);
      console.log('   Admin Level:', testAdmin.adminLevel);
      console.log('   Department:', testAdmin.department);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Test users setup complete!');
    console.log('='.repeat(50) + '\n');
    
    console.log('📝 Login Credentials:');
    console.log('\n🔹 Regular User:');
    console.log('   Email: test@eagle.com');
    console.log('   Password: password123');
    console.log('\n🔹 Admin User:');
    console.log('   Email: admin@eagle.com');
    console.log('   Password: Admin@123');
    console.log('\n');
    
  } catch (error) {
    console.error('\n❌ Error creating test users:', error.message);
    if (error.errors) {
      console.error('\nValidation Errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from database');
  }
};

// Run the script
createTestUser();