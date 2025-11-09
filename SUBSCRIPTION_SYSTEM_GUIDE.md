# Subscription System Guide

## Overview

The Eagle platform's subscription system tracks user subscriptions, billing cycles, and manages subscription lifecycle events.

## Architecture

### Data Flow

1. **User Model** (`src/user/models/user.model.js`) - Stores subscription data
2. **MembershipPlan Model** (`src/subscription/models/membershipPlan.model.js`) - Stores available plans
3. **Subscription Dashboard Service** (`src/subscription/services/subscriptionDashboard.service.js`) - Business logic
4. **Subscription Management Controller** (`src/subscription/controllers/subscriptionManagement.controller.js`) - API endpoints

### Key Fields in User Model

```javascript
{
  subscription: String,              // Plan name: "None", "Basic", "Diamond", "Infinity", etc.
  subscriptionStatus: String,        // Status: "none", "active", "cancelled", "suspended", etc.
  subscriptionPlanId: ObjectId,      // Reference to MembershipPlan
  subscriptionStartDate: Date,       // When subscription started
  subscriptionEndDate: Date,         // When subscription ends (null for lifetime)
  nextBillingDate: Date,            // Next billing date
  lastBillingDate: Date,            // Last billing date
  billingCycle: String,             // "monthly", "quarterly", "yearly", "lifetime"
  lastPaymentAmount: Number,        // Last payment amount
  totalSpent: Number,               // Total amount spent by user
}
```

## Current Issue & Solution

### Problem

When a user is created, they have:

- `subscription: "None"`
- `subscriptionStatus: "none"`
- `subscriptionEndDate: null`

This is correct for new users who haven't subscribed yet.

### Solution: How to Subscribe a User to a Plan

#### Option 1: Use Admin Dashboard API

The admin can create a subscription using the API:

**Endpoint**: `POST /api/subscription`

**Request Body**:

```json
{
  "userId": "6910d474624c7c314e4f32fe",
  "planId": "<PLAN_ID>",
  "billingCycle": "monthly",
  "price": 29,
  "startDate": "2025-11-09T00:00:00.000Z"
}
```

**Response**:

```json
{
  "success": true,
  "data": {
    "subscription": "Basic",
    "subscriptionStatus": "active",
    "subscriptionEndDate": "2025-12-09T00:00:00.000Z",
    "nextBillingDate": "2025-12-09T00:00:00.000Z"
  }
}
```

#### Option 2: Use the Activation Script

Run the provided script to manually activate a subscription:

```bash
cd eagle-backend2025
node scripts/activateUserSubscription.js
```

Edit the script to change:

- `userEmail` - The user's email address
- `planName` - The plan to subscribe to ("Basic", "Diamond", etc.)
- `billingCycle` - "monthly", "annual", or "oneTime"

#### Option 3: Direct Database Update (for testing)

You can update the user directly in MongoDB:

```javascript
db.users.updateOne(
  { email: "hn@example.com" },
  {
    $set: {
      subscription: "Basic",
      subscriptionStatus: "active",
      subscriptionStartDate: new Date(),
      subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lastBillingDate: new Date(),
      billingCycle: "monthly",
      lastPaymentAmount: 29,
    },
  }
);
```

## Subscription Lifecycle

### 1. New User Registration

- `subscriptionStatus: "none"`
- `subscription: "None"`

### 2. User Subscribes to Plan

- Call `POST /api/subscription` or use payment gateway
- System updates:
  - `subscriptionStatus: "active"`
  - `subscription: "Basic"` (or chosen plan)
  - `subscriptionStartDate: <now>`
  - `subscriptionEndDate: <now + billing cycle>`
  - `nextBillingDate: <end date>`

### 3. Active Subscription

- User has full access to plan features
- `subscriptionEndDate` shows when subscription expires
- For monthly: 30 days validity
- For annual: 365 days validity
- For lifetime: `subscriptionEndDate: null`

### 4. Subscription Expiring Soon

- When `subscriptionEndDate` is within 7 days
- Dashboard shows "Critical" health status
- System can send reminder notifications

