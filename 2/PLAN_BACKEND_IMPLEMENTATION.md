# 🚀 Plan Backend Implementation Guide

## Express.js + MongoDB Implementation

This guide provides complete backend implementation for the Plan Management system using Express.js, MongoDB, and Mongoose.

---

## 📁 Project Structure

```
src/
├── models/
│   └── Plan.js
├── controllers/
│   └── planController.js
├── routes/
│   └── planRoutes.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   └── errorHandler.js
├── utils/
│   ├── responseHelper.js
│   └── queryBuilder.js
└── services/
    └── planService.js
```

---

## 🗄️ Database Model (models/Plan.js)

```javascript
const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9-]+$/,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    planType: {
      type: String,
      enum: ["subscription", "mentorship", "script", "addon"],
      required: true,
    },
    category: {
      type: String,
      enum: ["basic", "diamond", "infinity", "ultimate", "script", "custom"],
      required: true,
    },

    pricing: {
      monthly: {
        price: Number,
        originalPrice: Number,
        discount: String,
        savings: Number,
      },
      annual: {
        price: Number,
        originalPrice: Number,
        discount: String,
        savings: Number,
      },
      oneTime: {
        price: Number,
        originalPrice: Number,
        memberPrice: Number,
        savings: Number,
      },
    },

    features: [
      {
        type: String,
        required: true,
      },
    ],

    advancedFeatures: [
      {
        name: {
          type: String,
          required: true,
        },
        description: String,
        isExclusive: {
          type: Boolean,
          default: false,
        },
      },
    ],

    ui: {
      icon: {
        type: String,
        required: true,
      },
      gradient: {
        type: String,
        required: true,
      },
      color: {
        type: String,
        required: true,
      },
      badgeText: String,
      badgeColor: String,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    isRecommended: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
    accessLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },

    stripe: {
      priceId: {
        monthly: String,
        annual: String,
      },
      productId: String,
    },

    paypal: {
      planId: {
        monthly: String,
        annual: String,
      },
    },

    contractTemplate: String,
    termsOfService: String,

    analytics: {
      totalSubscribers: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
      conversionRate: {
        type: Number,
        default: 0,
      },
      lastUpdatedStats: {
        type: Date,
        default: Date.now,
      },
    },

    tags: [String],
    metadata: mongoose.Schema.Types.Mixed,

    createdBy: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      firstName: String,
      lastName: String,
      email: String,
    },

    updatedBy: {
      _id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      firstName: String,
      lastName: String,
      email: String,
    },

    startDate: Date,
    endDate: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
planSchema.index({ planType: 1, category: 1, isActive: 1, isDeleted: 1 });
planSchema.index({ name: 1 }, { unique: true });
planSchema.index({ isFeatured: 1, isActive: 1, isDeleted: 1 });
planSchema.index({ isPopular: 1, isActive: 1, isDeleted: 1 });
planSchema.index({ sortOrder: 1, createdAt: -1 });

// Static methods
planSchema.statics.findActive = function () {
  return this.find({ isActive: true, isDeleted: false });
};

planSchema.statics.findFeatured = function () {
  return this.find({ isFeatured: true, isActive: true, isDeleted: false });
};

module.exports = mongoose.model("Plan", planSchema);
```

---

## 🎮 Controller (controllers/planController.js)

