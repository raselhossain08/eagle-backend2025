const Plan = require("../models/plan.model");

/**
 * Plan Service - Business logic for plan operations
 */
class PlanService {
    /**
     * Get all plans with filters and pagination
     */
    async getAllPlans(filters = {}, options = {}) {
        try {
            const {
                planType,
                category,
                isActive,
                isFeatured,
                isPopular,
                page = 1,
                limit = 10,
                sortBy = "createdAt",
                sortOrder = "desc",
            } = { ...filters, ...options };

            const query = { isDeleted: false };

            if (planType) query.planType = planType;
            if (category) query.category = category;
            if (isActive !== undefined) query.isActive = isActive;
            if (isFeatured !== undefined) query.isFeatured = isFeatured;
            if (isPopular !== undefined) query.isPopular = isPopular;

            const skip = (page - 1) * limit;
            const sort = {};
            sort[sortBy] = sortOrder === "asc" ? 1 : -1;

            const [plans, total] = await Promise.all([
                Plan.find(query).sort(sort).skip(skip).limit(limit).lean(),
                Plan.countDocuments(query),
            ]);

            return {
                plans,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            throw new Error(`Failed to get plans: ${error.message}`);
        }
    }

    /**
     * Get public plans (no authentication required)
     */
    async getPublicPlans(planType = null) {
        try {
            const query = {
                isActive: true,
                $or: [
                    { isDeleted: false },
                    { isDeleted: { $exists: false } }
                ]
            };

            if (planType) {
                query.planType = planType;
            }

            const plans = await Plan.find(query)
                .select("-stripe -paypal -analytics -createdBy -updatedBy")
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            // Group by planType if no specific type requested
            if (!planType) {
                return plans.reduce((acc, plan) => {
                    if (!acc[plan.planType]) {
                        acc[plan.planType] = [];
                    }
                    acc[plan.planType].push(plan);
                    return acc;
                }, {});
            }

            return plans;
        } catch (error) {
            throw new Error(`Failed to get public plans: ${error.message}`);
        }
    }

    /**
     * Get plan by ID
     */
    async getPlanById(planId) {
        try {
            const plan = await Plan.findOne({
                _id: planId,
                isDeleted: false,
            }).lean();

            if (!plan) {
                throw new Error("Plan not found");
            }

            return plan;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create new plan
     */
    async createPlan(planData, userId) {
        try {
            const plan = new Plan({
                ...planData,
                createdBy: userId,
            });

            await plan.save();
            return plan;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error("Plan name already exists");
            }
            throw new Error(`Failed to create plan: ${error.message}`);
        }
    }

    /**
     * Update plan
     */
    async updatePlan(planId, updateData, userId) {
        try {
            const plan = await Plan.findOneAndUpdate(
                { _id: planId, isDeleted: false },
                {
                    ...updateData,
                    updatedBy: userId,
                },
                { new: true, runValidators: true }
            );

            if (!plan) {
                throw new Error("Plan not found");
            }

            return plan;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error("Plan name already exists");
            }
            throw new Error(`Failed to update plan: ${error.message}`);
        }
    }

    /**
     * Delete plan (soft delete by default)
     */
    async deletePlan(planId, permanent = false, userId) {
        try {
            if (permanent) {
                const plan = await Plan.findByIdAndDelete(planId);
                if (!plan) {
                    throw new Error("Plan not found");
                }
                return { message: "Plan permanently deleted" };
            } else {
                const plan = await Plan.findOneAndUpdate(
                    { _id: planId, isDeleted: false },
                    {
                        isDeleted: true,
                        isActive: false,
                        updatedBy: userId,
                    },
                    { new: true }
                );

                if (!plan) {
                    throw new Error("Plan not found");
                }

                return { message: "Plan deleted successfully" };
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Toggle archive status
     */
    async toggleArchive(planId, userId) {
        try {
            const plan = await Plan.findOne({ _id: planId, isDeleted: false });

            if (!plan) {
                throw new Error("Plan not found");
            }

            plan.isActive = !plan.isActive;
            plan.updatedBy = userId;
            await plan.save();

            return plan;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Toggle featured status
     */
    async toggleFeatured(planId, userId) {
        try {
            const plan = await Plan.findOne({ _id: planId, isDeleted: false });

            if (!plan) {
                throw new Error("Plan not found");
            }

            plan.isFeatured = !plan.isFeatured;
            plan.updatedBy = userId;
            await plan.save();

            return plan;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Toggle popular status
     */
    async togglePopular(planId, userId) {
        try {
            const plan = await Plan.findOne({ _id: planId, isDeleted: false });

            if (!plan) {
                throw new Error("Plan not found");
            }

            plan.isPopular = !plan.isPopular;
            plan.updatedBy = userId;
            await plan.save();

            return plan;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Duplicate plan
     */
    async duplicatePlan(planId, newName, newDisplayName, userId) {
        try {
            const originalPlan = await Plan.findOne({
                _id: planId,
                isDeleted: false,
            }).lean();

            if (!originalPlan) {
                throw new Error("Plan not found");
            }

            // Remove fields that shouldn't be duplicated
            delete originalPlan._id;
            delete originalPlan.createdAt;
            delete originalPlan.updatedAt;
            delete originalPlan.__v;

            const duplicateData = {
                ...originalPlan,
                name: newName,
                displayName: newDisplayName || `${originalPlan.displayName} (Copy)`,
                isActive: false,
                isFeatured: false,
                isPopular: false,
                analytics: {
                    totalSubscribers: 0,
                    totalRevenue: 0,
                    conversionRate: 0,
                    lastUpdatedStats: new Date(),
                },
                createdBy: userId,
            };

            const duplicatedPlan = new Plan(duplicateData);
            await duplicatedPlan.save();

            return duplicatedPlan;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error("Plan name already exists");
            }
            throw new Error(`Failed to duplicate plan: ${error.message}`);
        }
    }

    /**
     * Bulk update plans
     */
    async bulkUpdate(planIds, updateData, userId) {
        try {
            const result = await Plan.updateMany(
                {
                    _id: { $in: planIds },
                    isDeleted: false,
                },
                {
                    ...updateData,
                    updatedBy: userId,
                }
            );

            return {
                modifiedCount: result.modifiedCount,
                message: `${result.modifiedCount} plans updated successfully`,
            };
        } catch (error) {
            throw new Error(`Failed to bulk update plans: ${error.message}`);
        }
    }

    /**
     * Reorder plans
     */
    async reorderPlans(planOrders, userId) {
        try {
            const bulkOps = planOrders.map(({ id, sortOrder }) => ({
                updateOne: {
                    filter: { _id: id, isDeleted: false },
                    update: {
                        sortOrder,
                        updatedBy: userId,
                    },
                },
            }));

            const result = await Plan.bulkWrite(bulkOps);

            return {
                modifiedCount: result.modifiedCount,
                message: "Plans reordered successfully",
            };
        } catch (error) {
            throw new Error(`Failed to reorder plans: ${error.message}`);
        }
    }

    /**
     * Get plans by type
     */
    async getPlansByType(planType) {
        try {
            const plans = await Plan.find({
                planType,
                isActive: true,
                isDeleted: false,
            })
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            return plans;
        } catch (error) {
            throw new Error(`Failed to get plans by type: ${error.message}`);
        }
    }

    /**
     * Get plans by category
     */
    async getPlansByCategory(category) {
        try {
            const plans = await Plan.find({
                category,
                isActive: true,
                isDeleted: false,
            })
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            return plans;
        } catch (error) {
            throw new Error(`Failed to get plans by category: ${error.message}`);
        }
    }

    /**
     * Get featured plans
     */
    async getFeaturedPlans() {
        try {
            const plans = await Plan.find({
                isFeatured: true,
                isActive: true,
                isDeleted: false,
            })
                .sort({ sortOrder: 1, createdAt: -1 })
                .lean();

            return plans;
        } catch (error) {
            throw new Error(`Failed to get featured plans: ${error.message}`);
        }
    }

    /**
     * Get plan statistics
     */
    async getPlanStats() {
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

            return {
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
        } catch (error) {
            throw new Error(`Failed to get plan statistics: ${error.message}`);
        }
    }
}

module.exports = new PlanService();
