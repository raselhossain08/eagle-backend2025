const express = require("express");
const planController = require("../controllers/plan.controller");
const { protect } = require("../../middlewares/auth.middleware");
const {
    validatePlan,
    validateBulkUpdate,
    validateReorder,
    validateDuplicate,
} = require("../middlewares/plan.validation");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Plans
 *     description: Subscription plan management
 */

// ============================================================================
// PUBLIC ROUTES (No Authentication Required)
// ============================================================================

/**
 * @swagger
 * /api/plans/public:
 *   get:
 *     summary: Get public plans
 *     tags: [Plans]
 *     parameters:
 *       - in: query
 *         name: planType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of public plans
 */
router.get("/public", planController.getPublicPlans);

// ============================================================================
// PROTECTED ROUTES (Authentication Required)
// ============================================================================

// Apply authentication middleware to all routes below
router.use(protect);

// ============================================================================
// QUERY & STATISTICS ROUTES (Must be before /:id to avoid route conflicts)
// ============================================================================

/**
 * @route   GET /api/plans/stats
 * @desc    Get plan statistics and analytics
 * @access  Private
 */
router.get("/stats", planController.getPlanStats);

/**
 * @route   GET /api/plans/featured/active
 * @desc    Get all featured and active plans
 * @access  Private
 */
router.get("/featured/active", planController.getFeaturedPlans);

/**
 * @route   GET /api/plans/type/:planType
 * @desc    Get plans by type (subscription, mentorship, script, addon)
 * @access  Private
 */
router.get("/type/:planType", planController.getPlansByType);

/**
 * @route   GET /api/plans/category/:category
 * @desc    Get plans by category (basic, diamond, infinity, ultimate, script, custom)
 * @access  Private
 */
router.get("/category/:category", planController.getPlansByCategory);

// ============================================================================
// BULK OPERATIONS ROUTES
// ============================================================================

/**
 * @route   PUT /api/plans/bulk
 * @desc    Bulk update multiple plans
 * @access  Private
 */
router.put("/bulk", validateBulkUpdate, planController.bulkUpdate);

/**
 * @route   PUT /api/plans/reorder
 * @desc    Reorder plans by updating sortOrder
 * @access  Private
 */
router.put("/reorder", validateReorder, planController.reorderPlans);

// ============================================================================
// CORE CRUD ROUTES
// ============================================================================

/**
 * @route   GET /api/plans
 * @desc    Get all plans with filters and pagination
 * @access  Private
 * @query   planType, category, isActive, isFeatured, isPopular, page, limit, sortBy, sortOrder
 */
router.get("/", planController.getPlans);

/**
 * @route   POST /api/plans
 * @desc    Create a new plan
 * @access  Private
 */
router.post("/", validatePlan, planController.createPlan);

/**
 * @route   GET /api/plans/:id
 * @desc    Get plan by ID
 * @access  Private
 */
router.get("/:id", planController.getPlanById);

/**
 * @route   PUT /api/plans/:id
 * @desc    Update plan by ID
 * @access  Private
 */
router.put("/:id", validatePlan, planController.updatePlan);

/**
 * @route   DELETE /api/plans/:id
 * @desc    Delete plan (soft delete by default, permanent if ?permanent=true)
 * @access  Private
 */
router.delete("/:id", planController.deletePlan);

// ============================================================================
// PLAN MANAGEMENT ROUTES
// ============================================================================

/**
 * @route   PUT /api/plans/:id/archive
 * @desc    Toggle plan archive status (activate/deactivate)
 * @access  Private
 */
router.put("/:id/archive", planController.toggleArchive);

/**
 * @route   PUT /api/plans/:id/feature
 * @desc    Toggle plan featured status
 * @access  Private
 */
router.put("/:id/feature", planController.toggleFeatured);

/**
 * @route   PUT /api/plans/:id/popular
 * @desc    Toggle plan popular status
 * @access  Private
 */
router.put("/:id/popular", planController.togglePopular);

/**
 * @route   POST /api/plans/:id/duplicate
 * @desc    Duplicate an existing plan
 * @access  Private
 */
router.post("/:id/duplicate", validateDuplicate, planController.duplicatePlan);

module.exports = router;
