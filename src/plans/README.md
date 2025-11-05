# 📋 Plan Management Module

Complete plan management system for Eagle Platform with CRUD operations, statistics, and advanced features.

## 📁 Folder Structure

```
src/plans/
├── controllers/
│   └── plan.controller.js       # HTTP request handlers
├── models/
│   └── plan.model.js            # MongoDB schema and model
├── services/
│   └── plan.service.js          # Business logic layer
├── middlewares/
│   └── plan.validation.js       # Request validation
├── routes/
│   └── plan.routes.js           # API route definitions
└── index.js                     # Module exports
```

## 🚀 Features

### Core Features
- ✅ Full CRUD operations for plans
- ✅ Public plan listings (no auth required)
- ✅ Filter plans by type, category, status
- ✅ Pagination and sorting
- ✅ Soft delete with permanent delete option
- ✅ Plan statistics and analytics

### Advanced Features
- ✅ Toggle featured, popular, and archive status
- ✅ Duplicate plans with new names
- ✅ Bulk update multiple plans
- ✅ Reorder plans by sortOrder
- ✅ User tracking (createdBy, updatedBy)
- ✅ Plan prerequisites and upgrade paths

## 📊 Database Schema

### Plan Model Fields

```javascript
{
  name: String,                    // Unique slug (e.g., "trading-tutor")
  displayName: String,             // Display name (e.g., "Trading Tutor")
  description: String,             // Plan description
  planType: String,                // subscription, mentorship, script, addon
  category: String,                // basic, diamond, infinity, ultimate, script, custom
  
  pricing: {
    monthly: { price, originalPrice, discount, savings },
    annual: { price, originalPrice, discount, savings },
    oneTime: { price, originalPrice, memberPrice, savings }
  },
  
  features: [String],              // List of features
  advancedFeatures: [{
    name: String,
    description: String,
    isExclusive: Boolean
  }],
  
  ui: {
    icon: String,                  // Icon name
    gradient: String,              // CSS gradient
    color: String,                 // Primary color
    badgeText: String,             // Optional badge
    badgeColor: String
  },
  
  isActive: Boolean,               // Active status
  isPopular: Boolean,              // Popular badge
  isRecommended: Boolean,          // Recommended badge
  isFeatured: Boolean,             // Featured status
  isDeleted: Boolean,              // Soft delete flag
  
  sortOrder: Number,               // Display order
  accessLevel: Number,             // 1-10 access level
  
  stripe: {
    priceId: { monthly, annual },
    productId: String
  },
  
  paypal: {
    planId: { monthly, annual }
  },
  
  analytics: {
    totalSubscribers: Number,
    totalRevenue: Number,
    conversionRate: Number,
    lastUpdatedStats: Date
  },
  
  tags: [String],                  // Searchable tags
  createdBy: Object,               // User who created
  updatedBy: Object,               // User who updated
  
  timestamps: true                 // createdAt, updatedAt
}
```

## 🛣️ API Endpoints

### Public Routes

```
GET    /api/plans/public              Get public plans
```

### Protected Routes (Requires Authentication)

#### Core CRUD
```
GET    /api/plans                     Get all plans (with filters)
GET    /api/plans/:id                 Get plan by ID
POST   /api/plans                     Create new plan
PUT    /api/plans/:id                 Update plan
DELETE /api/plans/:id                 Delete plan (soft)
DELETE /api/plans/:id?permanent=true  Delete plan (hard)
```

#### Query & Filters
```
GET    /api/plans/stats               Get plan statistics
GET    /api/plans/featured/active     Get featured plans
GET    /api/plans/type/:planType      Get plans by type
GET    /api/plans/category/:category  Get plans by category
```

#### Management
```
PUT    /api/plans/:id/archive         Toggle archive status
PUT    /api/plans/:id/feature         Toggle featured status
PUT    /api/plans/:id/popular         Toggle popular status
POST   /api/plans/:id/duplicate       Duplicate plan
```

#### Bulk Operations
```
PUT    /api/plans/bulk                Bulk update plans
PUT    /api/plans/reorder             Reorder plans
```

## 📝 Usage Examples

### 1. Get Public Plans

```javascript
// GET /api/plans/public?planType=mentorship
const response = await fetch('/api/plans/public?planType=mentorship');
const data = await response.json();
```

### 2. Create New Plan