### 5. Subscription Renewal

- Call `POST /api/subscription/:id/renew`
- Extends subscription by billing cycle
- Updates `nextBillingDate` and `subscriptionEndDate`

### 6. Subscription Cancelled

- Call `POST /api/subscription/:id/cancel`
- Sets `subscriptionStatus: "cancelled"`
- Access continues until `subscriptionEndDate`

### 7. Subscription Expired

- After `subscriptionEndDate` passes
- System automatically sets `subscriptionStatus: "expired"`
- User loses access to premium features

## Dashboard Display Logic

The frontend calculates:

```typescript
// Days remaining
const daysRemaining = Math.ceil(
  (new Date(subscriptionEndDate) - new Date()) / (1000 * 60 * 60 * 24)
);

// Health status
if (subscriptionStatus !== "active") return "inactive";
if (daysRemaining === null) return "lifetime";
if (daysRemaining <= 7) return "critical";
if (daysRemaining <= 30) return "warning";
return "healthy";
```

## API Endpoints

### Get All Subscriptions

```
GET /api/subscription?page=1&limit=20&status=active
```

### Get Single Subscription

```
GET /api/subscription/:id
```

### Create Subscription

```
POST /api/subscription
Body: { userId, planId, billingCycle, price }
```

### Update Subscription

```
PUT /api/subscription/:id
Body: { status, price, billingCycle, adminNotes }
```

### Cancel Subscription

```
POST /api/subscription/:id/cancel
Body: { reason, immediate }
```

### Renew Subscription

```
POST /api/subscription/:id/renew
Body: { paymentId }
```

### Change Plan

```
POST /api/subscription/:id/change-plan
Body: { newPlanId, billingCycle, effectiveDate }
```

## Testing

### Create Sample Subscriptions

```bash
POST /api/subscription/create-sample-data
```

This creates test users with various subscription states:

- Active subscriptions (different plans)
- Cancelled subscriptions
- Expiring subscriptions
- Suspended subscriptions
- Paused subscriptions

### Check Available Plans

```bash
GET /api/plans
```

Lists all available membership plans with pricing.

## Troubleshooting

### Issue: User shows "None" subscription

**Cause**: User hasn't been subscribed to any plan yet.

**Solution**:

1. Run the activation script
2. OR call `POST /api/subscription` endpoint
3. OR use payment gateway to complete subscription

### Issue: Subscription shows as expired

**Cause**: `subscriptionEndDate` has passed.

**Solution**:

1. Process renewal: `POST /api/subscription/:id/renew`
2. OR extend end date manually

### Issue: Days remaining shows null

**Cause**: This is expected for lifetime subscriptions.

**Solution**: No action needed. Lifetime subscriptions don't expire.

### Issue: MRR showing as 0

**Cause**: `lastPaymentAmount` is not set or subscription is not active.

**Solution**: Update `lastPaymentAmount` when creating/updating subscription.

## Best Practices

1. **Always set all subscription fields** when creating a subscription
2. **Use proper billing cycles** - "monthly" for 30 days, "annual" for 365 days
3. **Set subscriptionEndDate** - Only null for lifetime plans
4. **Track payment amounts** - Update `lastPaymentAmount` and `totalSpent`
5. **Use audit logging** - All subscription changes are logged
6. **Handle renewals automatically** - Set up cron jobs or webhooks
7. **Send expiration reminders** - 7 days, 3 days, and 1 day before expiration

## Integration with Payment Gateways

When integrating with Stripe, PayPal, or other payment gateways:

1. **After successful payment**, call `POST /api/subscription`
2. **Store payment reference**: Save `stripeSubscriptionId` or `paymentId`
3. **Handle webhooks**: Update subscription on payment events
4. **Auto-renewal**: Let gateway handle recurring payments
5. **Failed payments**: Update `subscriptionStatus: "past_due"`

## Monitoring & Analytics

The dashboard provides:

- Total/Active/Cancelled subscribers
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Churn rate
- Growth rate
- Expiring subscriptions
- Recent activity logs

All metrics are calculated in real-time from the User collection.
