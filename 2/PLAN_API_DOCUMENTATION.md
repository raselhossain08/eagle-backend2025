# 📋 Plan Management API Documentation

## Overview

Complete API documentation for Eagle Platform Plan Management System. This document covers all endpoints, request/response formats, and implementation details needed for backend development.

## Base Information

- **Base URL**: `/api/plans`
- **Authentication**: Bearer Token (JWT) required for all endpoints except public ones
- **Content Type**: `application/json`
- **Response Format**: Consistent API response structure

---

## 🔧 API Response Structure

All API responses follow this consistent structure:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

---

## 📊 Data Models

### Plan Model

```typescript
interface Plan {
  _id: string;
  name: string;
  displayName: string;
  description: string;
  planType: "subscription" | "mentorship" | "script" | "addon";
  category: "basic" | "diamond" | "infinity" | "ultimate" | "script" | "custom";
  pricing: {
    monthly?: {
      price: number;
      originalPrice?: number;
      discount?: string;
      savings?: number;
    };
    annual?: {
      price: number;
      originalPrice?: number;
      discount?: string;
      savings?: number;
    };
    oneTime?: {
      price: number;
      originalPrice?: number;
      memberPrice?: number;
      savings?: number;
    };
  };
  features: string[];
  advancedFeatures?: Array<{
    name: string;
    description?: string;
    isExclusive: boolean;
  }>;
  ui: {
    icon: string;
    gradient: string;
    color: string;
    badgeText?: string;
    badgeColor: string;
  };
  isActive: boolean;
  isPopular: boolean;
  isRecommended: boolean;
  isFeatured: boolean;
  sortOrder: number;
  accessLevel: number;
  stripe?: {
    priceId: {
      monthly?: string;
      annual?: string;
    };
    productId?: string;
  };
  paypal?: {
    planId: {
      monthly?: string;
      annual?: string;
    };
  };
  contractTemplate?: string;
  termsOfService?: string;
  analytics: {
    totalSubscribers: number;
    totalRevenue: number;
    conversionRate: number;
    lastUpdatedStats: string;
  };
  tags: string[];
  metadata?: Record<string, any>;
  createdBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  startDate?: string;
  endDate?: string;
  prerequisites?: Array<{
    planId: {
      _id: string;
      name: string;
      displayName: string;
    };
    required: boolean;
  }>;
  upgradePath?: Array<{
    _id: string;
    name: string;
    displayName: string;
  }>;
  downgradePath?: Array<{
    _id: string;
    name: string;
    displayName: string;
  }>;
  createdAt: string;
  updatedAt: string;
}
```

### Plan Statistics Model

```typescript
interface PlanStats {
  overview: {
    totalPlans: number;
    activePlans: number;
    subscriptionPlans: number;
    mentorshipPlans: number;
    scriptPlans: number;
    totalSubscribers: number;
    totalRevenue: number;
  };
  categoryBreakdown: Array<{
    _id: string;
    count: number;
    totalSubscribers: number;
  }>;
}
```

---

## 🚀 Core CRUD Endpoints

### 1. Get All Plans

```http
GET /api/plans
```

**Query Parameters:**

```typescript
{
  planType?: 'subscription' | 'mentorship' | 'script' | 'addon';
  category?: 'basic' | 'diamond' | 'infinity' | 'ultimate' | 'script' | 'custom';
  isActive?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'displayName' | 'createdAt' | 'updatedAt' | 'sortOrder' | 'category' | 'planType';
  sortOrder?: 'asc' | 'desc';
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    /* Plan[] */
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "pages": 5
  }
}
```

### 2. Get Public Plans (No Auth Required)

```http
GET /api/plans/public?planType=subscription
```

**Response:**

```json
{
  "success": true,
  "data": {
    "subscription": [
      /* Plan[] */
    ],
    "mentorship": [
      /* Plan[] */
    ]
  }
}
```

### 3. Get Plan by ID

```http
GET /api/plans/{planId}
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Plan */
  }
}
```

### 4. Create Plan

```http
POST /api/plans
```

**Request Body:**

```json
{
  "name": "pro-plan",
  "displayName": "Pro Plan",
  "description": "Advanced features for professionals",
  "planType": "subscription",
  "category": "diamond",
  "pricing": {
    "monthly": {
      "price": 29.99,
      "originalPrice": 39.99,
      "discount": "25% OFF",
      "savings": 10
    },
    "annual": {
      "price": 299.99,
      "originalPrice": 479.88,
      "discount": "37% OFF",
      "savings": 179.89
    }
  },
  "features": ["Unlimited Projects", "Advanced Analytics", "Priority Support"],
  "advancedFeatures": [
    {
      "name": "AI Assistant",
      "description": "24/7 AI-powered support",
      "isExclusive": true
    }
  ],
  "ui": {
    "icon": "crown",
    "gradient": "from-blue-500 to-purple-600",
    "color": "blue",
    "badgeText": "Most Popular",
    "badgeColor": "bg-blue-500"
  },
  "isActive": true,
  "isPopular": true,
  "isFeatured": false,
  "sortOrder": 2,
  "accessLevel": 2,
  "tags": ["popular", "business"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Created Plan */
  },
  "message": "Plan created successfully"
}
```

### 5. Update Plan

```http
PUT /api/plans/{planId}
```