```javascript
// POST /api/plans
const newPlan = {
  name: "pro-trading-tutor",
  displayName: "Pro Trading Tutor",
  description: "Advanced trading mentorship",
  planType: "mentorship",
  category: "diamond",
  pricing: {
    oneTime: {
      price: 999,
      originalPrice: 1299,
      memberPrice: 899
    }
  },
  features: [
    "10 Hours of 1-on-1 Sessions",
    "6 Months Diamond Access",
    "Advanced trading strategies"
  ],
  ui: {
    icon: "gem",
    gradient: "from-blue-500 to-purple-600",
    color: "blue",
    badgeText: "Best Value",
    badgeColor: "blue"
  },
  tags: ["mentorship", "trading", "advanced"]
};

const response = await fetch('/api/plans', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(newPlan)
});
```

### 3. Update Plan

```javascript
// PUT /api/plans/:id
const updates = {
  displayName: "Updated Trading Tutor",
  pricing: {
    oneTime: {
      price: 899,
      originalPrice: 1299,
      memberPrice: 799
    }
  }
};

const response = await fetch(`/api/plans/${planId}`, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(updates)
});
```

### 4. Toggle Featured Status

```javascript
// PUT /api/plans/:id/feature
const response = await fetch(`/api/plans/${planId}/feature`, {
  method: 'PUT',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});
```

### 5. Bulk Update Plans

```javascript
// PUT /api/plans/bulk
const bulkUpdate = {
  planIds: ['plan1_id', 'plan2_id', 'plan3_id'],
  updateData: {
    isActive: true,
    isFeatured: false,
    tags: ['updated', 'bulk']
  }
};

const response = await fetch('/api/plans/bulk', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(bulkUpdate)
});
```

### 6. Reorder Plans

```javascript
// PUT /api/plans/reorder
const reorder = {
  planOrders: [
    { id: 'plan1_id', sortOrder: 1 },
    { id: 'plan2_id', sortOrder: 2 },
    { id: 'plan3_id', sortOrder: 3 }
  ]
};

const response = await fetch('/api/plans/reorder', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_TOKEN'
  },
  body: JSON.stringify(reorder)
});
```

### 7. Get Plan Statistics

```javascript
// GET /api/plans/stats
const response = await fetch('/api/plans/stats', {
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

// Response:
{
  success: true,
  data: {
    overview: {
      totalPlans: 15,
      activePlans: 12,
      subscriptionPlans: 8,
      mentorshipPlans: 4,
      scriptPlans: 3,
      totalSubscribers: 1250,
      totalRevenue: 125000
    },
    categoryBreakdown: [
      { _id: "diamond", count: 5, totalSubscribers: 500 },
      { _id: "basic", count: 3, totalSubscribers: 200 }
    ]
  }
}
```

## 🔧 Query Parameters

### GET /api/plans

```
?planType=subscription         Filter by plan type
?category=diamond              Filter by category
?isActive=true                 Filter by active status
?isFeatured=true               Filter featured plans
?isPopular=true                Filter popular plans
?page=1                        Page number (default: 1)
?limit=10                      Items per page (default: 10)
?sortBy=createdAt              Sort field
?sortOrder=desc                Sort order (asc/desc)
```

## 🔒 Authentication

All routes except `/api/plans/public` require authentication using JWT Bearer token:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN'
}
```

## 📦 Module Integration

The plan routes are already integrated in `src/app.js`:

```javascript
const { planRoutes } = require("./plans");
app.use("/api/plans", planRoutes);
```

## 🧪 Testing

### Test Server Connection

```bash
curl http://localhost:5000/api/health
```

### Test Public Plans

```bash
curl http://localhost:5000/api/plans/public
```

### Test Authenticated Endpoint

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:5000/api/plans
```

## 📈 Performance

### Database Indexes

The following indexes are automatically created:
- `{ planType: 1, category: 1, isActive: 1, isDeleted: 1 }`
- `{ name: 1 }` (unique)
- `{ isFeatured: 1, isActive: 1, isDeleted: 1 }`
- `{ isPopular: 1, isActive: 1, isDeleted: 1 }`
- `{ sortOrder: 1, createdAt: -1 }`

## 🐛 Error Handling

All endpoints return consistent error responses:

```javascript
{
  success: false,
  error: "Error message",
  message: "User-friendly message"
}
```

### Common HTTP Status Codes
- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate entry
- `500 Internal Server Error` - Server error

## 📚 Documentation

For complete API documentation, see:
- `/2/PLAN_API_DOCUMENTATION.md`
- `/2/PLAN_BACKEND_IMPLEMENTATION.md`

## ✅ Ready to Use

The plan management system is fully implemented and ready to use. All routes are registered and the database model is configured with proper indexes and validation.

**Base URL**: `http://localhost:5000/api/plans`

Start using the API immediately! 🚀
