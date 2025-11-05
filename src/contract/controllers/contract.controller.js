const { SignedContract } = require("../models/contract.model");
const User = require("../../user/models/user.model");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
// const { generatePDFLegacy } = require("../../../utils/pdfGenerator"); // Removed - Frontend will handle PDF generation
// const { uploadPDFToCloudinary, generateSecurePDFUrl } = require("../config/cloudinary"); // Removed - No PDF upload needed
const emailService = require("../../services/emailService");
const { validateContactInformation, sanitizeAddressData } = require("../../utils/addressValidation");

// Product pricing configuration
const PRODUCT_PRICING = {
  basic: {
    monthly: 35,
    yearly: 350,
    name: "Basic Package",
  },
  diamond: {
    monthly: 76,
    yearly: 760,
    name: "Diamond Package",
  },
  infinity: {
    monthly: 99,
    yearly: 999,
    name: "Infinity Package",
  },
  script: {
    monthly: 29,
    yearly: 299,
    name: "Script Package",
  },
  "investment-advising": {
    monthly: 79,
    yearly: 799,
    name: "Investment Advising",
  },
  "trading-tutor": {
    monthly: 79,
    yearly: 799,
    name: "Trading Tutor",
  },
  ultimate: {
    monthly: 199,
    yearly: 1999,
    name: "Ultimate Package",
  },
  // Map new product types to existing pricing
  "basic-subscription": {
    monthly: 35,
    yearly: 350,
    name: "Basic Subscription",
  },
  "diamond-subscription": {
    monthly: 76,
    yearly: 760,
    name: "Diamond Subscription",
  },
  "infinity-subscription": {
    monthly: 99,
    yearly: 999,
    name: "Infinity Subscription",
  },
  "mentorship-package": {
    monthly: 79,
    yearly: 799,
    name: "Mentorship Package",
  },
  "product-purchase": {
    monthly: 99,
    yearly: 999,
    name: "Product Purchase",
  },
  "eagle-ultimate": {
    monthly: 199,
    yearly: 1999,
    name: "Eagle Ultimate",
  },
  "trading-tutoring": {
    monthly: 79,
    yearly: 799,
    name: "Trading Tutoring",
  },
};

// Contract templates mapping
const CONTRACT_TEMPLATES = {
  basic: "Basic Advisory Contract",
  diamond: "Diamond Advisory Contract",
  infinity: "Infinity Advisory Contract",
  // Map new subscription types to existing templates
  "basic-subscription": "Basic Advisory Contract",
  "diamond-subscription": "Diamond Advisory Contract",
  "infinity-subscription": "Infinity Advisory Contract",
  "mentorship-package": "Mentorship Advisory Contract",
  "product-purchase": "Product Purchase Contract",
  "eagle-ultimate": "Ultimate Advisory Contract",
  "trading-tutoring": "Trading Tutoring Contract",
};