**Request Body:** (Same as Create Plan, all fields optional)

**Response:**

```json
{
  "success": true,
  "data": {
    /* Updated Plan */
  },
  "message": "Plan updated successfully"
}
```

### 6. Delete Plan

```http
DELETE /api/plans/{planId}?permanent=false
```

**Query Parameters:**

- `permanent`: boolean (default: false) - True for hard delete, false for soft delete

**Response:**

```json
{
  "success": true,
  "message": "Plan deleted successfully"
}
```

---

## 🎯 Plan Management Endpoints

### 7. Toggle Archive Status

```http
PUT /api/plans/{planId}/archive
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Updated Plan */
  },
  "message": "Plan archive status updated"
}
```

### 8. Toggle Featured Status

```http
PUT /api/plans/{planId}/feature
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Updated Plan */
  },
  "message": "Plan featured status updated"
}
```

### 9. Toggle Popular Status

```http
PUT /api/plans/{planId}/popular
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Updated Plan */
  },
  "message": "Plan popular status updated"
}
```

### 10. Duplicate Plan

```http
POST /api/plans/{planId}/duplicate
```

**Request Body:**

```json
{
  "name": "pro-plan-copy",
  "displayName": "Pro Plan (Copy)"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    /* Duplicated Plan */
  },
  "message": "Plan duplicated successfully"
}
```

### 11. Bulk Update Plans

```http
PUT /api/plans/bulk
```

**Request Body:**

```json
{
  "planIds": ["plan1_id", "plan2_id"],
  "updateData": {
    "isActive": true,
    "sortOrder": 1,
    "isPopular": false,
    "isFeatured": true,
    "tags": ["updated", "bulk"]
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Plans updated successfully"
}
```

### 12. Reorder Plans

```http
PUT /api/plans/reorder
```

**Request Body:**

```json
{
  "planOrders": [
    { "id": "plan1_id", "sortOrder": 1 },
    { "id": "plan2_id", "sortOrder": 2 },
    { "id": "plan3_id", "sortOrder": 3 }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Plans reordered successfully"
}
```

---

## 📈 Query and Statistics Endpoints

### 13. Get Plans by Type

```http
GET /api/plans/type/{planType}
```

**Path Parameters:**

- `planType`: 'subscription' | 'mentorship' | 'script' | 'addon'

**Response:**

```json
{
  "success": true,
  "data": [
    /* Plan[] */
  ]
}
```

### 14. Get Plans by Category

```http
GET /api/plans/category/{category}
```

**Path Parameters:**

- `category`: 'basic' | 'diamond' | 'infinity' | 'ultimate' | 'script' | 'custom'

**Response:**

```json
{
  "success": true,
  "data": [
    /* Plan[] */
  ]
}
```

### 15. Get Featured Plans

```http
GET /api/plans/featured/active
```

**Response:**

```json
{
  "success": true,
  "data": [
    /* Featured Plan[] */
  ]
}
```

### 16. Get Plan Statistics

```http
GET /api/plans/stats
```

**Response:**

```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPlans": 15,
      "activePlans": 12,
      "subscriptionPlans": 8,
      "mentorshipPlans": 4,
      "scriptPlans": 3,
      "totalSubscribers": 1250,
      "totalRevenue": 125000
    },
    "categoryBreakdown": [
      {
        "_id": "diamond",
        "count": 5,
        "totalSubscribers": 500
      }
    ]
  }
}
```

---

## ⚠️ Error Responses

### Error Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "message": "User-friendly error message"
}
```

### Common HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict (e.g., duplicate name)
- `422 Unprocessable Entity`: Validation errors
- `500 Internal Server Error`: Server error

---

## 🔐 Authentication

All endpoints (except public ones) require JWT authentication:

```http
Authorization: Bearer <jwt-token>
```

The token should be obtained from the authentication system and passed in the Authorization header.

---

## 💡 Implementation Notes

### Database Considerations

- Use MongoDB with proper indexing on frequently queried fields
- Implement soft delete for plans (set `isDeleted: true` instead of removing)
- Add compound indexes for filtering (planType + category + isActive)

### Business Logic

- Validate plan names are unique
- Ensure sortOrder values are managed properly for reordering
- Implement proper cascade logic for plan deletions (check subscriptions)
- Calculate analytics in background jobs for better performance

### Caching Recommendations

- Cache public plans endpoint (high traffic, low change frequency)
- Cache plan statistics (updated periodically)
- Invalidate cache on plan modifications

---

## 🧪 Testing Examples

### Create a Basic Plan

```bash
curl -X POST http://localhost:5000/api/plans \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "basic-plan",
    "displayName": "Basic Plan",
    "description": "Perfect for getting started",
    "planType": "subscription",
    "category": "basic",
    "pricing": {
      "monthly": {
        "price": 9.99
      }
    },
    "features": ["1 Project", "Basic Support"],
    "ui": {
      "icon": "star",
      "gradient": "from-gray-400 to-gray-600",
      "color": "gray",
      "badgeColor": "bg-gray-500"
    }
  }'
```

### Get Featured Plans

```bash
curl -X GET http://localhost:5000/api/plans/featured/active \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

This documentation provides complete backend implementation guidance for the Plan Management system. All endpoints match the frontend PlanService expectations and include proper error handling, authentication, and response formats.
