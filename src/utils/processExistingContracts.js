const SignedContract = require("../models/signedContract.model");
const User = require("../user/models/user.model");
const crypto = require("crypto");
const emailService = require("../services/emailService");

// Utility function to process existing contracts and create user accounts
const processExistingContracts = async () => {
  try {
    console.log("🔄 Processing existing contracts to create user accounts...");

    // Find all completed contracts without userId
    const contractsWithoutUsers = await SignedContract.find({
      status: "completed",
      $or: [
        { userId: null },
        { userId: { $exists: false } }
      ]
    });

    console.log(`📋 Found ${contractsWithoutUsers.length} contracts without user accounts`);

    for (const contract of contractsWithoutUsers) {
      try {
        console.log(`\n🔄 Processing contract: ${contract._id}`);
        console.log(`📧 Email: ${contract.email}`);

        // Check if user already exists with this email
        let existingUser = await User.findOne({ email: contract.email.toLowerCase() });

        if (!existingUser) {
          console.log("👤 Creating new pending user account...");
          
          // Generate activation token
          const activationToken = crypto.randomBytes(32).toString('hex');
          const activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

          // Split name into firstName and lastName
          const nameParts = contract.name.trim().split(' ');
          const firstName = nameParts[0] || 'User';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          // Create pending user
          const pendingUserData = {
            firstName: firstName,
            lastName: lastName,
            email: contract.email.toLowerCase(),
            phone: contract.phone,
            isPendingUser: true,
            isEmailVerified: false,
            activationToken,
            activationTokenExpiry,
          };

          existingUser = await User.create(pendingUserData);
          console.log("✅ Pending user created:", existingUser._id);

          // Update contract with user ID
          contract.userId = existingUser._id;
          contract.isGuestContract = false;
          await contract.save();

          // Send password setup email
          console.log('📧 Attempting to send password setup email...');
          console.log('🔍 emailService type:', typeof emailService);
          console.log('🔍 Available methods:', Object.getOwnPropertyNames(emailService));
          
          await emailService.sendPasswordSetupEmail(
            existingUser.email,
            `${existingUser.firstName} ${existingUser.lastName}`.trim(),
            activationToken,
            contract.productType,
            process.env.FRONTEND_URL || 'http://localhost:3000'
          );

          console.log("📧 Password setup email sent successfully");

        } else if (existingUser.isPendingUser) {
          console.log("🔄 User exists as pending, updating activation token...");
          
          // Update activation token for existing pending user
          existingUser.activationToken = crypto.randomBytes(32).toString('hex');
          existingUser.activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await existingUser.save();

          // Update contract with user ID if not already set
          if (!contract.userId) {
            contract.userId = existingUser._id;
            contract.isGuestContract = false;
            await contract.save();
          }

          // Send password setup email
          await emailService.sendPasswordSetupEmail(
            existingUser.email,
            existingUser.name,
            existingUser.activationToken,
            contract.productType,
            process.env.FRONTEND_URL || 'http://localhost:3000'
          );

          console.log("📧 Updated password setup email sent");

        } else {
          console.log("✅ User already exists and is active");
          
          // Update contract with user ID if not already set
          if (!contract.userId) {
            contract.userId = existingUser._id;
            contract.isGuestContract = false;
            await contract.save();
          }

          // Send welcome email for existing users
          await emailService.sendWelcomeEmail(
            existingUser.email,
            existingUser.name,
            contract.productType,
            process.env.FRONTEND_URL || 'http://localhost:3000'
          );

          console.log("📧 Welcome email sent to existing user");
        }

      } catch (error) {
        console.error(`❌ Error processing contract ${contract._id}:`, error);
        continue; // Continue with next contract
      }
    }

    console.log("✅ Finished processing existing contracts");
    return { success: true, processed: contractsWithoutUsers.length };

  } catch (error) {
    console.error("❌ Error in processExistingContracts:", error);
    return { success: false, error: error.message };
  }
};

// API endpoint to manually trigger processing
const processExistingContractsEndpoint = async (req, res) => {
  try {
    const result = await processExistingContracts();
    
    if (result.success) {
      res.json({
        success: true,
        message: `Successfully processed ${result.processed} contracts`,
        processed: result.processed
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to process existing contracts",
        error: result.error
      });
    }
  } catch (error) {
    console.error("❌ Error in processExistingContractsEndpoint:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  processExistingContracts,
  processExistingContractsEndpoint
};
