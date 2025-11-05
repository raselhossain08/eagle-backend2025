# Migrating Existing Payment Controllers to Use Dynamic Configuration

## Overview

This guide shows how to update your existing payment controllers to use database-configured gateway settings instead of hardcoded environment variables.

---

## ❌ Old Way (Hardcoded Environment Variables)

```javascript
// src/controllers/contractPayment.controller.js
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.createPayment = async (req, res) => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: "usd",
  });
};
```

**Problems:**

- Requires server restart to change keys
- Can't switch between test/live modes easily
- No centralized management
- No audit trail

---

## ✅ New Way (Dynamic Database Configuration)

```javascript
// src/controllers/contractPayment.controller.js
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");

exports.createPayment = async (req, res) => {
  try {
    // Get Stripe client from database or environment
    const stripe = await DynamicPaymentConfig.getStripeClient();

    if (!stripe) {
      return res.status(503).json({
        success: false,
        message:
          "Stripe is not configured. Please configure it in admin dashboard.",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000,
      currency: "usd",
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
```

---

## 📝 Example: Update contractPayment.controller.js

### Before (Line 5):

```javascript
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
```

### After:

```javascript
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");
// Remove the hardcoded stripe initialization
```

### Update Payment Intent Function:

```javascript
// OLD
const createStripePaymentIntent = async (req, res) => {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const paymentIntent = await stripe.paymentIntents.create({...});
};

// NEW
const createStripePaymentIntent = async (req, res) => {
  const stripe = await DynamicPaymentConfig.getStripeClient();

  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: 'Stripe is not configured'
    });
  }

  const paymentIntent = await stripe.paymentIntents.create({...});
};
```

---

## 📝 Example: Update PayPal Controllers

### Before:

```javascript
const paypal = require("paypal-rest-sdk");

paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});
```

### After:

```javascript
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");

// In your controller function
const createPayPalPayment = async (req, res) => {
  const paypal = await DynamicPaymentConfig.getPayPalClient();

  if (!paypal) {
    return res.status(503).json({
      success: false,
      message: "PayPal is not configured",
    });
  }

  // Use paypal as normal
  const create_payment_json = {
    intent: "sale",
    payer: { payment_method: "paypal" },
    // ... rest of config
  };

  paypal.payment.create(create_payment_json, (error, payment) => {
    // Handle response
  });
};
```

---

## 🎯 Step-by-Step Migration

### Step 1: Update contractPayment.controller.js

```javascript
// At the top of the file, REMOVE:
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ADD:
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");

// Find all functions that use stripe, for example:
// createStripePaymentIntent, handleStripeWebhook, etc.

// BEFORE each function that needs stripe, add:
const stripe = await DynamicPaymentConfig.getStripeClient();
if (!stripe) {
  return res.status(503).json({
    success: false,
    message:
      "Stripe payment gateway is not configured. Please contact administrator.",
  });
}
```

### Step 2: Update PayPal Controllers

```javascript
// In src/controllers/paypalController.js or similar

// REMOVE hardcoded config at top
// ADD at top:
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");

// In each function:
exports.createPayment = async (req, res) => {
  const paypal = await DynamicPaymentConfig.getPayPalClient();

  if (!paypal) {
    return res.status(503).json({
      success: false,
      message: "PayPal is not configured",
    });
  }

  // Rest of your code...
};
```

### Step 3: Update Webhook Handlers

```javascript
// Webhook handler example
exports.handleStripeWebhook = async (req, res) => {
  const stripe = await DynamicPaymentConfig.getStripeClient();

  if (!stripe) {
    return res.status(503).send("Stripe not configured");
  }

  // Get webhook secret from config
  const PaymentGatewayService = require("../admin/services/paymentGateway.service");
  const config = await PaymentGatewayService.getStripeConfig();

  const sig = req.headers["stripe-signature"];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      config.webhookSecret // Use from database
    );

    // Handle event...
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
};
```

---

## 🔄 Handling Gateway Availability

### Check Before Processing

```javascript
const processPayment = async (req, res) => {
  const { gateway } = req.body; // 'stripe' or 'paypal'

  // Check if gateway is enabled
  const isEnabled = await DynamicPaymentConfig.isGatewayEnabled(gateway);

  if (!isEnabled) {
    return res.status(503).json({
      success: false,
      message: `${gateway} payment gateway is currently disabled`,
      availableGateways: await getAvailableGateways(),
    });
  }

  // Process payment...
};

async function getAvailableGateways() {
  const configs = await DynamicPaymentConfig.getAllConfigs();
  return Object.entries(configs)
    .filter(([_, config]) => config.enabled)
    .map(([name, _]) => name);
}
```

### Graceful Fallback

```javascript
const processPayment = async (req, res) => {
  let stripe = await DynamicPaymentConfig.getStripeClient();

  // If primary gateway fails, try alternative
  if (!stripe) {
    console.warn("Stripe unavailable, checking PayPal...");
    const paypal = await DynamicPaymentConfig.getPayPalClient();

    if (!paypal) {
      return res.status(503).json({
        success: false,
        message: "No payment gateways available",
      });
    }

    // Process with PayPal instead
    return processPayPalPayment(req, res, paypal);
  }

  // Process with Stripe
  return processStripePayment(req, res, stripe);
};
```

