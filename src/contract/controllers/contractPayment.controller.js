const axios = require("axios");
const { SignedContract } = require("../models/contract.model");
const User = require("../../user/models/user.model");
const PAYMENT_BRANDING = require("../config/paymentBranding");
const crypto = require("crypto");
const emailService = require("../../services/emailService");

// Initialize Stripe - env vars already loaded by index.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Product pricing configuration - Updated to match WooCommerce products
const PRODUCT_PRICING = {
  basic: {
    monthly: 37,
    yearly: 370,
    name: "Basic Package",
  },
  diamond: {
    monthly: 67,
    yearly: 670,
    name: "Diamond Package",
  },
  infinity: {
    monthly: 99,
    yearly: 999,
    name: "Infinity Package",
  },
  script: {
    monthly: { price: "29.00", name: "Script Package (Monthly)" },
    yearly: { price: "299.00", name: "Script Package (Yearly)" },
  },
  "investment-advising": {
    monthly: { price: "987.00", name: "Investment Advising" },
    yearly: { price: "987.00", name: "Investment Advising" },
  },
  "trading-tutor": {
    monthly: { price: "987.00", name: "Trading Tutor" },
    yearly: { price: "987.00", name: "Trading Tutor" },
  },
  ultimate: {
    monthly: { price: "2497.00", name: "Eagle Ultimate" },
    yearly: { price: "2497.00", name: "Eagle Ultimate" },
  },
  // New product mappings for WordPress products
  "eagle-premium-monthly": {
    monthly: { price: "67.00", name: "Eagle Premium Monthly" },
    yearly: { price: "670.00", name: "Eagle Premium Annual" },
  },
  "eagle-premium-annual": {
    monthly: { price: "67.00", name: "Eagle Premium Monthly" },
    yearly: { price: "670.00", name: "Eagle Premium Annual" },
  },
  "eagle-investors-subscriptions": {
    monthly: { price: "37.00", name: "Eagle Investors Subscriptions" },
    yearly: { price: "370.00", name: "Eagle Investors Subscriptions Annual" },
  }
};

// Helper function to normalize product type for pricing lookup
const normalizeProductType = (productType) => {
  // Remove common suffixes to match PRODUCT_PRICING keys
  const normalized = productType
    .replace(/-subscription$/, "")
    .replace(/-package$/, "")
    .replace(/^mentorship-/, "")
    .replace(/^product-/, "");

  // Handle special cases
  if (normalized === "mentorship" || normalized === "package") {
    return "basic"; // Default mentorship package to basic pricing
  }

  if (normalized === "trading-tutoring" || normalized === "trading-tutor") {
    return "trading-tutor";
  }

  if (normalized === "eagle-ultimate") {
    return "ultimate";
  }

  return normalized;
};