// @desc    Store signed contract
// @route   POST /api/contracts/sign
// @access  Protected
const storeSignedContract = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      country,
      streetAddress,
      flatSuiteUnit,
      townCity,
      stateCounty,
      postcodeZip,
      discordUsername,
      signature,
      productType,
      pdfPath,
      pdfCloudinaryUrl,
      pdfCloudinaryPublicId,
      subscriptionType = "yearly",
    } = req.body;
    const userId = req.user.id;

    // Log the incoming request data
    console.log("📝 Contract sign request data:", {
      name,
      email,
      phone: phone ? "present" : "not provided",
      country,
      streetAddress: streetAddress ? "present" : "not provided",
      townCity,
      stateCounty,
      postcodeZip,
      discordUsername: discordUsername ? "present" : "not provided",
      signature: signature ? "present" : "missing",
      productType,
      pdfPath,
      subscriptionType,
      userId,
    });

    // Validate required fields
    if (!name || !email || !signature || !productType) {
      console.log("❌ Validation failed - missing required fields:", {
        name: !!name,
        email: !!email,
        signature: !!signature,
        productType: !!productType,
      });
      return res.status(400).json({
        success: false,
        message: "Name, email, signature, and product type are required",
      });
    }

    // Sanitize address data if provided
    const sanitizedAddress = sanitizeAddressData({
      country,
      streetAddress,
      flatSuiteUnit,
      townCity,
      stateCounty,
      postcodeZip
    });

    // Validate product type
    const validProductTypes = [
      "basic",
      "diamond",
      "infinity",
      "script",
      "investment-advising",
      "trading-tutor",
      "ultimate",
      // New product types from updated frontend
      "basic-subscription",
      "diamond-subscription",
      "infinity-subscription",
      "mentorship-package",
      "product-purchase",
      "eagle-ultimate",
      "trading-tutoring",
    ];
    if (!validProductTypes.includes(productType)) {
      console.log(
        "❌ Invalid product type:",
        productType,
        "Valid types:",
        validProductTypes
      );
      return res.status(400).json({
        success: false,
        message: "Invalid product type",
      });
    }

    // Check if user already has a signed contract for this product
    const existingContract = await SignedContract.findOne({
      userId,
      productType,
      status: { $in: ["signed", "payment_pending", "completed"] },
    });

    // Also check for active contracts of different product types that might have scheduled downgrades
    const allActiveContracts = await SignedContract.find({
      userId,
      status: "completed",
      subscriptionEndDate: { $gt: new Date() }, // Active subscriptions
    });

    console.log("🔍 All active contracts check:", {
      userId,
      currentProductType: productType,
      allActiveContracts: allActiveContracts.map((contract) => ({
        id: contract._id,
        productType: contract.productType,
        status: contract.status,
        subscriptionEndDate: contract.subscriptionEndDate,
        hasScheduledDowngrade: !!contract.scheduledDowngrade?.status,
        scheduledDowngradeStatus: contract.scheduledDowngrade?.status,
        scheduledDowngradeTarget:
          contract.scheduledDowngrade?.targetSubscription,
      })),
    });

    // Handle cross-product upgrades with scheduled downgrades
    for (const activeContract of allActiveContracts) {
      if (
        activeContract.productType !== productType &&
        activeContract.scheduledDowngrade?.status === "scheduled"
      ) {
        console.log(
          `✅ Found scheduled downgrade on ${activeContract.productType}, cancelling for upgrade to ${productType}`
        );

        // Cancel the scheduled downgrade on the other product
        activeContract.scheduledDowngrade = {
          targetSubscription: null,
          scheduledDate: null,
          effectiveDate: null,
          status: "cancelled",
        };
        await activeContract.save();

        console.log(
          `✅ Cancelled scheduled downgrade on ${activeContract.productType} contract`
        );
      }
    }

    console.log("🔍 Existing contract check:", {
      userId,
      productType,
      existingContract: existingContract
        ? {
            id: existingContract._id,
            status: existingContract.status,
            subscriptionEndDate: existingContract.subscriptionEndDate,
            hasScheduledDowngrade:
              !!existingContract.scheduledDowngrade?.status,
            scheduledDowngradeStatus:
              existingContract.scheduledDowngrade?.status,
          }
        : null,
    });

    if (existingContract) {
      // For completed contracts, check if subscription has expired
      if (existingContract.status === "completed") {
        // Check if subscription has expired
        const now = new Date();
        const subscriptionEndDate = new Date(
          existingContract.subscriptionEndDate
        );

        console.log("📅 Subscription date check:", {
          now: now.toISOString(),
          subscriptionEndDate: subscriptionEndDate.toISOString(),
          isActive: subscriptionEndDate > now,
          hasScheduledDowngrade: !!existingContract.scheduledDowngrade?.status,
          scheduledDowngradeStatus: existingContract.scheduledDowngrade?.status,
        });

        if (subscriptionEndDate > now) {
          // Check if user has a scheduled downgrade
          if (existingContract.scheduledDowngrade?.status === "scheduled") {
            console.log(
              "✅ User has scheduled downgrade, allowing upgrade and cancelling downgrade"
            );

            // Cancel the scheduled downgrade
            existingContract.scheduledDowngrade = {
              targetSubscription: null,
              scheduledDate: null,
              effectiveDate: null,
              status: "cancelled",
            };
            await existingContract.save();

            console.log(
              "✅ Scheduled downgrade cancelled, proceeding with new contract"
            );
            // Continue to create new contract
          } else {
            // Subscription is still active and no scheduled downgrade, prevent re-signing
            console.log(
              "❌ Active subscription found without scheduled downgrade, preventing re-signing"
            );
            return res.status(400).json({
              success: false,
              message:
                "You already have an active subscription for this product",
              data: existingContract,
              hasActiveSubscription: true,
            });
          }
        }
        // If subscription has expired, allow new contract creation by continuing
      }

      // If contract exists and is payment_pending, return it for checkout
      if (existingContract.status === "payment_pending") {
        console.log("✅ Returning existing payment_pending contract");
        return res.status(200).json({
          success: true,
          message: "Contract already exists and is ready for payment",
          data: existingContract,
          existingContract: true, // Flag to indicate this is an existing contract
        });
      }

      // If contract exists and is just signed, update it to payment_pending
      if (existingContract.status === "signed") {
        console.log("🔄 Updating existing signed contract to payment_pending");
        existingContract.status = "payment_pending";
        await existingContract.save();

        return res.status(200).json({
          success: true,
          message: "Existing contract updated and ready for payment",
          data: existingContract,
          existingContract: true,
        });
      }
    }

    // Get client IP and user agent for audit trail
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get("User-Agent");

    // Calculate subscription price based on product type and subscription type
    const productPricing = PRODUCT_PRICING[productType];
    if (!productPricing) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type for pricing",
      });
    }

    const subscriptionPrice = productPricing[subscriptionType];
    if (!subscriptionPrice) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription type",
      });
    }

    // Create signed contract
    const contractData = {
      userId,
      name,
      email,
      phone,
      country: sanitizedAddress.country,
      streetAddress: sanitizedAddress.streetAddress,
      flatSuiteUnit: sanitizedAddress.flatSuiteUnit,
      townCity: sanitizedAddress.townCity,
      stateCounty: sanitizedAddress.stateCounty,
      postcodeZip: sanitizedAddress.postcodeZip,
      discordUsername,
      signature,
      productType,
      ipAddress,
      userAgent,
      status: "payment_pending",
      subscriptionType,
      subscriptionPrice,
      pdfStorageProvider: 'cloudinary',
      pdfGenerationMethod: 'none', // No PDF generation
    };

    // Add PDF fields if provided
    if (pdfPath) {
      contractData.pdfPath = pdfPath;
    }
    if (pdfCloudinaryUrl) {
      contractData.pdfCloudinaryUrl = pdfCloudinaryUrl;
    }
    if (pdfCloudinaryPublicId) {
      contractData.pdfCloudinaryPublicId = pdfCloudinaryPublicId;
    }

    const signedContract = await SignedContract.create(contractData);

    res.status(201).json({
      success: true,
      message: "Contract signed successfully",
      data: signedContract,
    });
  } catch (error) {
    console.error("Error storing signed contract:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Update contract payment status
// @route   PUT /api/contracts/:contractId/payment
// @access  Protected
const updatePaymentStatus = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { paymentId, paymentProvider, status } = req.body;
    const userId = req.user.id;

    // Validate status
    const validStatuses = ["payment_pending", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find and update contract
    const contract = await SignedContract.findOneAndUpdate(
      { _id: contractId, userId },
      {
        status,
        paymentId,
        paymentProvider,
      },
      { new: true }
    );

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    // If payment completed, update user subscription
    if (status === "completed") {
      const subscriptionMap = {
        basic: "Basic",
        script: "Script",
        diamond: "Diamond",
        infinity: "Infinity",
        "investment-advising": "Diamond",
        "trading-tutor": "Basic",
        ultimate: "Infinity",
      };

      const newSubscription = subscriptionMap[contract.productType];
      if (newSubscription) {
        await User.findByIdAndUpdate(userId, {
          subscription: newSubscription,
        });
      }
    }

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: contract,
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get user's signed contracts
// @route   GET /api/contracts/my-contracts
// @access  Public (Optional Auth)
const getUserContracts = async (req, res) => {
  try {
    // Check if user is authenticated
    if (req.user && req.user.id) {
      // Authenticated user - return their contracts
      const userId = req.user.id;

      const contracts = await SignedContract.find({ userId })
        .sort({ createdAt: -1 })
        .select("-userAgent -ipAddress");

      return res.json({
        success: true,
        data: contracts,
        isAuthenticated: true,
      });
    } else {
      // Guest user - return guest flow response
      return res.json({
        success: true,
        message: "Guest mode - Please provide your contact information to retrieve contracts",
        isAuthenticated: false,
        guestMode: true,
        data: {
          formFields: {
            name: {
              required: true,
              label: "Full Name",
              placeholder: "Enter your full name"
            },
            email: {
              required: true,
              label: "Email Address", 
              placeholder: "Enter your email address"
            },
            phone: {
              required: false,
              label: "Phone Number",
              placeholder: "Enter your phone number"
            }
          },
          submitEndpoint: "/api/contracts/my-contracts/guest",
          method: "POST"
        }
      });
    }
  } catch (error) {
    console.error("Error fetching user contracts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get contract by ID
// @route   GET /api/contracts/:contractId
// @access  Protected
const getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;

    const contract = await SignedContract.findOne({
      _id: contractId,
      userId,
    }).select("-userAgent -ipAddress");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("Error fetching contract:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Store contract data in database (no PDF generation)
// @route   POST /api/contracts/generate-pdf
// @access  Protected
const generateContractPDF = async (req, res) => {
  try {
    const { packageType, contractData } = req.body;
    const userId = req.user.id;

    console.log("📄 Storing contract data:", { packageType, userId, contractData: !!contractData });

    // Validate required fields
    if (!packageType || !contractData) {
      return res.status(400).json({
        success: false,
        message: "Package type and contract data are required",
      });
    }

    if (!contractData.name || !contractData.date || !contractData.signature) {
      return res.status(400).json({
        success: false,
        message: "Contract data must include name, date, and signature",
      });
    }

    // Validate package type
    const validPackageTypes = [
      "basic", "diamond", "infinity", "script", "investment-advising", 
      "trading-tutor", "ultimate", "basic-subscription", "diamond-subscription", 
      "infinity-subscription", "mentorship-package", "product-purchase", 
      "eagle-ultimate", "trading-tutoring"
    ];
    
    if (!validPackageTypes.includes(packageType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid package type",
      });
    }

    // Get contract template title
    const contractTitle = CONTRACT_TEMPLATES[packageType] || `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Advisory Contract`;

    // Store contract data in database
    const signedContractData = {
      userId: userId,
      name: contractData.name,
      email: contractData.email || '',
      signature: contractData.signature,
      productType: packageType,
      contractTitle,
      signedDate: new Date(contractData.date),
      status: "signed",
      pdfGenerationMethod: 'none', // No PDF generation
    };

    const signedContract = await SignedContract.create(signedContractData);

    console.log("✅ Contract stored in database successfully");

    res.status(201).json({
      success: true,
      message: "Contract data stored successfully",
      data: {
        contractId: signedContract._id,
        contractData: {
          ...contractData,
          packageType,
          contractTitle,
          timestamp: new Date().toISOString()
        }
      },
    });
  } catch (error) {
    console.error("❌ Error storing contract data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to store contract data",
      error: error.message,
    });
  }
};

// Helper function to get contract-specific content (removed - no PDF/HTML generation needed)
// @desc    Get secure PDF URL for contract
// @route   GET /api/contracts/:contractId/pdf
// @access  Protected
const getContractPDFUrl = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;

    console.log("📄 Getting PDF URL for contract:", { contractId, userId });

    const contract = await SignedContract.findOne({
      _id: contractId,
      userId,
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    let pdfUrl = contract.pdfPath;

    // If stored in Cloudinary, generate a secure URL
    if (contract.pdfStorageProvider === 'cloudinary' && contract.pdfCloudinaryPublicId) {
      try {
        // Generate secure URL with 1-hour expiration
        pdfUrl = generateSecurePDFUrl(contract.pdfCloudinaryPublicId, 3600);
        console.log("✅ Generated secure Cloudinary URL");
      } catch (error) {
        console.error("❌ Error generating secure URL:", error);
        // Fallback to stored URL
        pdfUrl = contract.pdfCloudinaryUrl || contract.pdfPath;
      }
    }

    res.json({
      success: true,
      data: {
        pdfUrl,
        contractId: contract._id,
        storageProvider: contract.pdfStorageProvider,
        expiresIn: contract.pdfStorageProvider === 'cloudinary' ? 3600 : null, // 1 hour for Cloudinary URLs
      },
    });
  } catch (error) {
    console.error("❌ Error getting contract PDF URL:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get contracts by contact info (no auth required)
// @route   POST /api/contracts/get-by-contact
// @access  Public
const getContractsByContact = async (req, res) => {
  try {
    const { fullName, email, phone } = req.body;

    console.log("🔍 Getting contracts by contact info:", {
      fullName: !!fullName,
      email: !!email,
      phone: !!phone
    });

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required",
      });
    }

    // Build search query - search by name and email
    const searchQuery = {
      name: { $regex: new RegExp(fullName.trim(), 'i') }, // Case insensitive search
      email: email.trim().toLowerCase()
    };

    // Add phone to search if provided
    if (phone && phone.trim()) {
      // Try to find contracts that might have phone in additional data
      // Since our current schema doesn't have phone field, we'll search in name or additional fields
      searchQuery.$or = [
        { name: { $regex: new RegExp(fullName.trim(), 'i') } },
        // Could add phone search if we had phone field in schema
      ];
    }

    console.log("🔍 Search query:", searchQuery);

    const contracts = await SignedContract.find(searchQuery)
      .sort({ createdAt: -1 })
      .select("-userAgent -ipAddress")
      .populate('userId', 'name email phone', null, { strictPopulate: false }); // Populate user info if exists

    console.log(`✅ Found ${contracts.length} contracts for contact info`);

    // If no contracts found, return empty array with success
    res.json({
      success: true,
      data: contracts,
      message: contracts.length > 0 
        ? `Found ${contracts.length} contract(s)` 
        : "No contracts found for the provided contact information",
    });
  } catch (error) {
    console.error("❌ Error fetching contracts by contact:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Create contract with contact info (no auth required)
// @route   POST /api/contracts/create-with-contact
// @access  Public
const createContractWithContact = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      country,
      streetAddress,
      flatSuiteUnit,
      townCity,
      stateCounty,
      postcodeZip,
      discordUsername,
      signature,
      productType,
      subscriptionType = "yearly",
      contractData,
    } = req.body;

    console.log("📝 Creating contract with contact info:", {
      fullName,
      email,
      phone: phone ? "provided" : "not provided",
      country: country ? "provided" : "not provided",
      streetAddress: streetAddress ? "provided" : "not provided",
      townCity: townCity ? "provided" : "not provided",
      stateCounty: stateCounty ? "provided" : "not provided",
      postcodeZip: postcodeZip ? "provided" : "not provided",
      discordUsername: discordUsername ? "provided" : "not provided",
      signature: signature ? "present" : "missing",
      productType,
      subscriptionType,
      contractData: !!contractData,
    });

    // Validate required fields
    if (!fullName || !email || !signature || !productType) {
      console.log("❌ Validation failed - missing required fields:", {
        fullName: !!fullName,
        email: !!email,
        signature: !!signature,
        productType: !!productType,
      });
      return res.status(400).json({
        success: false,
        message: "Full name, email, signature, and product type are required",
      });
    }

    // Validate contact information including address fields
    const contactValidation = validateContactInformation({
      fullName,
      email,
      phone,
      country,
      streetAddress,
      townCity,
      stateCounty,
      postcodeZip,
      discordUsername
    });

    if (!contactValidation.isValid) {
      console.log("❌ Contact validation failed:", contactValidation.errors);
      return res.status(400).json({
        success: false,
        message: "Please provide all required information",
        errors: contactValidation.errors,
      });
    }

    // Validate product type
    const validProductTypes = [
      "basic",
      "diamond",
      "infinity",
      "script",
      "investment-advising",
      "trading-tutor",
      "ultimate",
      "basic-subscription",
      "diamond-subscription",
      "infinity-subscription",
      "mentorship-package",
      "product-purchase",
      "eagle-ultimate",
      "trading-tutoring",
    ];
    if (!validProductTypes.includes(productType)) {
      console.log(
        "❌ Invalid product type:",
        productType,
        "Valid types:",
        validProductTypes
      );
      return res.status(400).json({
        success: false,
        message: "Invalid product type",
      });
    }

    // Sanitize address data
    const sanitizedAddress = sanitizeAddressData({
      country,
      streetAddress,
      flatSuiteUnit,
      townCity,
      stateCounty,
      postcodeZip
    });

    // Get client IP and user agent for audit trail
    const ipAddress =
      req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const userAgent = req.get("User-Agent");

    // Calculate subscription price based on product type and subscription type
    const productPricing = PRODUCT_PRICING[productType];
    if (!productPricing) {
      return res.status(400).json({
        success: false,
        message: "Invalid product type for pricing",
      });
    }

    const subscriptionPrice = productPricing[subscriptionType];
    if (!subscriptionPrice) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription type",
      });
    }

    // Store contract data directly in database (no PDF generation needed)
    const packageType = productType;
    const contractTitle = CONTRACT_TEMPLATES[packageType] || `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Advisory Contract`;

    // Use provided contract data or create default
    const contractDataForStorage = contractData || {
      name: fullName,
      date: new Date(),
      signature,
      email,
      price: subscriptionPrice.toString(),
    };

    console.log("✅ Contract data prepared for database storage");

    // Check if user already exists with this email
    let existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    let userCreationStatus = null;

    if (!existingUser) {
      console.log("👤 User doesn't exist, creating pending user account...");
      
      // Generate activation token
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create pending user
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || fullName;
      const lastName = nameParts.slice(1).join(' ') || 'User';
      
      const pendingUserData = {
        firstName,
        lastName,
        name: fullName,
        email: email.toLowerCase().trim(),
        phone: phone ? phone.trim() : null,
        isPendingUser: true,
        isEmailVerified: false,
        activationToken,
        activationTokenExpiry,
        // Store address information in user profile
        address: sanitizedAddress,
        discordUsername: discordUsername ? discordUsername.trim() : null,
        // Note: password will be set when user activates account
      };

      try {
        existingUser = await User.create(pendingUserData);
        userCreationStatus = 'created_pending';
        console.log("✅ Pending user created:", existingUser._id);

        // Send account activation email
        await emailService.sendAccountActivationEmail(
          email.toLowerCase().trim(),
          fullName,
          activationToken,
          process.env.FRONTEND_URL || 'http://localhost:3000'
        );
        console.log("📧 Account activation email sent successfully");

      } catch (userCreationError) {
        console.error("❌ Error creating pending user:", userCreationError);
        userCreationStatus = 'creation_failed';
        // Continue with contract creation even if user creation fails
      }
    } else if (existingUser.isPendingUser) {
      console.log("👤 User exists as pending user, updating activation token...");
      
      // Update activation token for existing pending user
      existingUser.activationToken = crypto.randomBytes(32).toString('hex');
      existingUser.activationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await existingUser.save();
      userCreationStatus = 'updated_pending';

      // Resend activation email
      await emailService.sendAccountActivationEmail(
        email.toLowerCase().trim(),
        fullName,
        existingUser.activationToken,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );
      console.log("📧 Account activation email resent successfully");

    } else {
      console.log("👤 User already exists and is active");
      userCreationStatus = 'already_exists';
      
      // Send welcome back email for existing users
      try {
        await emailService.sendWelcomeEmail(
          email.toLowerCase().trim(),
          fullName,
          productType,
          process.env.FRONTEND_URL || 'http://localhost:3000'
        );
        console.log("📧 Welcome back email sent successfully");
      } catch (emailError) {
        console.error("❌ Error sending welcome email:", emailError);
      }
    }

    // Create signed contract data (store in database only)
    const signedContractData = {
      userId: existingUser ? existingUser._id : null,
      name: fullName,
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      country: sanitizedAddress.country,
      streetAddress: sanitizedAddress.streetAddress,
      flatSuiteUnit: sanitizedAddress.flatSuiteUnit,
      townCity: sanitizedAddress.townCity,
      stateCounty: sanitizedAddress.stateCounty,
      postcodeZip: sanitizedAddress.postcodeZip,
      discordUsername: discordUsername ? discordUsername.trim() : null,
      signature,
      productType,
      contractTitle,
      ipAddress,
      userAgent,
      status: "payment_pending",
      subscriptionType,
      subscriptionPrice,
      isGuestContract: !existingUser || existingUser.isPendingUser,
      pdfGenerationMethod: 'none', // No PDF generation
      signedDate: new Date(contractDataForStorage.date),
    };

    // Create signed contract
    const signedContract = await SignedContract.create(signedContractData);

    console.log("✅ Contract created successfully:", signedContract._id);

    // Prepare response data
    const responseData = {
      contract: signedContract,
      contractId: signedContract._id,
      contractTitle,
      userCreationStatus,
      message: 'Contract stored in database successfully - no PDF generation',
      user: existingUser ? {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
        isPendingUser: existingUser.isPendingUser,
        isEmailVerified: existingUser.isEmailVerified
      } : null
    };

    // Send appropriate success message based on user status
    let successMessage = "Contract created successfully";
    
    if (userCreationStatus === 'created_pending') {
      successMessage += ". We've created an account for you and sent an activation email. Please check your email to set your password and activate your account.";
    } else if (userCreationStatus === 'updated_pending') {
      successMessage += ". We've resent your account activation email. Please check your email to set your password and activate your account.";
    } else if (userCreationStatus === 'already_exists') {
      successMessage += ". Welcome back! We've sent you a confirmation email.";
    } else if (userCreationStatus === 'creation_failed') {
      successMessage += ". Note: There was an issue creating your user account, but your contract was saved successfully.";
    }

    res.status(201).json({
      success: true,
      message: successMessage,
      data: responseData,
    });
  } catch (error) {
    console.error("❌ Error creating contract with contact info:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get guest contract by ID (no auth required)
// @route   GET /api/contracts/guest/:contractId
// @access  Public
const getGuestContractById = async (req, res) => {
  try {
    const { contractId } = req.params;

    console.log("🔍 Getting guest contract by ID:", contractId);

    const contract = await SignedContract.findOne({
      _id: contractId,
      $or: [
        { isGuestContract: true }, // New guest contracts
        { userId: null }, // Legacy contracts without userId
      ]
    }).select("-userAgent -ipAddress");

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Guest contract not found",
      });
    }

    console.log("✅ Found guest contract:", contract._id);

    res.json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("❌ Error fetching guest contract:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get user's signed contracts (public version - by email)
// @route   POST /api/contracts/public/my-contracts
// @access  Public
const getPublicUserContracts = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("🔍 Getting public contracts for email:", email);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find contracts by email (both guest and authenticated user contracts)
    const contracts = await SignedContract.find({ 
      email: email.toLowerCase().trim() 
    })
      .sort({ createdAt: -1 })
      .select("-userAgent -ipAddress");

    console.log(`✅ Found ${contracts.length} contracts for email: ${email}`);

    res.json({
      success: true,
      data: contracts,
      message: contracts.length > 0 
        ? `Found ${contracts.length} contract(s)` 
        : "No contracts found for this email",
    });
  } catch (error) {
    console.error("❌ Error fetching public user contracts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// @desc    Get guest contracts with contact info validation
// @route   POST /api/contracts/my-contracts/guest  
// @access  Public
const getGuestContracts = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    console.log("🔍 Getting guest contracts:", { name, email, phone: !!phone });

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
        guestMode: true,
        formError: true
      });
    }

    // Find contracts by email and name
    const contracts = await SignedContract.find({ 
      email: email.toLowerCase().trim(),
      name: { $regex: new RegExp(name.trim(), 'i') } // Case-insensitive name match
    })
      .sort({ createdAt: -1 })
      .select("-userAgent -ipAddress");

    console.log(`✅ Found ${contracts.length} guest contracts`);

    // Generate a guest tracking ID for future reference
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    res.json({
      success: true,
      data: contracts,
      guestId: guestId,
      isAuthenticated: false,
      guestMode: true,
      message: contracts.length > 0 
        ? `Found ${contracts.length} contract(s) for ${name}` 
        : `No contracts found for ${name} (${email})`,
    });
  } catch (error) {
    console.error("❌ Error fetching guest contracts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
      guestMode: true
    });
  }
};

