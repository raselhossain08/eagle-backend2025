const axios = require("axios");
const { SignedContract } = require("../models/contract.model");
const User = require("../../user/models/user.model");
const PAYMENT_BRANDING = require("../config/paymentBranding");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const crypto = require("crypto");
const emailService = require("../../services/emailService");
require("dotenv").config();

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

      // Update user subscription based on product type (only for active users)
      const subscriptionMap = {
        basic: "Basic",
        script: "Script", 
        diamond: "Diamond",
        infinity: "Infinity",
        "investment-advising": "Diamond",
        "trading-tutor": "Basic",
        ultimate: "Infinity",
      };

      const newSubscription = subscriptionMap[normalizedProductType];
      
      // Update user subscription if user exists and is active
      if (accountResult.user && !accountResult.user.isPendingUser && newSubscription) {
        await User.findByIdAndUpdate(accountResult.user._id, {
          subscription: newSubscription,
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
    const { contractId, subscriptionType = "monthly" } = req.body; // Default to monthly
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Creating Stripe payment intent for contract:",
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

    // Create Stripe payment intent
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Create Stripe payment intent with proper branding
    const productDescription = PAYMENT_BRANDING.getProductDescription(productInfo, subscriptionType);
    const statementSuffix = PAYMENT_BRANDING.getStatementDescriptorSuffix(productInfo.name);

    // Get email for receipt - from authenticated user or contract
    const receiptEmail = PAYMENT_BRANDING.stripe.receiptEmail 
      ? (req.user ? req.user.email : (contract.email && contract.email.trim() ? contract.email.trim() : null))
      : null;

    console.log("💳 Creating Stripe payment intent:", {
      amount: Math.round(parseFloat(price) * 100),
      contractId: contract._id,
      userId: userId || "guest",
      receiptEmail,
      contractEmail: contract.email,
      productType: contract.productType
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(price) * 100), // Convert to cents
      currency: "usd",
      metadata: {
        contractId: contract._id.toString(),
        userId: userId || "guest",
        productType: contract.productType,
        subscriptionType: subscriptionType,
        ...PAYMENT_BRANDING.stripe.metadata,
        productName: productInfo.name,
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
      "Confirming Stripe payment:",
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

    // Retrieve payment intent from Stripe
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: "Payment not completed",
        status: paymentIntent.status,
      });
    }

    // Get subscription type from payment intent metadata
    const subscriptionType =
      paymentIntent.metadata.subscriptionType || "monthly";

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

    // Update contract with payment information and subscription data
    const updatedContract = await SignedContract.findByIdAndUpdate(
      contractId,
      {
        status: "completed",
        paymentId: paymentIntentId,
        paymentProvider: "stripe",
        paymentCompletedAt: new Date(),
        subscriptionType: subscriptionType,
        subscriptionPrice: price,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
      },
      { new: true }
    );

    console.log("✅ Stripe payment completed, processing user account...");

    // Handle post-payment user account creation/update
    const accountResult = await handlePostPaymentUserAccount(updatedContract);

    // Update user subscription based on product type (only for active users)
    const subscriptionMap = {
      basic: "Basic",
      script: "Script",
      diamond: "Diamond",
      infinity: "Infinity",
      "investment-advising": "Diamond",
      "trading-tutor": "Basic",
      ultimate: "Infinity",
    };

    const newSubscription = subscriptionMap[normalizedProductType];
    
    // Update user subscription if user exists and is active
    if (accountResult.user && !accountResult.user.isPendingUser && newSubscription) {
      await User.findByIdAndUpdate(accountResult.user._id, {
        subscription: newSubscription,
      });
      console.log("✅ User subscription updated to:", newSubscription);
    }

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
    console.error("Stripe Payment Confirmation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};





