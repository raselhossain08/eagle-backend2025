# Payment Gateway Dashboard Configuration

## Overview

You can now configure PayPal and Stripe API credentials directly from your admin dashboard instead of hardcoding them in environment variables. The system automatically:

- ✅ Stores credentials securely (encrypted in database)
- ✅ Falls back to environment variables if not configured in dashboard
- ✅ Supports test/sandbox and live modes
- ✅ Allows testing connections before saving
- ✅ Provides real-time status of all payment gateways

---

## 🔐 Security Features

1. **Encryption**: All secret keys are encrypted using AES-256-CBC before storing in database
2. **Access Control**: Only admin/super_admin roles can view/modify gateway settings
3. **Selective Response**: API responses never return secret keys, only status indicators
4. **Environment Fallback**: If database config fails, system falls back to environment variables

---

## 📡 API Endpoints

### Get Gateway Status

```http
GET /api/admin/payment-gateways/status
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "stripe": {
      "enabled": true,
      "mode": "test",
      "configured": true,
      "source": "database"
    },
    "paypal": {
      "enabled": true,
      "mode": "sandbox",
      "configured": true,
      "source": "database"
    }
  }
}
```

---

### Stripe Configuration

#### Get Stripe Config

```http
GET /api/admin/payment-gateways/stripe
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "mode": "test",
    "publishableKey": "pk_test_xxxxx",
    "hasSecretKey": true,
    "hasWebhookSecret": true,
    "source": "database"
  }
}
```

#### Update Stripe Config

```http
PUT /api/admin/payment-gateways/stripe
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "enabled": true,
  "mode": "test",
  "publishableKey": "pk_test_51Xxxxx",
  "secretKey": "sk_test_51Xxxxx",
  "webhookSecret": "whsec_xxxxx"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Stripe settings updated successfully",
  "data": {
    "enabled": true,
    "mode": "test"
  }
}
```

#### Test Stripe Connection

```http
POST /api/admin/payment-gateways/stripe/test
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "secretKey": "sk_test_51Xxxxx"  // Optional: test new key before saving
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Stripe connection successful",
  "balance": {
    "amount": 0,
    "currency": "usd"
  }
}
```

**Response (Failed):**

```json
{
  "success": false,
  "message": "Stripe connection failed: Invalid API Key provided"
}
```

---

### PayPal Configuration

#### Get PayPal Config

```http
GET /api/admin/payment-gateways/paypal
Authorization: Bearer {admin_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "mode": "sandbox",
    "clientId": "AXxxxxxxxxxxxx",
    "hasClientSecret": true,
    "webhookId": "xxxxx",
    "source": "database"
  }
}
```

#### Update PayPal Config

```http
PUT /api/admin/payment-gateways/paypal
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "enabled": true,
  "mode": "sandbox",
  "clientId": "AXxxxxxxxxxxxx",
  "clientSecret": "ELxxxxxxxxxxxx",
  "webhookId": "xxxxx"
}
```

**Response:**

```json
{
  "success": true,
  "message": "PayPal settings updated successfully",
  "data": {
    "enabled": true,
    "mode": "sandbox"
  }
}
```

#### Test PayPal Connection

```http
POST /api/admin/payment-gateways/paypal/test
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "clientId": "AXxxxxxxxxxxxx",      // Optional
  "clientSecret": "ELxxxxxxxxxxxx"   // Optional
}
```

**Response:**

```json
{
  "success": true,
  "message": "PayPal connection successful",
  "mode": "sandbox"
}
```

---

## 🎯 Usage in Your Code

### Using Dynamic Payment Config

Instead of directly using `process.env.STRIPE_SECRET_KEY`, use the dynamic config helper:

```javascript
const DynamicPaymentConfig = require("./config/dynamicPaymentConfig");

// Get Stripe client
const stripe = await DynamicPaymentConfig.getStripeClient();
if (stripe) {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: "usd",
  });
}

// Get PayPal config
const paypalConfig = await DynamicPaymentConfig.getPayPalConfig();
if (paypalConfig) {
  const paypal = require("paypal-rest-sdk");
  paypal.configure(paypalConfig);
}

// Check if gateway is enabled
const isStripeEnabled = await DynamicPaymentConfig.isGatewayEnabled("stripe");
const isPayPalEnabled = await DynamicPaymentConfig.isGatewayEnabled("paypal");

// Get all configs (cached for 5 minutes)
const allConfigs = await DynamicPaymentConfig.getAllConfigs();
console.log(allConfigs.stripe.enabled);
console.log(allConfigs.paypal.mode);

// Force refresh cache
const freshConfigs = await DynamicPaymentConfig.getAllConfigs(true);
```

---

## 📝 Configuration Priority

The system checks configurations in this order:

1. **Database Settings** (from admin dashboard)
   - If `enabled = true` and credentials exist in `SystemSettings`
2. **Environment Variables** (fallback)
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
3. **Default Values**
   - If nothing configured, gateway is disabled

---

## 🔧 Setup Instructions

### 1. Environment Setup (Optional - for encryption)

Add to your `.env` file:

```env
# Required for encrypting payment gateway credentials
GATEWAY_ENCRYPTION_KEY=your-32-character-secret-key-here
```

