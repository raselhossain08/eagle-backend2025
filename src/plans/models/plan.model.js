const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            // Unique index defined in planSchema.index() below
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

        prerequisites: [
            {
                planId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Plan",
                },
                required: {
                    type: Boolean,
                    default: false,
                },
            },
        ],

        upgradePath: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Plan",
            },
        ],

        downgradePath: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Plan",
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Indexes for better query performance
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

planSchema.statics.findByType = function (planType) {
    return this.find({ planType, isActive: true, isDeleted: false });
};

planSchema.statics.findByCategory = function (category) {
    return this.find({ category, isActive: true, isDeleted: false });
};

module.exports = mongoose.model("Plan", planSchema, "plans");