```javascript
const Plan = require("../models/Plan");
const {
  createResponse,
  createErrorResponse,
} = require("../utils/responseHelper");
const { buildQuery, buildPagination } = require("../utils/queryBuilder");

class PlanController {
  // GET /api/plans
  async getPlans(req, res) {
    try {
      const { query, options } = buildQuery(req.query);
      const { skip, limit, page } = buildPagination(req.query);

      // Build MongoDB query
      const filter = { isDeleted: false };

      if (query.planType) filter.planType = query.planType;
      if (query.category) filter.category = query.category;
      if (query.isActive !== undefined) filter.isActive = query.isActive;
      if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
      if (query.isPopular !== undefined) filter.isPopular = query.isPopular;

      // Execute query with pagination
      const [plans, total] = await Promise.all([
        Plan.find(filter).sort(options.sort).skip(skip).limit(limit).lean(),
        Plan.countDocuments(filter),
      ]);

      const pagination = {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      };

      res.json(
        createResponse(plans, "Plans retrieved successfully", pagination)
      );
    } catch (error) {
      console.error("Get plans error:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve plans"));
    }
  }

  // GET /api/plans/public
  async getPublicPlans(req, res) {
    try {
      const { planType } = req.query;

      const filter = {
        isActive: true,
        isDeleted: false,
      };

      if (planType) {
        filter.planType = planType;
      }

      const plans = await Plan.find(filter)
        .select("-stripe -paypal -analytics -createdBy -updatedBy")
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      // Group by planType if no specific type requested
      if (!planType) {
        const groupedPlans = plans.reduce((acc, plan) => {
          if (!acc[plan.planType]) {
            acc[plan.planType] = [];
          }
          acc[plan.planType].push(plan);
          return acc;
        }, {});

        res.json(
          createResponse(groupedPlans, "Public plans retrieved successfully")
        );
      } else {
        res.json(createResponse(plans, "Public plans retrieved successfully"));
      }
    } catch (error) {
      console.error("Get public plans error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve public plans"));
    }
  }

  // GET /api/plans/:id
  async getPlanById(req, res) {
    try {
      const plan = await Plan.findOne({
        _id: req.params.id,
        isDeleted: false,
      }).lean();

      if (!plan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      res.json(createResponse(plan, "Plan retrieved successfully"));
    } catch (error) {
      console.error("Get plan by ID error:", error);
      res.status(500).json(createErrorResponse("Failed to retrieve plan"));
    }
  }

  // POST /api/plans
  async createPlan(req, res) {
    try {
      const planData = {
        ...req.body,
        createdBy: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
      };

      const plan = new Plan(planData);
      await plan.save();

      res.status(201).json(createResponse(plan, "Plan created successfully"));
    } catch (error) {
      console.error("Create plan error:", error);

      if (error.code === 11000) {
        return res
          .status(409)
          .json(createErrorResponse("Plan name already exists"));
      }

      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json(createErrorResponse(messages.join(", ")));
      }

      res.status(500).json(createErrorResponse("Failed to create plan"));
    }
  }

  // PUT /api/plans/:id
  async updatePlan(req, res) {
    try {
      const updateData = {
        ...req.body,
        updatedBy: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
      };

      const plan = await Plan.findOneAndUpdate(
        { _id: req.params.id, isDeleted: false },
        updateData,
        { new: true, runValidators: true }
      );

      if (!plan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      res.json(createResponse(plan, "Plan updated successfully"));
    } catch (error) {
      console.error("Update plan error:", error);

      if (error.code === 11000) {
        return res
          .status(409)
          .json(createErrorResponse("Plan name already exists"));
      }

      if (error.name === "ValidationError") {
        const messages = Object.values(error.errors).map((err) => err.message);
        return res.status(400).json(createErrorResponse(messages.join(", ")));
      }

      res.status(500).json(createErrorResponse("Failed to update plan"));
    }
  }

  // DELETE /api/plans/:id
  async deletePlan(req, res) {
    try {
      const { permanent } = req.query;

      if (permanent === "true") {
        // Hard delete
        const plan = await Plan.findOneAndDelete({
          _id: req.params.id,
        });

        if (!plan) {
          return res.status(404).json(createErrorResponse("Plan not found"));
        }

        res.json(createResponse(null, "Plan permanently deleted"));
      } else {
        // Soft delete
        const plan = await Plan.findOneAndUpdate(
          { _id: req.params.id, isDeleted: false },
          {
            isDeleted: true,
            isActive: false,
            updatedBy: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
            },
          },
          { new: true }
        );

        if (!plan) {
          return res.status(404).json(createErrorResponse("Plan not found"));
        }

        res.json(createResponse(null, "Plan deleted successfully"));
      }
    } catch (error) {
      console.error("Delete plan error:", error);
      res.status(500).json(createErrorResponse("Failed to delete plan"));
    }
  }

  // PUT /api/plans/:id/archive
  async toggleArchivePlan(req, res) {
    try {
      const plan = await Plan.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!plan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      plan.isActive = !plan.isActive;
      plan.updatedBy = {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
      };

      await plan.save();

      const action = plan.isActive ? "restored" : "archived";
      res.json(createResponse(plan, `Plan ${action} successfully`));
    } catch (error) {
      console.error("Toggle archive plan error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to toggle plan archive status"));
    }
  }

  // PUT /api/plans/:id/feature
  async toggleFeaturedPlan(req, res) {
    try {
      const plan = await Plan.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!plan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      plan.isFeatured = !plan.isFeatured;
      plan.updatedBy = {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
      };

      await plan.save();

      const action = plan.isFeatured ? "added to" : "removed from";
      res.json(createResponse(plan, `Plan ${action} featured successfully`));
    } catch (error) {
      console.error("Toggle featured plan error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to toggle plan featured status"));
    }
  }

  // PUT /api/plans/:id/popular
  async togglePopularPlan(req, res) {
    try {
      const plan = await Plan.findOne({
        _id: req.params.id,
        isDeleted: false,
      });

      if (!plan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      plan.isPopular = !plan.isPopular;
      plan.updatedBy = {
        _id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
      };

      await plan.save();

      const action = plan.isPopular ? "marked as" : "unmarked as";
      res.json(createResponse(plan, `Plan ${action} popular successfully`));
    } catch (error) {
      console.error("Toggle popular plan error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to toggle plan popular status"));
    }
  }

  // POST /api/plans/:id/duplicate
  async duplicatePlan(req, res) {
    try {
      const originalPlan = await Plan.findOne({
        _id: req.params.id,
        isDeleted: false,
      }).lean();

      if (!originalPlan) {
        return res.status(404).json(createErrorResponse("Plan not found"));
      }

      const { name, displayName } = req.body;

      // Remove fields that shouldn't be duplicated
      delete originalPlan._id;
      delete originalPlan.createdAt;
      delete originalPlan.updatedAt;
      delete originalPlan.__v;

      // Set new values
      const duplicateData = {
        ...originalPlan,
        name,
        displayName: displayName || `${originalPlan.displayName} (Copy)`,
        isActive: false, // Start as inactive
        isFeatured: false,
        isPopular: false,
        analytics: {
          totalSubscribers: 0,
          totalRevenue: 0,
          conversionRate: 0,
          lastUpdatedStats: new Date(),
        },
        createdBy: {
          _id: req.user._id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          email: req.user.email,
        },
      };

      const duplicatedPlan = new Plan(duplicateData);
      await duplicatedPlan.save();

      res
        .status(201)
        .json(createResponse(duplicatedPlan, "Plan duplicated successfully"));
    } catch (error) {
      console.error("Duplicate plan error:", error);

      if (error.code === 11000) {
        return res
          .status(409)
          .json(createErrorResponse("Plan name already exists"));
      }

      res.status(500).json(createErrorResponse("Failed to duplicate plan"));
    }
  }

  // PUT /api/plans/bulk
  async bulkUpdatePlans(req, res) {
    try {
      const { planIds, updateData } = req.body;

      if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
        return res
          .status(400)
          .json(createErrorResponse("Plan IDs are required"));
      }

      const result = await Plan.updateMany(
        {
          _id: { $in: planIds },
          isDeleted: false,
        },
        {
          ...updateData,
          updatedBy: {
            _id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email,
          },
        }
      );

      res.json(
        createResponse(
          { modifiedCount: result.modifiedCount },
          `${result.modifiedCount} plans updated successfully`
        )
      );
    } catch (error) {
      console.error("Bulk update plans error:", error);
      res.status(500).json(createErrorResponse("Failed to update plans"));
    }
  }

  // PUT /api/plans/reorder
  async reorderPlans(req, res) {
    try {
      const { planOrders } = req.body;

      if (!planOrders || !Array.isArray(planOrders)) {
        return res
          .status(400)
          .json(createErrorResponse("Plan orders are required"));
      }

      const bulkOps = planOrders.map(({ id, sortOrder }) => ({
        updateOne: {
          filter: { _id: id, isDeleted: false },
          update: {
            sortOrder,
            updatedBy: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              email: req.user.email,
            },
          },
        },
      }));

      const result = await Plan.bulkWrite(bulkOps);

      res.json(
        createResponse(
          { modifiedCount: result.modifiedCount },
          "Plans reordered successfully"
        )
      );
    } catch (error) {
      console.error("Reorder plans error:", error);
      res.status(500).json(createErrorResponse("Failed to reorder plans"));
    }
  }

  // GET /api/plans/type/:planType
  async getPlansByType(req, res) {
    try {
      const { planType } = req.params;

      const plans = await Plan.find({
        planType,
        isActive: true,
        isDeleted: false,
      })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      res.json(
        createResponse(plans, `${planType} plans retrieved successfully`)
      );
    } catch (error) {
      console.error("Get plans by type error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve plans by type"));
    }
  }

  // GET /api/plans/category/:category
  async getPlansByCategory(req, res) {
    try {
      const { category } = req.params;

      const plans = await Plan.find({
        category,
        isActive: true,
        isDeleted: false,
      })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      res.json(
        createResponse(plans, `${category} plans retrieved successfully`)
      );
    } catch (error) {
      console.error("Get plans by category error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve plans by category"));
    }
  }

  // GET /api/plans/featured/active
  async getFeaturedPlans(req, res) {
    try {
      const plans = await Plan.find({
        isFeatured: true,
        isActive: true,
        isDeleted: false,
      })
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();

      res.json(createResponse(plans, "Featured plans retrieved successfully"));
    } catch (error) {
      console.error("Get featured plans error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve featured plans"));
    }
  }

  // GET /api/plans/stats
  async getPlanStats(req, res) {
    try {
      const [overview, categoryBreakdown] = await Promise.all([
        Plan.aggregate([
          { $match: { isDeleted: false } },
          {
            $group: {
              _id: null,
              totalPlans: { $sum: 1 },
              activePlans: {
                $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
              },
              subscriptionPlans: {
                $sum: { $cond: [{ $eq: ["$planType", "subscription"] }, 1, 0] },
              },
              mentorshipPlans: {
                $sum: { $cond: [{ $eq: ["$planType", "mentorship"] }, 1, 0] },
              },
              scriptPlans: {
                $sum: { $cond: [{ $eq: ["$planType", "script"] }, 1, 0] },
              },
              totalSubscribers: { $sum: "$analytics.totalSubscribers" },
              totalRevenue: { $sum: "$analytics.totalRevenue" },
            },
          },
        ]),
        Plan.aggregate([
          { $match: { isDeleted: false } },
          {
            $group: {
              _id: "$category",
              count: { $sum: 1 },
              totalSubscribers: { $sum: "$analytics.totalSubscribers" },
            },
          },
        ]),
      ]);

      const stats = {
        overview: overview[0] || {
          totalPlans: 0,
          activePlans: 0,
          subscriptionPlans: 0,
          mentorshipPlans: 0,
          scriptPlans: 0,
          totalSubscribers: 0,
          totalRevenue: 0,
        },
        categoryBreakdown,
      };

      res.json(createResponse(stats, "Plan statistics retrieved successfully"));
    } catch (error) {
      console.error("Get plan stats error:", error);
      res
        .status(500)
        .json(createErrorResponse("Failed to retrieve plan statistics"));
    }
  }
}

module.exports = new PlanController();
```