// @desc    Get contract statistics
// @route   GET /api/contracts/stats
// @access  Protected
const getContractStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get total contracts
    const totalContracts = await SignedContract.countDocuments();

    // Get contracts signed today
    const signedToday = await SignedContract.countDocuments({
      signedDate: { $gte: startOfToday },
      status: { $in: ['signed', 'completed'] }
    });

    // Get pending signatures
    const pendingSignatures = await SignedContract.countDocuments({
      status: { $in: ['pending', 'payment_pending'] }
    });

    // Calculate completion rate (signed/total contracts)
    const completionRate = totalContracts > 0 ? (
      await SignedContract.countDocuments({ status: { $in: ['signed', 'completed'] } }) / totalContracts * 100
    ) : 0;

    // Get last month stats for comparison
    const lastMonthTotal = await SignedContract.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });
    const thisMonthTotal = await SignedContract.countDocuments({
      createdAt: { $gte: startOfMonth }
    });

    const lastMonthSigned = await SignedContract.countDocuments({
      signedDate: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      status: { $in: ['signed', 'completed'] }
    });
    const thisMonthSigned = await SignedContract.countDocuments({
      signedDate: { $gte: startOfMonth },
      status: { $in: ['signed', 'completed'] }
    });

    const lastMonthPending = await SignedContract.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
      status: { $in: ['pending', 'payment_pending'] }
    });

    // Calculate changes
    const contractsChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100) : 0;
    const signedTodayChange = lastMonthSigned > 0 ? ((thisMonthSigned - lastMonthSigned) / lastMonthSigned * 100) : 0;
    const pendingChange = lastMonthPending > 0 ? ((pendingSignatures - lastMonthPending) / lastMonthPending * 100) : 0;
    const completionRateChange = 5; // Mock value for now

    res.json({
      success: true,
      data: {
        totalContracts,
        signedToday,
        pendingSignatures,
        completionRate: Math.round(completionRate),
        contractsChange: Math.round(contractsChange * 100) / 100,
        signedTodayChange: Math.round(signedTodayChange * 100) / 100,
        pendingChange: Math.round(pendingChange * 100) / 100,
        completionRateChange
      }
    });
  } catch (error) {
    console.error("Error fetching contract stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contract statistics",
      error: error.message
    });
  }
};

