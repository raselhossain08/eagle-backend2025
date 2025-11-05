const Joi = require("joi");

/**
 * Plan validation schema
 */
const planSchema = Joi.object({
    name: Joi.string()
        .pattern(/^[a-z0-9-]+$/)
        .required()
        .messages({
            "string.pattern.base":
                "Plan name must contain only lowercase letters, numbers, and hyphens",
            "any.required": "Plan name is required",
        }),
    displayName: Joi.string().required().messages({
        "any.required": "Display name is required",
    }),
    description: Joi.string().required().messages({
        "any.required": "Description is required",
    }),
    planType: Joi.string()
        .valid("subscription", "mentorship", "script", "addon")
        .required()
        .messages({
            "any.only": "Plan type must be subscription, mentorship, script, or addon",
            "any.required": "Plan type is required",
        }),
    category: Joi.string()
        .valid("basic", "diamond", "infinity", "ultimate", "script", "custom")
        .required()
        .messages({
            "any.only":
                "Category must be basic, diamond, infinity, ultimate, script, or custom",
            "any.required": "Category is required",
        }),
    pricing: Joi.object({
        monthly: Joi.object({
            price: Joi.number().min(0),
            originalPrice: Joi.number().min(0),
            discount: Joi.string(),
            savings: Joi.number().min(0),
        }),
        annual: Joi.object({
            price: Joi.number().min(0),
            originalPrice: Joi.number().min(0),
            discount: Joi.string(),
            savings: Joi.number().min(0),
        }),
        oneTime: Joi.object({
            price: Joi.number().min(0),
            originalPrice: Joi.number().min(0),
            memberPrice: Joi.number().min(0),
            savings: Joi.number().min(0),
        }),
    }),
    features: Joi.array().items(Joi.string()).min(1).required().messages({
        "array.min": "At least one feature is required",
        "any.required": "Features are required",
    }),
    advancedFeatures: Joi.array().items(
        Joi.object({
            name: Joi.string().required(),
            description: Joi.string(),
            isExclusive: Joi.boolean().default(false),
        })
    ),
    ui: Joi.object({
        icon: Joi.string().required(),
        gradient: Joi.string().required(),
        color: Joi.string().required(),
        badgeText: Joi.string(),
        badgeColor: Joi.string(),
    }).required(),
    isActive: Joi.boolean(),
    isPopular: Joi.boolean(),
    isRecommended: Joi.boolean(),
    isFeatured: Joi.boolean(),
    sortOrder: Joi.number().min(0),
    accessLevel: Joi.number().min(1).max(10),
    stripe: Joi.object({
        priceId: Joi.object({
            monthly: Joi.string(),
            annual: Joi.string(),
        }),
        productId: Joi.string(),
    }),
    paypal: Joi.object({
        planId: Joi.object({
            monthly: Joi.string(),
            annual: Joi.string(),
        }),
    }),
    contractTemplate: Joi.string().allow(""),
    termsOfService: Joi.string().allow(""),
    tags: Joi.array().items(Joi.string()),
    metadata: Joi.object(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    prerequisites: Joi.array().items(
        Joi.object({
            planId: Joi.string(),
            required: Joi.boolean(),
        })
    ),
    upgradePath: Joi.array().items(Joi.string()),
    downgradePath: Joi.array().items(Joi.string()),
});

/**
 * Validate plan data
 */
const validatePlan = (req, res, next) => {
    const { error } = planSchema.validate(req.body, {
        allowUnknown: true,
        abortEarly: false,
    });

    if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            message: errors.join(", "),
            details: errors,
        });
    }

    next();
};

/**
 * Validate bulk update data
 */
const validateBulkUpdate = (req, res, next) => {
    const schema = Joi.object({
        planIds: Joi.array().items(Joi.string()).min(1).required().messages({
            "array.min": "At least one plan ID is required",
            "any.required": "Plan IDs are required",
        }),
        updateData: Joi.object().required().messages({
            "any.required": "Update data is required",
        }),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            message: errors.join(", "),
            details: errors,
        });
    }

    next();
};

/**
 * Validate reorder data
 */
const validateReorder = (req, res, next) => {
    const schema = Joi.object({
        planOrders: Joi.array()
            .items(
                Joi.object({
                    id: Joi.string().required(),
                    sortOrder: Joi.number().required().min(0),
                })
            )
            .min(1)
            .required()
            .messages({
                "array.min": "At least one plan order is required",
                "any.required": "Plan orders are required",
            }),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            message: errors.join(", "),
            details: errors,
        });
    }

    next();
};

/**
 * Validate duplicate plan data
 */
const validateDuplicate = (req, res, next) => {
    const schema = Joi.object({
        name: Joi.string()
            .pattern(/^[a-z0-9-]+$/)
            .required()
            .messages({
                "string.pattern.base":
                    "Plan name must contain only lowercase letters, numbers, and hyphens",
                "any.required": "Plan name is required",
            }),
        displayName: Joi.string().messages({
            "any.required": "Display name is optional",
        }),
    });

    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
        const errors = error.details.map((detail) => detail.message);
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            message: errors.join(", "),
            details: errors,
        });
    }

    next();
};

module.exports = {
    validatePlan,
    validateBulkUpdate,
    validateReorder,
    validateDuplicate,
};
