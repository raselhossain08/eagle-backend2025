const axios = require("axios");
const SignedContract = require("../models/signedContract.model");
const User = require("../user/models/user.model");
const Transaction = require("../transaction/models/transaction.model");
const PAYMENT_BRANDING = require("../config/paymentBranding");
const crypto = require("crypto");
const emailService = require("../services/emailService");

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
    .replace(/-advisory$/, "") // Remove -advisory suffix (diamond-advisory → diamond)
    .replace(/-membership$/, "") // Remove -membership suffix (infinity-membership → infinity)
    .replace(/-access$/, "") // Remove -access suffix (script-access → script)
    .replace(/^mentorship-/, "")
    .replace(/^product-/, "");

  // Handle special cases
  if (normalized === "mentorship" || normalized === "package") {
    return "basic"; // Default mentorship package to basic pricing
  }

  if (normalized === "trading-tutoring" || normalized === "trading-tutor") {
    return "trading-tutor";
  }

  if (normalized === "eagle-ultimate" || normalized === "ultimate") {
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

// Helper function to get subscription name from product configuration
const getSubscriptionName = (productInfo, normalizedProductType) => {
  // Determine subscription name from product pricing configuration
  let subscriptionName;

  if (typeof productInfo.monthly === 'object' && productInfo.monthly.name) {
    // For products with nested pricing structure (e.g., script, investment-advising)
    subscriptionName = productInfo.monthly.name;
  } else if (productInfo.name) {
    // For products with direct pricing (e.g., basic, diamond, infinity)
    subscriptionName = productInfo.name;
  } else {
    // Last resort fallback - use normalized product type with capitalization
    subscriptionName = normalizedProductType.charAt(0).toUpperCase() + normalizedProductType.slice(1);
  }

  return subscriptionName;
};

// Helper function to get subscription from database and update name if found
const resolveSubscriptionWithDatabase = async (subscriptionName, normalizedProductType) => {
  const MembershipPlan = require('../subscription/models/membershipPlan.model');
  let actualPlan = null;
  let finalSubscriptionName = subscriptionName;

  try {
    // Try to find the plan by normalized product type for database linkage
    actualPlan = await MembershipPlan.findOne({
      slug: normalizedProductType.toLowerCase(),
      status: 'active'
    }).lean();

    if (actualPlan) {
      // If we found the plan in DB, capitalize the name properly for User enum
      finalSubscriptionName = actualPlan.name; // Use the name from DB which should be properly capitalized
      console.log(`✅ Found plan in database: "${actualPlan.slug}" → name: "${actualPlan.name}"`);
    } else {
      // Try to find by name as fallback
      actualPlan = await MembershipPlan.findOne({
        name: { $regex: new RegExp(`^${normalizedProductType}$`, 'i') },
        status: 'active'
      }).lean();

      if (actualPlan) {
        finalSubscriptionName = actualPlan.name;
        console.log(`✅ Found plan by name: "${actualPlan.name}"`);
      } else {
        // Capitalize first letter as fallback for User enum compatibility
        finalSubscriptionName = normalizedProductType.charAt(0).toUpperCase() + normalizedProductType.slice(1);
        console.log(`⚠️ Plan not found in database for "${normalizedProductType}", using capitalized name: "${finalSubscriptionName}"`);
      }
    }
  } catch (error) {
    console.error("❌ Error fetching plan from database:", error.message);
    // Capitalize first letter as fallback
    finalSubscriptionName = normalizedProductType.charAt(0).toUpperCase() + normalizedProductType.slice(1);
    console.log(`⚠️ Using capitalized name as fallback: "${finalSubscriptionName}"`);
  }

  return { subscriptionName: finalSubscriptionName, plan: actualPlan };
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

      // Send account activation email (password setup)
      await emailService.sendAccountActivationEmail(
        user.email,
        user.name,
        user.activationToken,
        process.env.FRONTEND_URL || 'http://localhost:3000'
      );

      console.log("📧 Account activation email sent to pending user:", user.email);

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
    const { contractId, subscriptionType = "monthly", discountCode, discountAmount, amount } = req.body; // Accept discount info and amount
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Creating PayPal order for contract:",
      contractId,
      "subscription:",
      subscriptionType,
      "userId:",
      userId || "guest",
      "discount:",
      discountCode || "none",
      "frontendAmount:",
      amount || "not provided"
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

    // Use frontend amount if provided (trusted source after discount validation)
    let finalPrice;
    if (amount && parseFloat(amount) > 0) {
      finalPrice = parseFloat(amount);
      console.log(`💰 Using frontend amount (already discounted): $${finalPrice}`);
      console.log(`ℹ️ Skipping backend price calculation - trusting frontend`);
    } else {
      // Fallback: Apply discount to calculated price
      finalPrice = price;
      if (discountAmount && discountAmount > 0) {
        finalPrice = Math.max(0, price - discountAmount); // Ensure non-negative
        console.log(`💰 Applying discount to calculated price: $${price} - $${discountAmount} = $${finalPrice}`);
      }
    }

    // Ensure finalPrice is never negative or zero
    if (finalPrice <= 0) {
      console.error(`❌ Invalid final price: $${finalPrice}. Price: $${price}, Discount: $${discountAmount}, Frontend Amount: $${amount}`);
      return res.status(400).json({
        success: false,
        message: `Invalid price calculation. Final price cannot be negative or zero. Please check your discount code or contact support.`,
        details: {
          calculatedPrice: price,
          discountAmount: discountAmount || 0,
          frontendAmount: amount || null,
          finalPrice,
          suggestion: amount && parseFloat(amount) > 0 ? "Frontend sent valid amount but discount mismatch" : "No valid amount provided"
        }
      });
    }

    const subscriptionTypeText =
      subscriptionType === "yearly" ? "Yearly" : "Monthly";

    const accessToken = await generateAccessToken();

    // Format price for PayPal (must be string with 2 decimal places)
    const formattedPrice = parseFloat(finalPrice).toFixed(2);

    console.log("PayPal Order Details:", {
      contractId,
      originalPrice: price,
      discountAmount: discountAmount || 0,
      finalPrice,
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
      amount: finalPrice, // Return the discounted price
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
    const { contractId, subscriptionType = "monthly", discountCode, discountAmount, amount } = req.body; // Get discount info and amount from request
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Capturing PayPal order:",
      orderId,
      "for contract:",
      contractId,
      "subscription:",
      subscriptionType,
      "userId:",
      userId || "guest",
      "discount:",
      discountCode || "none",
      "frontendAmount:",
      amount || "not provided"
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

      // Use frontend amount if provided (trusted source after discount validation)
      let finalPrice;
      if (amount && parseFloat(amount) > 0) {
        finalPrice = parseFloat(amount);
        console.log(`💰 Using frontend amount in capture (already discounted): $${finalPrice}`);
        // Validate that frontend amount makes sense
        const calculatedPrice = discountAmount && discountAmount > 0 ? price - discountAmount : price;
        const difference = Math.abs(finalPrice - calculatedPrice);
        if (difference > 0.01) {
          console.warn(`⚠️ Frontend amount ($${finalPrice}) differs from calculated ($${calculatedPrice})`);
        }
      } else {
        // Fallback: Apply discount to calculated price
        finalPrice = price;
        if (discountAmount && discountAmount > 0) {
          finalPrice = price - discountAmount;
          console.log(`💰 Applied discount in capture: $${price} - $${discountAmount} = $${finalPrice}`);
        }
      }

      // Calculate subscription dates
      const startDate = new Date();
      const endDate = calculateSubscriptionEndDate(startDate, subscriptionType);

      // Update contract status with subscription information and discount
      const updateData = {
        status: "completed",
        paymentId: orderId,
        paymentProvider: "paypal",
        subscriptionType: subscriptionType,
        subscriptionPrice: finalPrice, // Save discounted price
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
      };

      // Add discount information if discount was applied
      if (discountCode && discountAmount) {
        updateData.discountCode = discountCode;
        updateData.discountAmount = discountAmount;
        updateData.originalPrice = price;
      }

      const updatedContract = await SignedContract.findByIdAndUpdate(
        contractId,
        updateData,
        { new: true }
      );

      console.log("✅ PayPal payment completed, processing user account...");

      // Handle post-payment user account creation/update
      const accountResult = await handlePostPaymentUserAccount(updatedContract);

      // Get subscription name from product pricing configuration
      let newSubscription = getSubscriptionName(productInfo, normalizedProductType);
      console.log(`💳 Subscription determined from pricing config: "${newSubscription}" (productType: "${updatedContract.productType}", normalized: "${normalizedProductType}")`);

      // Try to resolve from database and get actual plan
      const { subscriptionName, plan: actualPlan } = await resolveSubscriptionWithDatabase(newSubscription, normalizedProductType);
      newSubscription = subscriptionName;

      console.log("🔍 Subscription Update Check:", {
        hasUser: !!accountResult.user,
        userId: accountResult.user?._id,
        isPendingUser: accountResult.user?.isPendingUser,
        normalizedProductType,
        newSubscription,
        actualPlanFound: !!actualPlan,
        willUpdate: accountResult.user && !accountResult.user.isPendingUser && newSubscription
      });

      // Update user subscription if user exists (even if pending, they paid!)
      if (accountResult.user && newSubscription) {
        console.log("🔍 MembershipPlan Info:", {
          subscriptionName: newSubscription,
          found: !!actualPlan,
          planId: actualPlan?._id,
          planName: actualPlan?.name
        });

        const userUpdateData = {
          subscription: newSubscription, // Use resolved subscription name
          subscriptionStatus: 'active',
          subscriptionStartDate: startDate,
          subscriptionEndDate: endDate,
          nextBillingDate: endDate,
          lastBillingDate: startDate,
          lastPaymentAmount: finalPrice,
          billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
          isActive: true, // Activate user after payment
          isPendingUser: false, // Clear pending status after payment
        };

        // Add plan reference if found
        if (actualPlan) {
          userUpdateData.subscriptionPlanId = actualPlan._id;
          console.log("✅ Using membership plan:", actualPlan.name);
        } else {
          console.warn("⚠️ No membership plan found in database for:", newSubscription);
        }

        console.log("📝 Updating user with data:", userUpdateData);

        const updatedUser = await User.findByIdAndUpdate(
          accountResult.user._id,
          {
            $set: userUpdateData,
            $inc: {
              totalSpent: finalPrice,
              lifetimeValue: finalPrice
            }
          },
          { new: true }
        );

        console.log("✅ User subscription updated:", {
          userId: updatedUser._id,
          subscription: updatedUser.subscription,
          subscriptionStatus: updatedUser.subscriptionStatus,
          isActive: updatedUser.isActive,
          isPendingUser: updatedUser.isPendingUser
        });

        // Create or update Subscription record
        const Subscription = require('../subscription/models/subscription.model');
        const existingSubscription = await Subscription.findOne({
          userId: accountResult.user._id,
          status: { $in: ['active', 'trial', 'paused'] }
        });

        if (existingSubscription) {
          // Update existing subscription
          await Subscription.findByIdAndUpdate(existingSubscription._id, {
            planId: actualPlan?._id,
            status: 'active',
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
            currentPrice: finalPrice,
            currency: 'USD',
            ...(discountCode && { appliedDiscounts: [{ code: discountCode, amount: discountAmount }] })
          });
          console.log("✅ Updated existing subscription record");
        } else if (actualPlan) {
          // Create new subscription record
          await Subscription.create({
            userId: accountResult.user._id,
            planId: actualPlan._id,
            status: 'active',
            currentPeriodStart: startDate,
            currentPeriodEnd: endDate,
            billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
            currentPrice: finalPrice,
            currency: 'USD',
            paymentMethod: 'paypal',
            autoRenew: true,
            ...(discountCode && { appliedDiscounts: [{ code: discountCode, amount: discountAmount }] })
          });
          console.log("✅ Created new subscription record");
        }

        // Create transaction record with userId link
        try {
          const transaction = await Transaction.createCharge({
            userId: accountResult.user._id, // Link to user
            type: 'charge',
            status: 'succeeded',
            amount: {
              gross: Math.round(finalPrice * 100), // Convert to cents
              fee: 0,
              net: Math.round(finalPrice * 100),
              tax: 0,
              discount: discountAmount ? Math.round(discountAmount * 100) : 0,
            },
            currency: 'USD',
            psp: {
              provider: 'paypal',
              reference: {
                transactionId: orderId,
              },
            },
            paymentMethod: {
              type: 'paypal',
              ...(accountResult.user?.email && {
                digital: {
                  email: accountResult.user.email,
                },
              }),
            },
            description: `Payment for ${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
            metadata: {
              contractId: contractId,
              productType: 'mentorship-package',
              productName: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
              plan: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
              subscriptionType: subscriptionType === 'one-time' ? 'one-time' : subscriptionType,
              paymentMethod: 'paypal',
              items: [
                {
                  id: actualPlan?._id || normalizedProductType,
                  name: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
                  quantity: 1,
                  price: finalPrice,
                  originalPrice: price,
                  memberPrice: finalPrice,
                },
              ],
              discountApplied: !!discountCode,
              discountAmount: discountAmount || 0,
              originalAmount: price,
            },
          });
          console.log("✅ Created transaction record:", transaction.transactionId);
        } catch (txError) {
          console.error("❌ Failed to create transaction record:", txError);
          // Don't fail the payment, just log the error
        }
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
    const { contractId, subscriptionType = "monthly", discountCode, discountAmount, amount } = req.body; // Accept discount info and amount
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Creating Stripe payment intent for contract:",
      contractId,
      "subscription:",
      subscriptionType,
      "userId:",
      userId || "guest",
      "discount:",
      discountCode || "none",
      "frontendAmount:",
      amount || "not provided",
      "frontendDiscountAmount:",
      discountAmount || "not provided"
    );

    // Validate discount amount is not absurdly large
    if (discountAmount && discountAmount > 10000) {
      console.error(`❌ Suspicious discount amount: $${discountAmount} - likely in cents instead of dollars`);
      return res.status(400).json({
        success: false,
        message: "Invalid discount amount - please check your request",
        details: {
          receivedDiscountAmount: discountAmount,
          issue: "Discount amount appears to be in wrong units (cents vs dollars)"
        }
      });
    }

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

    // Use contract's productName and amount if available, otherwise fallback to static pricing
    let price;
    let productName;

    if (contract.productName && contract.amount) {
      // Use contract data (preferred - contains actual cart/package data)
      price = parseFloat(contract.amount);
      productName = contract.productName;
      console.log(`✅ Using contract data: ${productName} - $${price}`);
    } else {
      // Fallback to static pricing config
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
      if (typeof productInfo.monthly === "object") {
        // For products with nested pricing structure (script, investment-advising, etc.)
        price =
          subscriptionType === "yearly"
            ? parseFloat(productInfo.yearly.price)
            : parseFloat(productInfo.monthly.price);
        productName =
          subscriptionType === "yearly"
            ? productInfo.yearly.name
            : productInfo.monthly.name;
      } else {
        // For products with direct pricing (basic, diamond, infinity)
        price =
          subscriptionType === "yearly"
            ? productInfo.yearly
            : productInfo.monthly;
        productName = productInfo.name;
      }
      console.log(`⚠️ Using fallback static pricing: ${productName} - $${price}`);
    }

    // Use frontend amount if provided (trusted source after discount validation)
    let finalPrice;
    if (amount && parseFloat(amount) >= 0) {
      finalPrice = parseFloat(amount);
      console.log(`💰 Using frontend amount for Stripe (already discounted): $${finalPrice}`);
      // Validate that frontend amount makes sense
      const calculatedPrice = discountAmount && discountAmount > 0 ? Math.max(0, price - discountAmount) : price;
      const difference = Math.abs(finalPrice - calculatedPrice);
      if (difference > 0.01) {
        console.warn(`⚠️ Frontend amount ($${finalPrice}) differs from calculated ($${calculatedPrice})`);
      }
    } else {
      // Fallback: Apply discount to calculated price
      finalPrice = price;
      if (discountAmount && discountAmount > 0) {
        finalPrice = Math.max(0, price - discountAmount);
        console.log(`💰 Applying discount to Stripe payment: $${price} - $${discountAmount} = $${finalPrice}`);
      }
    }

    // Validate final price is not negative
    if (finalPrice < 0) {
      console.error(`❌ Invalid final price: $${finalPrice} (original: $${price}, discount: $${discountAmount || 0})`);
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount calculated",
        details: {
          originalPrice: price,
          discountAmount: discountAmount || 0,
          calculatedPrice: finalPrice,
          issue: "Discount exceeds product price"
        }
      });
    }

    // Stripe requires minimum 1 cent (except for $0 which means free)
    if (finalPrice > 0 && finalPrice < 0.01) {
      console.warn(`⚠️ Final price ($${finalPrice}) is below Stripe minimum, rounding to $0.01`);
      finalPrice = 0.01;
    }

    const subscriptionTypeText =
      subscriptionType === "yearly" ? "Yearly" : "Monthly";

    // Create Stripe payment intent
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    // Create Stripe payment intent with proper branding
    const productDescription = PAYMENT_BRANDING.getProductDescription(
      { name: productName || productInfo.name || "Eagle Subscription" },
      subscriptionType
    );
    const statementSuffix = PAYMENT_BRANDING.getStatementDescriptorSuffix(
      productName || productInfo.name || "EAGLE"
    );

    // Get email for receipt - from authenticated user or contract
    const receiptEmail = PAYMENT_BRANDING.stripe.receiptEmail
      ? (req.user ? req.user.email : (contract.email && contract.email.trim() ? contract.email.trim() : null))
      : null;

    console.log("💳 Creating Stripe payment intent:", {
      amount: Math.round(parseFloat(finalPrice) * 100),
      originalPrice: price,
      discountAmount: discountAmount || 0,
      contractId: contract._id,
      userId: userId || "guest",
      receiptEmail,
      contractEmail: contract.email,
      productType: contract.productType
    });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parseFloat(finalPrice) * 100), // Convert to cents with discount applied
      currency: "usd",
      metadata: {
        contractId: contract._id.toString(),
        userId: userId || "guest",
        productType: contract.productType,
        subscriptionType: subscriptionType,
        ...PAYMENT_BRANDING.stripe.metadata,
        productName: productName,
        ...(discountCode && { discountCode }),
        ...(discountAmount && { discountAmount: discountAmount.toString() }),
        ...(discountAmount && { originalPrice: price.toString() }),
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
    const { paymentIntentId, contractId, discountCode, discountAmount, amount } = req.body;
    const userId = req.user ? req.user.id : null; // Support guest users

    console.log(
      "Confirming payment:",
      paymentIntentId,
      "for contract:",
      contractId,
      "userId:",
      userId || "guest",
      "discount:",
      discountCode || "none",
      "frontendAmount:",
      amount || "not provided"
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
    let subscriptionType = "monthly"; // Default

    if (isFreeSubscription) {
      console.log("✅ Processing free subscription");
      // For free subscriptions, no Stripe payment intent exists
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
    }

    console.log("📄 Contract Product Type (Stripe):", {
      originalProductType: contract.productType,
      normalizedProductType: normalizeProductType(contract.productType)
    });

    // Define subscription mapping early (before use)
    const subscriptionMap = {
      basic: "Basic",
      script: "Script",
      diamond: "Diamond",
      infinity: "Infinity",
      "investment-advising": "Diamond",
      "investment-advisory": "Diamond", // Alternative spelling
      "trading-tutor": "Basic",
      ultimate: "Infinity",
      "ultimate-package": "Infinity", // Handle ultimate-package
    };

    // Get pricing information with normalized product type
    const normalizedProductType = normalizeProductType(contract.productType);

    console.log("📦 Product Type Analysis (Stripe):", {
      originalProductType: contract.productType,
      normalizedProductType,
      willMapTo: subscriptionMap[normalizedProductType] || "NOT FOUND"
    });

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

    // Use frontend amount if provided (trusted source after discount validation)
    let finalPrice;
    if (isFreeSubscription) {
      // Free subscriptions have zero cost
      finalPrice = 0;
      console.log("💰 Free subscription - no payment required");
    } else if (amount && parseFloat(amount) > 0) {
      finalPrice = parseFloat(amount);
      console.log(`💰 Using frontend amount in Stripe confirmation (already discounted): $${finalPrice}`);
      // Validate that frontend amount makes sense
      const calculatedPrice = discountAmount && discountAmount > 0 ? price - discountAmount : price;
      const difference = Math.abs(finalPrice - calculatedPrice);
      if (difference > 0.01) {
        console.warn(`⚠️ Frontend amount ($${finalPrice}) differs from calculated ($${calculatedPrice})`);
      }
    } else {
      // Fallback: Apply discount to calculated price
      finalPrice = price;
      if (discountAmount && discountAmount > 0) {
        finalPrice = price - discountAmount;
        console.log(`💰 Applied discount in Stripe confirmation: $${price} - $${discountAmount} = $${finalPrice}`);
      }
    }

    // Calculate subscription dates
    const startDate = new Date();
    const endDate = calculateSubscriptionEndDate(startDate, subscriptionType);

    // Update contract with payment information, subscription data, and discount
    const updateData = {
      status: "completed",
      paymentId: paymentIntentId,
      paymentProvider: isFreeSubscription ? "free" : "stripe",
      paymentCompletedAt: new Date(),
      subscriptionType: subscriptionType,
      subscriptionPrice: finalPrice, // Save discounted price
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
    };

    // Add discount information if discount was applied
    if (discountCode && discountAmount) {
      updateData.discountCode = discountCode;
      updateData.discountAmount = discountAmount;
      updateData.originalPrice = price;
    }

    const updatedContract = await SignedContract.findByIdAndUpdate(
      contractId,
      updateData,
      { new: true }
    );

    console.log(`✅ ${isFreeSubscription ? 'Free subscription' : 'Stripe payment'} completed, processing user account...`);

    // Handle post-payment user account creation/update
    const accountResult = await handlePostPaymentUserAccount(updatedContract);

    // Get subscription name from product pricing configuration
    let newSubscription = getSubscriptionName(productInfo, normalizedProductType);
    console.log(`💳 Subscription determined from pricing config: "${newSubscription}" (productType: "${updatedContract.productType}", normalized: "${normalizedProductType}")`);

    // Try to resolve from database and get actual plan
    const { subscriptionName, plan: actualPlan } = await resolveSubscriptionWithDatabase(newSubscription, normalizedProductType);
    newSubscription = subscriptionName;

    console.log("🔍 Stripe Subscription Update Check:", {
      hasUser: !!accountResult.user,
      userId: accountResult.user?._id,
      isPendingUser: accountResult.user?.isPendingUser,
      normalizedProductType,
      newSubscription,
      actualPlanFound: !!actualPlan,
      willUpdate: accountResult.user && !accountResult.user.isPendingUser && newSubscription
    });

    // Update user subscription if user exists (even if pending, they paid!)
    if (accountResult.user && newSubscription) {
      console.log("🔍 MembershipPlan Info (Stripe):", {
        subscriptionName: newSubscription,
        found: !!actualPlan,
        planId: actualPlan?._id,
        planName: actualPlan?.name
      });

      const userUpdateData = {
        subscription: newSubscription, // Use resolved subscription name
        subscriptionStatus: 'active',
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        nextBillingDate: endDate,
        lastBillingDate: startDate,
        lastPaymentAmount: finalPrice,
        billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
        isActive: true, // Activate user after payment
        isPendingUser: false, // Clear pending status after payment
      };

      // Add plan reference if found
      if (actualPlan) {
        userUpdateData.subscriptionPlanId = actualPlan._id;
        console.log("✅ Using membership plan:", actualPlan.name);
      } else {
        console.warn("⚠️ No membership plan found in database for:", newSubscription);
      }

      console.log("📝 Updating user with data (Stripe):", userUpdateData);

      const updatedUser = await User.findByIdAndUpdate(
        accountResult.user._id,
        {
          $set: userUpdateData,
          $inc: {
            totalSpent: finalPrice,
            lifetimeValue: finalPrice
          }
        },
        { new: true }
      );

      console.log("✅ User subscription updated (Stripe):", {
        userId: updatedUser._id,
        subscription: updatedUser.subscription,
        subscriptionStatus: updatedUser.subscriptionStatus,
        isActive: updatedUser.isActive,
        isPendingUser: updatedUser.isPendingUser
      });

      // Create or update Subscription record
      const Subscription = require('../subscription/models/subscription.model');
      const existingSubscription = await Subscription.findOne({
        userId: accountResult.user._id,
        status: { $in: ['active', 'trial', 'paused'] }
      });

      if (existingSubscription) {
        // Update existing subscription
        await Subscription.findByIdAndUpdate(existingSubscription._id, {
          planId: actualPlan?._id,
          status: 'active',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
          currentPrice: finalPrice,
          currency: 'USD',
          ...(discountCode && { appliedDiscounts: [{ code: discountCode, amount: discountAmount }] })
        });
        console.log("✅ Updated existing subscription record");
      } else if (actualPlan) {
        // Create new subscription record
        await Subscription.create({
          userId: accountResult.user._id,
          planId: actualPlan._id,
          status: 'active',
          currentPeriodStart: startDate,
          currentPeriodEnd: endDate,
          billingCycle: subscriptionType === 'yearly' ? 'yearly' : 'monthly',
          currentPrice: finalPrice,
          currency: 'USD',
          paymentMethod: 'stripe',
          autoRenew: true,
          ...(discountCode && { appliedDiscounts: [{ code: discountCode, amount: discountAmount }] })
        });
        console.log("✅ Created new subscription record");
      }

      // Create transaction record with userId link
      try {
        const transaction = await Transaction.createCharge({
          userId: accountResult.user._id, // Link to user
          type: 'charge',
          status: 'succeeded',
          amount: {
            gross: Math.round(finalPrice * 100), // Convert to cents
            fee: 0,
            net: Math.round(finalPrice * 100),
            tax: 0,
            discount: discountAmount ? Math.round(discountAmount * 100) : 0,
          },
          currency: 'USD',
          psp: {
            provider: 'stripe',
            reference: {
              paymentIntentId: paymentIntentId,
              chargeId: paymentIntent.latest_charge || paymentIntentId,
            },
          },
          paymentMethod: {
            type: 'card',
          },
          description: `Payment for ${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
          metadata: {
            contractId: contractId,
            productType: 'mentorship-package',
            productName: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
            plan: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
            subscriptionType: subscriptionType === 'one-time' ? 'one-time' : subscriptionType,
            paymentMethod: 'stripe',
            items: [
              {
                id: actualPlan?._id || normalizedProductType,
                name: `${productInfo.name} ${subscriptionType === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
                quantity: 1,
                price: finalPrice,
                originalPrice: price,
                memberPrice: finalPrice,
              },
            ],
            discountApplied: !!discountCode,
            discountAmount: discountAmount || 0,
            originalAmount: price,
          },
        });
        console.log("✅ Created transaction record:", transaction.transactionId);
      } catch (txError) {
        console.error("❌ Failed to create transaction record:", txError);
        // Don't fail the payment, just log the error
      }
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
    console.error("Payment Confirmation Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to confirm payment",
      error: error.message,
    });
  }
};