---

## 🛣️ Routes (routes/planRoutes.js)

```javascript
const express = require("express");
const planController = require("../controllers/planController");
const auth = require("../middleware/auth");
const {
  validatePlan,
  validateBulkUpdate,
  validateReorder,
} = require("../middleware/validation");

const router = express.Router();

// Public routes (no authentication required)
router.get("/public", planController.getPublicPlans);

// Protected routes (authentication required)
router.use(auth); // Apply authentication middleware to all routes below

// Core CRUD operations
router.get("/", planController.getPlans);
router.get("/stats", planController.getPlanStats);
router.get("/featured/active", planController.getFeaturedPlans);
router.get("/type/:planType", planController.getPlansByType);
router.get("/category/:category", planController.getPlansByCategory);
router.get("/:id", planController.getPlanById);

router.post("/", validatePlan, planController.createPlan);
router.put("/:id", validatePlan, planController.updatePlan);
router.delete("/:id", planController.deletePlan);

// Plan management operations
router.put("/:id/archive", planController.toggleArchivePlan);
router.put("/:id/feature", planController.toggleFeaturedPlan);
router.put("/:id/popular", planController.togglePopularPlan);
router.post("/:id/duplicate", planController.duplicatePlan);

// Bulk operations
router.put("/bulk", validateBulkUpdate, planController.bulkUpdatePlans);
router.put("/reorder", validateReorder, planController.reorderPlans);

module.exports = router;
```