// Helper function to calculate subscription end date
const calculateSubscriptionEndDate = (startDate, subscriptionType) => {
  const endDate = new Date(startDate);
  if (subscriptionType === "monthly") {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (subscriptionType === "yearly") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  return endDate;
};

// Helper function to handle user account creation/update after successful payment
const handlePostPaymentUserAccount = async (contract) => {
  try {
    console.log("🔄 Processing post-payment user account for contract:", contract._id);

    // If contract already has a non-pending user, just return
    if (contract.userId) {
      const existingUser = await User.findById(contract.userId);
      if (existingUser && !existingUser.isPendingUser) {
        console.log("✅ Contract already linked to active user:", existingUser.email);
        return {
          status: 'existing_active_user',
          user: existingUser,
          message: 'Welcome back! Your subscription is now active.'
        };
      }
    }

    // Find or create user account
    let user = await User.findOne({ email: contract.email.toLowerCase() });

    if (!user) {
      console.log("👤 No user found, creating new account for:", contract.email);

      // Generate activation token for new account
      const activationToken = crypto.randomBytes(32).toString('hex');
      const activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create new user account
      user = await User.create({
        name: contract.name,
        email: contract.email.toLowerCase(),
        phone: contract.phone,
        isPendingUser: true,
        isEmailVerified: false,
        activationToken,
        activationTokenExpiry,
        // Password will be set when user activates account
      });

      // Update contract with user ID
      contract.userId = user._id;
      contract.isGuestContract = false;
      await contract.save();

      // Send password setup email
      await emailService.sendPasswordSetupEmail(
        user.email,
        user.name,
        activationToken,
        contract.productType,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );

      console.log("📧 Password setup email sent to new user:", user.email);

      return {
        status: 'created_pending_user',
        user,
        message: 'Payment successful! We\'ve created your account and sent you an email to set your password and access your subscription.'
      };

    } else if (user.isPendingUser) {
      console.log("🔄 User exists as pending, updating activation for:", user.email);

      // Update activation token for existing pending user
      user.activationToken = crypto.randomBytes(32).toString('hex');
      user.activationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await user.save();

      // Update contract with user ID if not already set
      if (!contract.userId) {
        contract.userId = user._id;
        contract.isGuestContract = false;
        await contract.save();
      }

      // Send password setup email
      await emailService.sendPasswordSetupEmail(
        user.email,
        user.name,
        user.activationToken,
        contract.productType,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );

      console.log("📧 Updated password setup email sent to pending user:", user.email);

      return {
        status: 'updated_pending_user',
        user,
        message: 'Payment successful! We\'ve sent you an email to set your password and access your subscription.'
      };

    } else {
      console.log("✅ User already exists and is active:", user.email);

      // Update contract with user ID if not already set
      if (!contract.userId) {
        contract.userId = user._id;
        contract.isGuestContract = false;
        await contract.save();
      }

      // Send subscription activation email for existing users
      await emailService.sendWelcomeEmail(
        user.email,
        user.name,
        contract.productType,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );

      console.log("📧 Subscription activation email sent to existing user:", user.email);

      return {
        status: 'existing_user_activated',
        user,
        message: 'Payment successful! Your subscription is now active. Welcome back!'
      };
    }

  } catch (error) {
    console.error("❌ Error in post-payment user account processing:", error);
    return {
      status: 'account_processing_failed',
      user: null,
      message: 'Payment successful, but there was an issue with account setup. Please contact support.'
    };
  }
};

// Cached PayPal access token with timestamp
let cachedAccessToken = null;
let tokenExpiresAt = null;

async function generateAccessToken() {
  try {
    // Check if we have a valid cached token
    if (cachedAccessToken && tokenExpiresAt && Date.now() < tokenExpiresAt) {
      console.log("Using cached PayPal access token");
      return cachedAccessToken;
    }

    console.log("Generating new PayPal access token...");
    console.log("PayPal API URL:", process.env.PAYPAL_API);
    console.log(
      "PayPal Client ID:",
      process.env.PAYPAL_CLIENT_ID ? "Set" : "Missing"
    );
    console.log(
      "PayPal Client Secret:",
      process.env.PAYPAL_CLIENT_SECRET ? "Set" : "Missing"
    );

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      throw new Error("PayPal credentials not configured");
    }

    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v1/oauth2/token`,
      "grant_type=client_credentials",
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 10000, // 10 second timeout
      }
    );

    const { access_token, expires_in } = response.data;

    // Cache the token with 5 minute buffer before expiry
    cachedAccessToken = access_token;
    tokenExpiresAt = Date.now() + (expires_in - 300) * 1000; // 5 min buffer

    console.log("PayPal access token generated and cached successfully");
    return access_token;
  } catch (error) {
    console.error("PayPal access token generation failed:");
    console.error("Error message:", error.message);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.response?.status);
    throw new Error("Failed to generate PayPal access token");
  }
}

// 🧾 Create Order for Contract Payment
exports.createContractOrder = async (req, res) => {
  try {
    const { contractId, subscriptionType = "monthly" } = req.body; // Default to monthly
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Creating PayPal order for contract:",
      contractId,
      "subscription:",
      subscriptionType,
      "userId:",
      userId || "guest"
    );

    // Validate contract exists - for guest users, check by contractId only
    let contract;
    if (userId) {
      // Authenticated user - check ownership
      contract = await SignedContract.findOne({
        _id: contractId,
        userId,
        status: "payment_pending",
      });
    } else {
      // Guest user - just check contract exists and is payment pending
      contract = await SignedContract.findOne({
        _id: contractId,
        status: "payment_pending",
      });
    }

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found or already processed",
      });
    }

    // Get product pricing with normalized product type
    const normalizedProductType = normalizeProductType(contract.productType);
    const productInfo = PRODUCT_PRICING[normalizedProductType];
    if (!productInfo) {
      console.error(
        `Invalid product type: ${contract.productType} (normalized: ${normalizedProductType})`
      );
      return res.status(400).json({
        success: false,
        message: `Invalid product type: ${contract.productType}`,
        availableTypes: Object.keys(PRODUCT_PRICING),
      });
    }

    // Get the price based on subscription type, handling different pricing structures
    let price;
    if (typeof productInfo.monthly === "object") {
      // For products with nested pricing structure (script, investment-advising, etc.)
      price =
        subscriptionType === "yearly"
          ? parseFloat(productInfo.yearly.price)
          : parseFloat(productInfo.monthly.price);
    } else {
      // For products with direct pricing (basic, diamond, infinity)
      price =
        subscriptionType === "yearly"
          ? productInfo.yearly
          : productInfo.monthly;
    }
    const subscriptionTypeText =
      subscriptionType === "yearly" ? "Yearly" : "Monthly";

    const accessToken = await generateAccessToken();

    // Format price for PayPal (must be string with 2 decimal places)
    const formattedPrice = parseFloat(price).toFixed(2);

    console.log("PayPal Order Details:", {
      contractId,
      price,
      formattedPrice,
      productName: productInfo.name,
      subscriptionType: subscriptionTypeText,
      frontendUrl: process.env.FRONTEND_URL, // Add this debug line
    });

    // Get return URLs from branding config
    const returnUrls = PAYMENT_BRANDING.getReturnUrls();
    const productDescription = PAYMENT_BRANDING.getProductDescription(productInfo, subscriptionType);

    const paypalOrderBody = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: contractId,
          amount: {
            currency_code: "USD",
            value: formattedPrice,
          },
          description: productDescription,
          custom_id: contractId,
          soft_descriptor: PAYMENT_BRANDING.statementDescriptor,
        },
      ],
      application_context: {
        brand_name: PAYMENT_BRANDING.paypal.brandName,
        landing_page: PAYMENT_BRANDING.paypal.landingPage,
        shipping_preference: PAYMENT_BRANDING.paypal.shippingPreference,
        user_action: PAYMENT_BRANDING.paypal.userAction,
        return_url: returnUrls.success,
        cancel_url: returnUrls.cancel,
      },
    };

    console.log(
      "Sending PayPal order request:",
      JSON.stringify(paypalOrderBody, null, 2)
    );

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      paypalOrderBody,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      orderId: response.data.id,
      contractId,
      amount: price, // Use the calculated price, not productInfo.price
      approvalUrl: response.data.links.find((link) => link.rel === "approve")
        ?.href,
      productName: productInfo.name,
    });
  } catch (error) {
    console.error("PayPal Create Order Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

// ✅ Capture Contract Order
exports.captureContractOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { contractId, subscriptionType = "monthly" } = req.body; // Get subscription type from request
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Capturing PayPal order:",
      orderId,
      "for contract:",
      contractId,
      "subscription:",
      subscriptionType,
      "userId:",
      userId || "guest"
    );

    // Validate contract - for guest users, check by contractId only
    let contract;
    if (userId) {
      // Authenticated user - check ownership
      contract = await SignedContract.findOne({
        _id: contractId,
        userId,
        status: "payment_pending",
      });
    } else {
      // Guest user - just check contract exists and is payment pending
      contract = await SignedContract.findOne({
        _id: contractId,
        status: "payment_pending",
      });
    }

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found or already processed",
      });
    }

    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Check if payment was successful
    if (response.data.status === "COMPLETED") {
      // Get pricing information with normalized product type
      const normalizedProductType = normalizeProductType(contract.productType);
      const productInfo = PRODUCT_PRICING[normalizedProductType];

      let price;
      if (typeof productInfo.monthly === "object") {
        // For products with nested pricing structure
        price =
          subscriptionType === "yearly"
            ? parseFloat(productInfo.yearly.price)
            : parseFloat(productInfo.monthly.price);
      } else {
        // For products with direct pricing
        price =
          subscriptionType === "yearly"
            ? productInfo.yearly
            : productInfo.monthly;
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = calculateSubscriptionEndDate(startDate, subscriptionType);

      // Update contract status with subscription information
      const updatedContract = await SignedContract.findByIdAndUpdate(contractId, {
        status: "completed",
        paymentId: orderId,
        paymentProvider: "paypal",
        subscriptionType: subscriptionType,
        subscriptionPrice: price,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
      }, { new: true });

      console.log("✅ PayPal payment completed, processing user account...");

      // Handle post-payment user account creation/update
      const accountResult = await handlePostPaymentUserAccount(updatedContract);

      // Get the actual plan from database to use its displayName
      const MembershipPlan = require('../../subscription/models/membershipPlan.model');
      let actualPlan = null;

      // Determine subscription name from product pricing configuration
      let newSubscription;
      if (typeof productInfo.monthly === 'object' && productInfo.monthly.name) {
        // For products with nested pricing structure (e.g., script, investment-advising)
        newSubscription = productInfo.monthly.name;
      } else if (productInfo.name) {
        // For products with direct pricing (e.g., basic, diamond, infinity)
        newSubscription = productInfo.name;
      } else {
        // Last resort fallback - use normalized product type
        newSubscription = normalizedProductType.charAt(0).toUpperCase() + normalizedProductType.slice(1);
      }
      console.log(`💳 Subscription determined from pricing config: "${newSubscription}" (productType: "${updatedContract.productType}", normalized: "${normalizedProductType}")`);

      try {
        // Try to find the plan by normalized product type for database linkage
        actualPlan = await MembershipPlan.findOne({
          name: normalizedProductType,
          isActive: { $ne: false }
        }).lean();

        if (actualPlan) {
          // If we found the plan in DB, use its displayName if available
          if (actualPlan.displayName) {
            newSubscription = actualPlan.displayName;
            console.log(`✅ Found plan in database: "${actualPlan.name}" → displayName: "${actualPlan.displayName}"`);
          }
        } else {
          console.log(`⚠️ Plan not found in database for "${normalizedProductType}", using pricing config name: "${newSubscription}"`);
        }
      } catch (error) {
        console.error("❌ Error fetching plan from database:", error.message);
        console.log(`⚠️ Using pricing config name as fallback: "${newSubscription}"`);
      }

      // Update user subscription if user exists and is active
      if (accountResult.user && !accountResult.user.isPendingUser && newSubscription) {
        await User.findByIdAndUpdate(accountResult.user._id, {
          subscription: newSubscription,
          subscriptionStatus: "active",
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          subscriptionPlanId: actualPlan ? actualPlan._id : null,
          billingCycle: subscriptionType === "yearly" ? "yearly" : "monthly",




          lastPaymentAmount: price,
        });
        console.log("✅ User subscription updated to:", newSubscription);
      }

      res.json({
        success: true,
        message: accountResult.message || "Payment completed successfully",
        data: {
          paymentId: orderId,
          contractId,
          status: "completed",
          subscription: newSubscription,
          userAccount: {
            status: accountResult.status,
            userId: accountResult.user ? accountResult.user._id : null,
            email: accountResult.user ? accountResult.user.email : null,
            isPending: accountResult.user ? accountResult.user.isPendingUser : false
          }
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Payment was not completed",
        status: response.data.status,
      });
    }
  } catch (error) {
    console.error("PayPal Capture Error:", error);

    // Update contract status to cancelled on payment failure
    if (req.body.contractId) {
      await SignedContract.findByIdAndUpdate(req.body.contractId, {
        status: "cancelled",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to capture payment",
      error: error?.response?.data || error.message,
    });
  }
};

// Legacy endpoints for backward compatibility
exports.createOrder = async (req, res) => {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "20.00",
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ id: response.data.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
};

exports.captureOrder = async (req, res) => {
  try {
    const accessToken = await generateAccessToken();
    const { orderId } = req.params;

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "PayPal Capture Error:",
      error?.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to capture order",
      details: error?.response?.data || error.message,
    });
  }
};

// 💳 Create Stripe Payment Intent for Contract Payment
exports.createStripePaymentIntent = async (req, res) => {
  try {
    const {
      contractId,
      subscriptionType = "monthly",
      discountCode,
      discountAmount,
      finalAmount
    } = req.body; // Extract discount info from request
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log("🔍 BACKEND PAYMENT INTENT DEBUG:");
    console.log("  📦 Contract ID:", contractId);
    console.log("  🔄 Subscription Type:", subscriptionType);
    console.log("  👤 User ID:", userId || "guest");
    console.log("  🎟️ Discount Code:", discountCode || "none");
    console.log("  💵 Discount Amount:", discountAmount, typeof discountAmount);
    console.log("  💰 Final Amount:", finalAmount, typeof finalAmount);
    console.log("  ❓ finalAmount provided?", finalAmount !== undefined && finalAmount !== null);
    console.log("  📋 Full request body:", JSON.stringify(req.body, null, 2));

    // Validate contract exists - for guest users, check by contractId only
    let contract;
    if (userId) {
      // Authenticated user - check ownership
      contract = await SignedContract.findOne({
        _id: contractId,
        userId,
        status: "payment_pending",
      });
    } else {
      // Guest user - just check contract exists and is payment pending
      contract = await SignedContract.findOne({
        _id: contractId,
        status: "payment_pending",
      });
    }

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found or not eligible for payment",
      });
    }

    // Get product pricing with normalized product type
    const normalizedProductType = normalizeProductType(contract.productType);
    const productInfo = PRODUCT_PRICING[normalizedProductType];
    if (!productInfo) {
      console.error(
        `Invalid product type: ${contract.productType} (normalized: ${normalizedProductType})`
      );
      console.error("Available product types:", Object.keys(PRODUCT_PRICING));
      return res.status(400).json({
        success: false,
        message: `Invalid product type: ${contract.productType}`,
        availableTypes: Object.keys(PRODUCT_PRICING),
      });
    }

    // Get the price - use finalAmount if provided (with discount), otherwise use original price
    let price;
    let originalPrice; // Store original price for logging

    if (finalAmount !== undefined && finalAmount !== null && finalAmount !== "") {
      // Use the discounted final amount provided by frontend
      // Handle both string and number types
      const parsedFinalAmount = typeof finalAmount === "string"
        ? parseFloat(finalAmount.replace(/[$,]/g, ""))
        : parseFloat(finalAmount);

      if (!isNaN(parsedFinalAmount)) {
        price = parsedFinalAmount;
        console.log("✅ Using discounted finalAmount:", price, "(parsed from:", finalAmount, typeof finalAmount, ")");
      } else {
        console.error("⚠️ finalAmount could not be parsed:", finalAmount, typeof finalAmount);
        // Fall through to default pricing
        price = null;
      }
    }

    if (price === null || price === undefined) {
      // Fall back to original pricing from PRODUCT_PRICING
      if (typeof productInfo.monthly === "object") {
        // For products with nested pricing structure (script, investment-advising, etc.)
        price =
          subscriptionType === "yearly"
            ? parseFloat(productInfo.yearly.price)
            : parseFloat(productInfo.monthly.price);
      } else {
        // For products with direct pricing (basic, diamond, infinity)
        price =
          subscriptionType === "yearly"
            ? productInfo.yearly
            : productInfo.monthly;
      }
      console.log("📊 Using original price from PRODUCT_PRICING:", price);
    }

    // Store original price for metadata (useful for tracking discounts)
    if (typeof productInfo.monthly === "object") {
      originalPrice = subscriptionType === "yearly"
        ? parseFloat(productInfo.yearly.price)
        : parseFloat(productInfo.monthly.price);
    } else {
      originalPrice = subscriptionType === "yearly"
        ? productInfo.yearly
        : productInfo.monthly;
    }

    const subscriptionTypeText =
      subscriptionType === "yearly" ? "Yearly" : "Monthly";

    // Create Stripe payment intent
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Use contract's actual product name if available, otherwise fall back to productInfo.name
    const actualProductName = contract.productName || productInfo.name;

    // Create Stripe payment intent with proper branding
    const productDescription = PAYMENT_BRANDING.getProductDescription({ name: actualProductName }, subscriptionType);
    const statementSuffix = PAYMENT_BRANDING.getStatementDescriptorSuffix(actualProductName);

    // Get email for receipt - from authenticated user or contract
    const receiptEmail = PAYMENT_BRANDING.stripe.receiptEmail
      ? (req.user ? req.user.email : (contract.email && contract.email.trim() ? contract.email.trim() : null))
      : null;

    console.log("💳 Creating Stripe payment intent:", {
      amount: Math.round(parseFloat(price) * 100),
      originalPrice: originalPrice,
      finalPrice: price,
      discountCode: discountCode || "none",
      discountAmount: discountAmount || 0,
      actualProductName: actualProductName,
      contractProductName: contract.productName,
      fallbackProductInfoName: productInfo.name,
      contractId: contract._id,
      userId: userId || "guest",
      receiptEmail,
      contractEmail: contract.email,
      productType: contract.productType
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(price) * 100), // Convert to cents (using discounted price if provided)
      currency: "usd",
      metadata: {
        contractId: contract._id.toString(),
        userId: userId || "guest",
        productType: contract.productType,
        subscriptionType: subscriptionType,
        ...PAYMENT_BRANDING.stripe.metadata,
        productName: actualProductName, // ✅ Use actual product name from contract
        // Add discount information to metadata
        ...(discountCode && { discountCode }),
        ...(discountAmount && { discountAmount: discountAmount.toString() }),
        ...(originalPrice !== price && { originalPrice: originalPrice.toString() }),
        ...(finalAmount !== undefined && finalAmount !== null && { finalAmount: finalAmount.toString() }),
      },
      description: productDescription,
      statement_descriptor: PAYMENT_BRANDING.stripe.statementDescriptor,
      statement_descriptor_suffix: statementSuffix,
      receipt_email: receiptEmail,
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Stripe Payment Intent Creation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create payment intent",
      error: error.message,
    });
  }
};

// ✅ Confirm Stripe Payment for Contract
exports.confirmStripePayment = async (req, res) => {
  try {
    const { paymentIntentId, contractId } = req.body;
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Confirming payment:",
      paymentIntentId,
      "for contract:",
      contractId,
      "userId:",
      userId || "guest"
    );

    // Validate contract exists - for guest users, check by contractId only
    let contract;
    if (userId) {
      // Authenticated user - check ownership
      contract = await SignedContract.findOne({
        _id: contractId,
        userId,
        status: "payment_pending",
      });
    } else {
      // Guest user - just check contract exists and is payment pending
      contract = await SignedContract.findOne({
        _id: contractId,
        status: "payment_pending",
      });
    }

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found or not eligible for payment",
      });
    }

    // Check if this is a free subscription (paymentIntentId starts with 'free_')
    const isFreeSubscription = paymentIntentId && paymentIntentId.toString().startsWith('free_');

    let paymentIntent;
    let actualAmountPaid = 0;
    let subscriptionType = "monthly"; // Default

    if (isFreeSubscription) {
      console.log("✅ Processing free subscription");
      // For free subscriptions, no Stripe payment intent exists
      // Set default values
      actualAmountPaid = 0;
      subscriptionType = "monthly"; // Free subscriptions default to monthly
    } else {
      // Retrieve payment intent from Stripe for paid subscriptions
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          success: false,
          message: "Payment not completed",
          status: paymentIntent.status,
        });
      }

      // Get subscription type from payment intent metadata
      subscriptionType = paymentIntent.metadata.subscriptionType || "monthly";

      // ✅ USE ACTUAL AMOUNT PAID FROM STRIPE (includes discounts)
      // Convert from cents to dollars
      actualAmountPaid = paymentIntent.amount / 100;

      console.log("💰 Using actual amount paid from Stripe:", {
        amountInCents: paymentIntent.amount,
        amountInDollars: actualAmountPaid,
        contractId: contractId,
        subscriptionType: subscriptionType
      });
    }

    // Get pricing information with normalized product type
    const normalizedProductType = normalizeProductType(contract.productType);
    const productInfo = PRODUCT_PRICING[normalizedProductType];
    const price = actualAmountPaid;      // Calculate subscription dates
    const startDate = new Date();
    const endDate = calculateSubscriptionEndDate(startDate, subscriptionType);

    // Update contract with payment information and subscription data
    const updatedContract = await SignedContract.findByIdAndUpdate(
      contractId,
      {
        status: "completed",
        paymentId: paymentIntentId,
        paymentProvider: isFreeSubscription ? "free" : "stripe",
        paymentCompletedAt: new Date(),
        subscriptionType: subscriptionType,
        subscriptionPrice: price,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
      },
      { new: true }
    );

    console.log(`✅ ${isFreeSubscription ? 'Free subscription' : 'Stripe payment'} completed, processing user account...`);

    // Handle post-payment user account creation/update
    const accountResult = await handlePostPaymentUserAccount(updatedContract);

    // Get the actual plan from database to use its displayName
    const MembershipPlan = require('../../subscription/models/membershipPlan.model');
    let actualPlan = null;

    // Determine subscription name from product pricing configuration
    let newSubscription;
    if (typeof productInfo.monthly === 'object' && productInfo.monthly.name) {
      // For products with nested pricing structure (e.g., script, investment-advising)
      newSubscription = productInfo.monthly.name;
    } else if (productInfo.name) {
      // For products with direct pricing (e.g., basic, diamond, infinity)
      newSubscription = productInfo.name;
    } else {
      // Last resort fallback - use normalized product type
      newSubscription = normalizedProductType.charAt(0).toUpperCase() + normalizedProductType.slice(1);
    }
    console.log(`💳 Subscription determined from pricing config: "${newSubscription}" (productType: "${contract.productType}", normalized: "${normalizedProductType}")`);

    try {
      // Try to find the plan by normalized product type for database linkage
      actualPlan = await MembershipPlan.findOne({
        name: normalizedProductType,
        isActive: { $ne: false }
      }).lean();

      if (actualPlan) {
        // If we found the plan in DB, use its displayName if available
        if (actualPlan.displayName) {
          newSubscription = actualPlan.displayName;
          console.log(`✅ Found plan in database: "${actualPlan.name}" → displayName: "${actualPlan.displayName}"`);
        }
      } else {
        console.log(`⚠️ Plan not found in database for "${normalizedProductType}", using pricing config name: "${newSubscription}"`);
      }
    } catch (error) {
      console.error("❌ Error fetching plan from database:", error.message);
      console.log(`⚠️ Using pricing config name as fallback: "${newSubscription}"`);
    }

    // Update user subscription if user exists and is active
    if (accountResult.user && !accountResult.user.isPendingUser && newSubscription) {
      await User.findByIdAndUpdate(accountResult.user._id, {
        subscription: newSubscription,
        subscriptionStatus: "active",
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionPlanId: actualPlan ? actualPlan._id : null,
        billingCycle: subscriptionType === "yearly" ? "yearly" : "monthly",
        lastPaymentAmount: price,
      });
      console.log("✅ User subscription updated to:", newSubscription);

      // Refresh user data to get updated subscription
      accountResult.user = await User.findById(accountResult.user._id);
    }

    // ✅ Transaction creation removed from backend
    // Frontend will create transaction with correct discount information
    console.log("💳 Payment confirmed. Frontend will create transaction with discount details.");

    res.json({
      success: true,
      message: accountResult.message || "Payment confirmed successfully",
      contract: updatedContract,
      userAccount: {
        status: accountResult.status,
        userId: accountResult.user ? accountResult.user._id : null,
        email: accountResult.user ? accountResult.user.email : null,
        isPending: accountResult.user ? accountResult.user.isPendingUser : false
      }
    });
  } catch (error) {
    console.error("Payment Confirmation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};