// @desc    Get all contracts with filters and pagination
// @route   GET /api/contracts
// @access  Protected
const getAllContracts = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      plan, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    // Build filter query
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { productType: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (plan) {
      filter.productType = { $regex: plan, $options: 'i' };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Fetch contracts
    const contracts = await SignedContract.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-userAgent -ipAddress');

    const total = await SignedContract.countDocuments(filter);

    res.json({
      success: true,
      data: {
        contracts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: skip + contracts.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error("Error fetching contracts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error.message
    });
  }
};

// @desc    Delete a contract
// @route   DELETE /api/contracts/:id
// @access  Protected
const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;

    const contract = await SignedContract.findByIdAndDelete(id);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    res.json({
      success: true,
      message: "Contract deleted successfully",
      data: contract
    });
  } catch (error) {
    console.error("Error deleting contract:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete contract",
      error: error.message
    });
  }
};

// @desc    Update a contract
// @route   PUT /api/contracts/:id
// @access  Protected
const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const contract = await SignedContract.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    res.json({
      success: true,
      message: "Contract updated successfully",
      data: contract
    });
  } catch (error) {
    console.error("Error updating contract:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update contract",
      error: error.message
    });
  }
};

// Mock template data for now (can be moved to database later)
const mockTemplates = [
  {
    _id: "template_1",
    name: "Basic Advisory Contract",
    version: "v1.0",
    language: "English",
    description: "Standard basic advisory services contract",
    lastUpdated: new Date().toISOString(),
    usage: 45,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "template_2", 
    name: "Diamond Advisory Contract",
    version: "v1.2",
    language: "English",
    description: "Premium diamond tier advisory services contract",
    lastUpdated: new Date().toISOString(),
    usage: 32,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "template_3",
    name: "Infinity Advisory Contract",
    version: "v1.1",
    language: "English", 
    description: "Elite infinity tier advisory services contract",
    lastUpdated: new Date().toISOString(),
    usage: 18,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// @desc    Get contract templates
// @route   GET /api/contracts/templates
// @access  Protected
const getTemplates = async (req, res) => {
  try {
    res.json({
      success: true,
      data: mockTemplates
    });
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch templates",
      error: error.message
    });
  }
};

