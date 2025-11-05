const planService = require("../services/plan.service");

/**
 * Response helper functions
 */
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

/**
 * Plan Controller - Handle HTTP requests
 */
class PlanController {
    /**
     * GET /api/plans
     * Get all plans with filters and pagination
     */
    async getPlans(req, res) {
        try {
            const { plans, pagination } = await planService.getAllPlans(
                req.query,
                req.query
            );

            res.json(
                createResponse(plans, "Plans retrieved successfully", pagination)
            );
        } catch (error) {
            console.error("Get plans error:", error);
            res.status(500).json(createErrorResponse("Failed to retrieve plans"));
        }
    }

    /**
     * GET /api/plans/public
     * Get public plans (no authentication required)
     */
    async getPublicPlans(req, res) {
        try {
            const { planType } = req.query;
            const plans = await planService.getPublicPlans(planType);

            res.json(createResponse(plans, "Public plans retrieved successfully"));
        } catch (error) {
            console.error("Get public plans error:", error);
            res
                .status(500)
                .json(createErrorResponse("Failed to retrieve public plans"));
        }
    }

    /**
     * GET /api/plans/:id
     * Get plan by ID
     */
    async getPlanById(req, res) {
        try {
            const plan = await planService.getPlanById(req.params.id);
            res.json(createResponse(plan, "Plan retrieved successfully"));
        } catch (error) {
            console.error("Get plan by ID error:", error);
            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }
            res.status(500).json(createErrorResponse("Failed to retrieve plan"));
        }
    }

    /**
     * POST /api/plans
     * Create new plan
     */
    async createPlan(req, res) {
        try {
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const plan = await planService.createPlan(req.body, userId);

            res.status(201).json(createResponse(plan, "Plan created successfully"));
        } catch (error) {
            console.error("Create plan error:", error);

            if (error.message.includes("already exists")) {
                return res.status(409).json(createErrorResponse(error.message));
            }

            if (error.name === "ValidationError") {
                const messages = Object.values(error.errors).map((err) => err.message);
                return res.status(400).json(createErrorResponse(messages.join(", ")));
            }

            res.status(500).json(createErrorResponse("Failed to create plan"));
        }
    }

    /**
     * PUT /api/plans/:id
     * Update plan
     */
    async updatePlan(req, res) {
        try {
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const plan = await planService.updatePlan(
                req.params.id,
                req.body,
                userId
            );

            res.json(createResponse(plan, "Plan updated successfully"));
        } catch (error) {
            console.error("Update plan error:", error);

            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }

            if (error.message.includes("already exists")) {
                return res.status(409).json(createErrorResponse(error.message));
            }

            if (error.name === "ValidationError") {
                const messages = Object.values(error.errors).map((err) => err.message);
                return res.status(400).json(createErrorResponse(messages.join(", ")));
            }

            res.status(500).json(createErrorResponse("Failed to update plan"));
        }
    }

    /**
     * DELETE /api/plans/:id
     * Delete plan (soft delete by default)
     */
    async deletePlan(req, res) {
        try {
            const { permanent } = req.query;
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const result = await planService.deletePlan(
                req.params.id,
                permanent === "true",
                userId
            );

            res.json(createResponse(null, result.message));
        } catch (error) {
            console.error("Delete plan error:", error);
            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }
            res.status(500).json(createErrorResponse("Failed to delete plan"));
        }
    }

    /**
     * PUT /api/plans/:id/archive
     * Toggle archive status
     */
    async toggleArchive(req, res) {
        try {
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const plan = await planService.toggleArchive(req.params.id, userId);

            const action = plan.isActive ? "restored" : "archived";
            res.json(createResponse(plan, `Plan ${action} successfully`));
        } catch (error) {
            console.error("Toggle archive error:", error);
            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }
            res
                .status(500)
                .json(createErrorResponse("Failed to toggle plan archive status"));
        }
    }

    /**
     * PUT /api/plans/:id/feature
     * Toggle featured status
     */
    async toggleFeatured(req, res) {
        try {
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const plan = await planService.toggleFeatured(req.params.id, userId);

            const action = plan.isFeatured ? "added to" : "removed from";
            res.json(createResponse(plan, `Plan ${action} featured successfully`));
        } catch (error) {
            console.error("Toggle featured error:", error);
            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }
            res
                .status(500)
                .json(createErrorResponse("Failed to toggle plan featured status"));
        }
    }

    /**
     * PUT /api/plans/:id/popular
     * Toggle popular status
     */
    async togglePopular(req, res) {
        try {
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const plan = await planService.togglePopular(req.params.id, userId);

            const action = plan.isPopular ? "marked as" : "unmarked as";
            res.json(createResponse(plan, `Plan ${action} popular successfully`));
        } catch (error) {
            console.error("Toggle popular error:", error);
            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }
            res
                .status(500)
                .json(createErrorResponse("Failed to toggle plan popular status"));
        }
    }

    /**
     * POST /api/plans/:id/duplicate
     * Duplicate plan
     */
    async duplicatePlan(req, res) {
        try {
            const { name, displayName } = req.body;
            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const duplicatedPlan = await planService.duplicatePlan(
                req.params.id,
                name,
                displayName,
                userId
            );

            res
                .status(201)
                .json(createResponse(duplicatedPlan, "Plan duplicated successfully"));
        } catch (error) {
            console.error("Duplicate plan error:", error);

            if (error.message === "Plan not found") {
                return res.status(404).json(createErrorResponse(error.message));
            }

            if (error.message.includes("already exists")) {
                return res.status(409).json(createErrorResponse(error.message));
            }

            res.status(500).json(createErrorResponse("Failed to duplicate plan"));
        }
    }

    /**
     * PUT /api/plans/bulk
     * Bulk update plans
     */
    async bulkUpdate(req, res) {
        try {
            const { planIds, updateData } = req.body;

            if (!planIds || !Array.isArray(planIds) || planIds.length === 0) {
                return res
                    .status(400)
                    .json(createErrorResponse("Plan IDs are required"));
            }

            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const result = await planService.bulkUpdate(planIds, updateData, userId);

            res.json(createResponse(result, result.message));
        } catch (error) {
            console.error("Bulk update error:", error);
            res.status(500).json(createErrorResponse("Failed to update plans"));
        }
    }

    /**
     * PUT /api/plans/reorder
     * Reorder plans
     */
    async reorderPlans(req, res) {
        try {
            const { planOrders } = req.body;

            if (!planOrders || !Array.isArray(planOrders)) {
                return res
                    .status(400)
                    .json(createErrorResponse("Plan orders are required"));
            }

            const userId = {
                _id: req.user._id,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                email: req.user.email,
            };

            const result = await planService.reorderPlans(planOrders, userId);

            res.json(createResponse(result, result.message));
        } catch (error) {
            console.error("Reorder plans error:", error);
            res.status(500).json(createErrorResponse("Failed to reorder plans"));
        }
    }

    /**
     * GET /api/plans/type/:planType
     * Get plans by type
     */
    async getPlansByType(req, res) {
        try {
            const { planType } = req.params;
            const plans = await planService.getPlansByType(planType);

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

    /**
     * GET /api/plans/category/:category
     * Get plans by category
     */
    async getPlansByCategory(req, res) {
        try {
            const { category } = req.params;
            const plans = await planService.getPlansByCategory(category);

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

    /**
     * GET /api/plans/featured/active
     * Get featured plans
     */
    async getFeaturedPlans(req, res) {
        try {
            const plans = await planService.getFeaturedPlans();

            res.json(createResponse(plans, "Featured plans retrieved successfully"));
        } catch (error) {
            console.error("Get featured plans error:", error);
            res
                .status(500)
                .json(createErrorResponse("Failed to retrieve featured plans"));
        }
    }

    /**
     * GET /api/plans/stats
     * Get plan statistics
     */
    async getPlanStats(req, res) {
        try {
            const stats = await planService.getPlanStats();

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