---

## 🧪 Testing After Migration

### 1. Test with Environment Variables (Current Setup)

```bash
# Make sure your .env has:
STRIPE_SECRET_KEY=sk_test_xxxxx
PAYPAL_CLIENT_ID=xxxxx

# Test payment endpoint
curl -X POST http://localhost:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'
```

### 2. Configure via Dashboard

```bash
# Update Stripe via API
curl -X PUT http://localhost:5000/api/admin/payment-gateways/stripe \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "mode": "test",
    "publishableKey": "pk_test_xxxxx",
    "secretKey": "sk_test_xxxxx"
  }'
```

### 3. Test with Database Config

```bash
# Remove or comment out from .env:
# STRIPE_SECRET_KEY=
# PAYPAL_CLIENT_ID=

# Restart server
npm start

# Test payment endpoint again (should use database config)
curl -X POST http://localhost:5000/api/payments/create \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "currency": "usd"}'
```

### 4. Verify Configuration Source

```bash
# Check which config is being used
curl http://localhost:5000/api/admin/payment-gateways/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Should show "source": "database" if using DB config
# Shows "source": "environment" if using .env
```

---

## 📊 Complete Example: Fully Migrated Controller

```javascript
const DynamicPaymentConfig = require("../config/dynamicPaymentConfig");
const PaymentGatewayService = require("../admin/services/paymentGateway.service");

class PaymentController {
  /**
   * Create payment with auto-gateway selection
   */
  static async createPayment(req, res) {
    try {
      const { amount, currency, gateway } = req.body;

      // Get available gateways
      const configs = await DynamicPaymentConfig.getAllConfigs();

      // Use specified gateway or pick first available
      const selectedGateway =
        gateway ||
        (configs.stripe.enabled
          ? "stripe"
          : configs.paypal.enabled
          ? "paypal"
          : null);

      if (!selectedGateway) {
        return res.status(503).json({
          success: false,
          message: "No payment gateways are currently available",
        });
      }

      // Process based on gateway
      if (selectedGateway === "stripe") {
        return await this.processStripePayment(req, res, amount, currency);
      } else if (selectedGateway === "paypal") {
        return await this.processPayPalPayment(req, res, amount, currency);
      }
    } catch (error) {
      console.error("Payment error:", error);
      res.status(500).json({
        success: false,
        message: "Payment processing failed",
        error: error.message,
      });
    }
  }

  /**
   * Process Stripe payment
   */
  static async processStripePayment(req, res, amount, currency) {
    const stripe = await DynamicPaymentConfig.getStripeClient();

    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: "Stripe is not available",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency || "usd",
      metadata: {
        userId: req.user?.id,
        source: "web",
      },
    });

    return res.json({
      success: true,
      gateway: "stripe",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  }

  /**
   * Process PayPal payment
   */
  static async processPayPalPayment(req, res, amount, currency) {
    const paypal = await DynamicPaymentConfig.getPayPalClient();

    if (!paypal) {
      return res.status(503).json({
        success: false,
        message: "PayPal is not available",
      });
    }

    const create_payment_json = {
      intent: "sale",
      payer: { payment_method: "paypal" },
      redirect_urls: {
        return_url: `${process.env.BASE_URL}/payment/success`,
        cancel_url: `${process.env.BASE_URL}/payment/cancel`,
      },
      transactions: [
        {
          amount: {
            currency: currency || "USD",
            total: amount.toFixed(2),
          },
          description: "Payment",
        },
      ],
    };

    return new Promise((resolve, reject) => {
      paypal.payment.create(create_payment_json, (error, payment) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: "PayPal payment creation failed",
            error: error.message,
          });
        }

        const approvalUrl = payment.links.find(
          (link) => link.rel === "approval_url"
        );

        res.json({
          success: true,
          gateway: "paypal",
          paymentId: payment.id,
          approvalUrl: approvalUrl?.href,
        });
      });
    });
  }
}

module.exports = PaymentController;
```

---

## ✅ Migration Checklist

- [ ] Install/update dependencies: `npm install`
- [ ] Add `GATEWAY_ENCRYPTION_KEY` to .env (32 characters)
- [ ] Initialize SystemSettings collection
- [ ] Update all payment controllers to use `DynamicPaymentConfig`
- [ ] Remove hardcoded stripe/paypal initialization
- [ ] Add null checks for gateway availability
- [ ] Update webhook handlers to use database config
- [ ] Test with environment variables first
- [ ] Configure via dashboard API
- [ ] Test with database configuration
- [ ] Remove environment variables (optional)
- [ ] Update frontend to show gateway status
- [ ] Document for team members

---

## 🎉 Benefits After Migration

1. ✅ Change API keys without server restart
2. ✅ Switch between test/live modes instantly
3. ✅ Central management via admin dashboard
4. ✅ Audit trail of all configuration changes
5. ✅ Test credentials before going live
6. ✅ Graceful fallback to environment variables
7. ✅ Real-time gateway status monitoring
8. ✅ Support for multiple environments easily