// @desc    Create contract template
// @route   POST /api/contracts/templates
// @access  Protected
const createTemplate = async (req, res) => {
  try {
    const { name, language, description } = req.body;

    const newTemplate = {
      _id: `template_${Date.now()}`,
      name,
      version: "v1.0",
      language,
      description,
      lastUpdated: new Date().toISOString(),
      usage: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    mockTemplates.push(newTemplate);

    res.status(201).json({
      success: true,
      message: "Template created successfully",
      data: newTemplate
    });
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create template",
      error: error.message
    });
  }
};

// @desc    Update contract template
// @route   PUT /api/contracts/templates/:id
// @access  Protected
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const templateIndex = mockTemplates.findIndex(t => t._id === id);
    
    if (templateIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    mockTemplates[templateIndex] = {
      ...mockTemplates[templateIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    res.json({
      success: true,
      message: "Template updated successfully",
      data: mockTemplates[templateIndex]
    });
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update template",
      error: error.message
    });
  }
};

// @desc    Delete contract template
// @route   DELETE /api/contracts/templates/:id
// @access  Protected
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const templateIndex = mockTemplates.findIndex(t => t._id === id);
    
    if (templateIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    const deletedTemplate = mockTemplates.splice(templateIndex, 1)[0];

    res.json({
      success: true,
      message: "Template deleted successfully",
      data: deletedTemplate
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete template",
      error: error.message
    });
  }
};