If not provided, a random key will be generated (not recommended for production).

### 2. Initialize System Settings

Run this once to create the system settings document:

```javascript
const SystemSettings = require("./src/admin/models/systemSettings.model");

async function initializeSystemSettings() {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({
      organizationName: "Eagle Trading",
      supportEmail: "support@example.com",
      defaultCurrency: "USD",
    });
    console.log("System settings initialized");
  }
}

initializeSystemSettings();
```

### 3. Configure Payment Gateways via Dashboard

Use the API endpoints to configure your payment gateways through your admin panel.

---

## 🧪 Testing

### Test Stripe Configuration

```bash
# Test with saved credentials
curl -X POST http://localhost:5000/api/admin/payment-gateways/stripe/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Test with new credentials before saving
curl -X POST http://localhost:5000/api/admin/payment-gateways/stripe/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"secretKey": "sk_test_51Xxxxx"}'
```

### Test PayPal Configuration

```bash
# Test with saved credentials
curl -X POST http://localhost:5000/api/admin/payment-gateways/paypal/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

# Test with new credentials before saving
curl -X POST http://localhost:5000/api/admin/payment-gateways/paypal/test \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "AXxxxxxxxxxxxx",
    "clientSecret": "ELxxxxxxxxxxxx"
  }'
```

---

## 🎨 Frontend Integration Example

### React Component for Admin Dashboard

```jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

function PaymentGatewaySettings() {
  const [stripe, setStripe] = useState({});
  const [paypal, setPayPal] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [stripeRes, paypalRes] = await Promise.all([
        axios.get("/api/admin/payment-gateways/stripe"),
        axios.get("/api/admin/payment-gateways/paypal"),
      ]);

      setStripe(stripeRes.data.data);
      setPayPal(paypalRes.data.data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStripe = async (data) => {
    try {
      await axios.put("/api/admin/payment-gateways/stripe", data);
      alert("Stripe settings updated successfully");
      loadSettings();
    } catch (error) {
      alert("Failed to update Stripe settings");
    }
  };

  const testStripe = async () => {
    try {
      const res = await axios.post("/api/admin/payment-gateways/stripe/test");
      alert(res.data.message);
    } catch (error) {
      alert("Stripe test failed");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="payment-settings">
      <h2>Payment Gateway Configuration</h2>

      {/* Stripe Settings */}
      <div className="gateway-card">
        <h3>Stripe</h3>
        <label>
          <input
            type="checkbox"
            checked={stripe.enabled}
            onChange={(e) => updateStripe({ enabled: e.target.checked })}
          />
          Enabled
        </label>

        <select
          value={stripe.mode}
          onChange={(e) => updateStripe({ mode: e.target.value })}
        >
          <option value="test">Test Mode</option>
          <option value="live">Live Mode</option>
        </select>

        <button onClick={testStripe}>Test Connection</button>

        <p>
          Status: {stripe.hasSecretKey ? "✅ Configured" : "❌ Not Configured"}
        </p>
        <p>Source: {stripe.source}</p>
      </div>

      {/* PayPal Settings */}
      <div className="gateway-card">
        <h3>PayPal</h3>
        {/* Similar structure for PayPal */}
      </div>
    </div>
  );
}

export default PaymentGatewaySettings;
```

---

## 🔍 Troubleshooting

### Issue: "System settings not found"

**Solution**: Initialize system settings first (see Setup Instructions #2)

### Issue: Encryption errors

**Solution**: Set `GATEWAY_ENCRYPTION_KEY` environment variable with a 32-character string

### Issue: Gateway not using database config

**Solution**: Make sure `enabled: true` and credentials are saved. Check cache by calling `DynamicPaymentConfig.clearCache()`

### Issue: Unauthorized access

**Solution**: Ensure your admin user has `admin` or `super_admin` role

---

## 📊 Database Schema

### SystemSettings Collection

```javascript
{
  configuration: {
    paymentGateways: {
      stripe: {
        enabled: Boolean,
        mode: 'test' | 'live',
        publishableKey: String,
        secretKey: String (encrypted),
        webhookSecret: String (encrypted)
      },
      paypal: {
        enabled: Boolean,
        mode: 'sandbox' | 'live',
        clientId: String,
        clientSecret: String (encrypted),
        webhookId: String
      }
    }
  }
}
```

---

## 🚀 Migration from Environment Variables

If you're currently using environment variables, the system will automatically fall back to them. To migrate:

1. Keep your environment variables for now
2. Configure gateways via dashboard
3. Test the dashboard configuration
4. Once confirmed working, remove environment variables
5. System will now use database configuration

---

## 📞 Support

For issues or questions about payment gateway configuration:

- Check the audit logs: `GET /api/admin/audit`
- Verify gateway status: `GET /api/admin/payment-gateways/status`
- Test connections before saving credentials

---

## ✨ Benefits

1. **No Server Restart Required**: Update credentials without redeploying
2. **Multi-Environment Support**: Easily switch between test and live modes
3. **Audit Trail**: All changes are logged in the audit system
4. **Secure**: Encrypted credentials, RBAC protection
5. **Fallback Safety**: Always falls back to environment variables if database fails
6. **Testing Built-in**: Test credentials before saving