---

## 🔧 Utility Functions

### Response Helper (utils/responseHelper.js)

```javascript
const createResponse = (data, message = "Success", pagination = null) => {
  const response = {
    success: true,
    data,
    message,
  };

  if (pagination) {
    response.pagination = pagination;
  }

  return response;
};

const createErrorResponse = (error, message = null) => {
  return {
    success: false,
    error,
    message: message || error,
  };
};

module.exports = {
  createResponse,
  createErrorResponse,
};
```

### Query Builder (utils/queryBuilder.js)

```javascript
const buildQuery = (queryParams) => {
  const {
    planType,
    category,
    isActive,
    isFeatured,
    isPopular,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = queryParams;

  const query = {};

  if (planType) query.planType = planType;
  if (category) query.category = category;
  if (isActive !== undefined) query.isActive = isActive === "true";
  if (isFeatured !== undefined) query.isFeatured = isFeatured === "true";
  if (isPopular !== undefined) query.isPopular = isPopular === "true";

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

  return {
    query,
    options: {
      sort: sortOptions,
    },
  };
};

const buildPagination = (queryParams) => {
  const page = Math.max(1, parseInt(queryParams.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = {
  buildQuery,
  buildPagination,
};
```

---

## 🔐 Middleware

### Authentication (middleware/auth.js)