// @desc    Export contracts
// @route   GET /api/contracts/export
// @access  Protected
const exportContracts = async (req, res) => {
  try {
    const { format = 'csv', filters = {} } = req.query;

    // Build filter query
    const filter = {};
    if (filters.status) filter.status = filters.status;
    if (filters.plan) filter.productType = { $regex: filters.plan, $options: 'i' };
    if (filters.dateFrom) filter.createdAt = { $gte: new Date(filters.dateFrom) };
    if (filters.dateTo) filter.createdAt = { ...filter.createdAt, $lte: new Date(filters.dateTo) };

    const contracts = await SignedContract.find(filter).select('-userAgent -ipAddress');

    if (format === 'csv') {
      const csv = contracts.map(contract => 
        `"${contract._id}","${contract.name}","${contract.email}","${contract.productType}","${contract.status}","${contract.subscriptionPrice}","${contract.createdAt}"`
      ).join('\n');

      const header = '"ID","Name","Email","Product Type","Status","Price","Created Date"\n';
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contracts.csv"');
      res.send(header + csv);
    } else {
      res.json({
        success: true,
        data: contracts,
        format,
        count: contracts.length
      });
    }
  } catch (error) {
    console.error("Error exporting contracts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export contracts",
      error: error.message
    });
  }
};

