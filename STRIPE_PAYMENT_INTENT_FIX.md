# Stripe Payment Intent Fix - contractPayment.controller.js

## Issue Fixed

**Error**: `Cannot read properties of undefined (reading 'substring')`
**Endpoint**: `POST /api/paypal/contracts/create-payment-intent`
**Status**: 500 Internal Server Error

## Root Cause

The error occurred in the `createStripePaymentIntent` function when trying to create a statement descriptor suffix. The issue had two parts:

1. **In paymentBranding.js**: The `getStatementDescriptorSuffix` function called `.substring()` on `productName` without checking if it was undefined or null
2. **In contractPayment.controller.js**: `productInfo.name` was undefined for products with nested pricing structures (like script, investment-advising, etc.)

## Changes Made

### 1. Fixed paymentBranding.js

**File**: `src/config/paymentBranding.js`

**Before**:

```javascript
getStatementDescriptorSuffix: (productName) => {
  const productMap = {
    "Basic Advisory": "BASIC",
    // ...limited mappings
  };

  return productMap[productName] || productName.substring(0, 10).toUpperCase();
  // ❌ Error if productName is undefined!
};
```

**After**:

```javascript
getStatementDescriptorSuffix: (productName) => {
  const productMap = {
    "Basic Package": "BASIC",
    "Diamond Package": "DIAMOND",
    "Infinity Package": "INFINITY",
    "Script Package": "SCRIPTS",
    "Script Package (Monthly)": "SCRIPTS",
    "Script Package (Yearly)": "SCRIPTS",
    "Investment Advising": "ADVISOR",
    "Trading Tutor": "TUTOR",
    "Eagle Ultimate": "ULTIMATE",
    // ... more mappings
  };

  // Return mapped value
  if (productMap[productName]) {
    return productMap[productName];
  }

  // ✅ Safe fallback - handle undefined or null
  if (!productName || typeof productName !== "string") {
    return "EAGLE";
  }

  // ✅ Safe substring with special char removal
  return productName
    .substring(0, 10)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
};
```

### 2. Fixed contractPayment.controller.js

**File**: `src/controllers/contractPayment.controller.js`

**Before**:

```javascript
// Get the price
let price;
if (typeof productInfo.monthly === "object") {
  price =
    subscriptionType === "yearly"
      ? parseFloat(productInfo.yearly.price)
      : parseFloat(productInfo.monthly.price);
} else {
  price =
    subscriptionType === "yearly" ? productInfo.yearly : productInfo.monthly;
}

// ❌ productInfo.name is undefined for nested structures!
const statementSuffix = PAYMENT_BRANDING.getStatementDescriptorSuffix(
  productInfo.name
);
```

**After**:

```javascript
// Get the price AND product name
let price;
let productName;

if (typeof productInfo.monthly === "object") {
  // For nested pricing structures
  price =
    subscriptionType === "yearly"
      ? parseFloat(productInfo.yearly.price)
      : parseFloat(productInfo.monthly.price);

  // ✅ Extract name from nested structure
  productName =
    subscriptionType === "yearly"
      ? productInfo.yearly.name
      : productInfo.monthly.name;
} else {
  // For direct pricing
  price =
    subscriptionType === "yearly" ? productInfo.yearly : productInfo.monthly;
  productName = productInfo.name;
}

// ✅ Use extracted productName with fallback
const statementSuffix = PAYMENT_BRANDING.getStatementDescriptorSuffix(
  productName || productInfo.name || "EAGLE"
);
```

## Testing

### Test the fixed endpoint:

```bash
POST http://localhost:5000/api/paypal/contracts/create-payment-intent
Content-Type: application/json

{
  "contractId": "YOUR_CONTRACT_ID",
  "subscriptionType": "monthly"
}
```

### Expected Response:

```json
{
  "success": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxxxxxxxxx"
}
```

## Product Types Tested

✅ **Basic Package** (direct pricing)
✅ **Diamond Package** (direct pricing)
✅ **Infinity Package** (direct pricing)
✅ **Script Package** (nested pricing - monthly/yearly)
✅ **Investment Advising** (nested pricing)
✅ **Trading Tutor** (nested pricing)
✅ **Eagle Ultimate** (nested pricing)

## Benefits

1. ✅ **No More Crashes**: Handles undefined/null productName gracefully
2. ✅ **Comprehensive Mapping**: Added all product types to statement descriptor map
3. ✅ **Safe Fallbacks**: Multiple levels of fallback to prevent errors
4. ✅ **Proper Name Extraction**: Correctly extracts product name from both pricing structures
5. ✅ **Bank Statement Compliance**: Removes special characters from statement descriptors

## Related Files

- `src/config/paymentBranding.js` - Branding configuration
- `src/controllers/contractPayment.controller.js` - Payment controller
- `src/payment/routes/paypalRoutes.js` - Route registration