```javascript
const jwt = require("jsonwebtoken");
const User = require("../models/User"); // Assuming you have a User model

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid token. User not found.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid token.",
    });
  }
};

module.exports = auth;
```

### Validation (middleware/validation.js)

```javascript
const Joi = require("joi");

const planSchema = Joi.object({
  name: Joi.string()
    .pattern(/^[a-z0-9-]+$/)
    .required(),
  displayName: Joi.string().required(),
  description: Joi.string().required(),
  planType: Joi.string()
    .valid("subscription", "mentorship", "script", "addon")
    .required(),
  category: Joi.string()
    .valid("basic", "diamond", "infinity", "ultimate", "script", "custom")
    .required(),
  pricing: Joi.object(),
  features: Joi.array().items(Joi.string()).required(),
  advancedFeatures: Joi.array().items(Joi.object()),
  ui: Joi.object(),
  isActive: Joi.boolean(),
  isPopular: Joi.boolean(),
  isRecommended: Joi.boolean(),
  isFeatured: Joi.boolean(),
  sortOrder: Joi.number(),
  accessLevel: Joi.number().min(1).max(10),
  tags: Joi.array().items(Joi.string()),
});

const validatePlan = (req, res, next) => {
  const { error } = planSchema.validate(req.body, { allowUnknown: true });

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message,
    });
  }

  next();
};

const validateBulkUpdate = (req, res, next) => {
  const schema = Joi.object({
    planIds: Joi.array().items(Joi.string()).required(),
    updateData: Joi.object().required(),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message,
    });
  }

  next();
};

const validateReorder = (req, res, next) => {
  const schema = Joi.object({
    planOrders: Joi.array()
      .items(
        Joi.object({
          id: Joi.string().required(),
          sortOrder: Joi.number().required(),
        })
      )
      .required(),
  });

  const { error } = schema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message,
    });
  }

  next();
};

module.exports = {
  validatePlan,
  validateBulkUpdate,
  validateReorder,
};
```

---

## 🚀 Usage in Express App

```javascript
// app.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const planRoutes = require("./routes/planRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/plans", planRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

This implementation provides a complete, production-ready backend for the Plan Management system with proper error handling, validation, authentication, and database optimization.