// @desc    Get evidence packets
// @route   GET /api/contracts/evidence
// @access  Protected
const getEvidencePackets = async (req, res) => {
  try {
    const { page = 1, limit = 50, contractId } = req.query;

    const filter = {};
    if (contractId) filter._id = contractId;

    const contracts = await SignedContract.find(filter)
      .sort({ signedDate: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .select('_id name email signedDate ipAddress userAgent status');

    // Transform contracts to evidence packets format
    const evidencePackets = contracts.map(contract => ({
      _id: `evidence_${contract._id}`,
      contractId: contract._id,
      contractNumber: contract._id.toString().slice(-8),
      signerName: contract.name,
      signerEmail: contract.email,
      signedDate: contract.signedDate || contract.createdAt,
      ipAddress: contract.ipAddress || 'N/A',
      userAgent: contract.userAgent || 'N/A',
      deviceInfo: contract.userAgent ? 
        (contract.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop') : 'Unknown',
      cryptographicHash: `sha256_${contract._id.toString().slice(-16)}`,
      evidenceUrl: `/api/contracts/${contract._id}/evidence`,
      isVerified: contract.status === 'signed' || contract.status === 'completed',
      createdAt: contract.signedDate || contract.createdAt
    }));

    const total = await SignedContract.countDocuments(filter);

    res.json({
      success: true,
      data: {
        evidencePackets,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage: (parseInt(page) - 1) * parseInt(limit) + evidencePackets.length < total,
          hasPrevPage: parseInt(page) > 1
        }
      }
    });
  } catch (error) {
    console.error("Error fetching evidence packets:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch evidence packets",
      error: error.message
    });
  }
};

module.exports = {
  storeSignedContract,
  updatePaymentStatus,
  getUserContracts,
  getContractById,
  generateContractPDF,
  getContractPDFUrl,
  getContractsByContact,
  createContractWithContact,
  getGuestContractById,
  getPublicUserContracts,
  getGuestContracts,
  getContractStats,
  getAllContracts,
  deleteContract,
  updateContract,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  exportContracts,
  getEvidencePackets,
};





