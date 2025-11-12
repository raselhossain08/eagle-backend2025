/**
 * Membership Plan Routes
 * Routes for managing membership plans within subscription context
 */

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect, restrictTo } = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Membership Plans
 *     description: Membership plan management
 */

// Import controllers (we'll use existing plan controllers)
// Import from plans module
const {
    getPlans,
    getPlanById,
    createPlan,
    updatePlan,
    deletePlan
} = require('../../plans/controllers/plan.controller');

// Validation middleware
const validatePlanCreate = [
    body('name')
        .notEmpty()
        .withMessage('Plan name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Plan name must be 3-100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must be max 500 characters'),
    body('pricing.monthly.amount')
        .optional()
        .isNumeric()
        .withMessage('Monthly amount must be numeric'),
    body('pricing.annual.amount')
        .optional()
        .isNumeric()
        .withMessage('Annual amount must be numeric'),
    body('features')
        .optional()
        .isArray()
        .withMessage('Features must be an array'),
    body('status')
        .optional()
        .isIn(['active', 'inactive', 'archived'])
        .withMessage('Status must be active, inactive, or archived')
];

const validatePlanUpdate = [
    body('name')
        .optional()
        .isLength({ min: 3, max: 100 })
        .withMessage('Plan name must be 3-100 characters'),
    body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Description must be max 500 characters'),
    body('pricing.monthly.amount')
        .optional()
        .isNumeric()
        .withMessage('Monthly amount must be numeric'),
    body('pricing.annual.amount')
        .optional()
        .isNumeric()
        .withMessage('Annual amount must be numeric'),
    body('features')
        .optional()
        .isArray()
        .withMessage('Features must be an array'),
    body('status')
        .optional()
        .isIn(['active', 'inactive', 'archived'])
        .withMessage('Status must be active, inactive, or archived')
];

const validatePlanId = [
    param('id')
        .isMongoId()
        .withMessage('Valid plan ID is required')
];

/**
 * @swagger
 * /api/v1/subscriptions/plans:
 *   get:
 *     summary: Get all membership plans
 *     tags: [Membership Plans]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: features
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of plans
 *   post:
 *     summary: Create new membership plan (Admin)
 *     tags: [Membership Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pricing:
 *                 type: object
 *               features:
 *                 type: array
 *     responses:
 *       201:
 *         description: Plan created
 */
router.get('/', getPlans);

router.post('/',
    protect,
    restrictTo('admin', 'superAdmin'),
    validatePlanCreate,
    createPlan
);

/**
 * @swagger
 * /api/v1/subscriptions/plans/{id}:
 *   get:
 *     summary: Get single membership plan
 *     tags: [Membership Plans]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details
 *   put:
 *     summary: Update membership plan (Admin)
 *     tags: [Membership Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     summary: Delete membership plan (Admin)
 *     tags: [Membership Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan deleted
 */
router.get('/:id', validatePlanId, getPlanById);

router.put('/:id',
    protect,
    restrictTo('admin', 'superAdmin'),
    validatePlanId,
    validatePlanUpdate,
    updatePlan
);

router.delete('/:id',
    protect,
    restrictTo('admin', 'superAdmin'),
    validatePlanId,
    deletePlan
);

/**
 * @swagger
 * /api/v1/subscriptions/plans/featured/list:
 *   get:
 *     summary: Get featured membership plans
 *     tags: [Membership Plans]
 *     responses:
 *       200:
 *         description: Featured plans
 */
router.get('/featured/list', async (req, res) => {
    try {
        // Use query to get featured plans
        req.query.featured = 'true';
        req.query.status = 'active';
        await getPlans(req, res);
    } catch (error) {
        console.error('❌ Get Featured Plans Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch featured plans',
            message: error.message
        });
    }
});

/**
 * @route   GET /api/v1/subscriptions/plans/compare/:ids
 * @desc    Compare multiple membership plans
 * @access  Public
 * @params  ids - comma-separated plan IDs
 */
router.get('/compare/:ids', async (req, res) => {
    try {
        const { ids } = req.params;
        const planIds = ids.split(',').filter(id => id.match(/^[0-9a-fA-F]{24}$/));

        if (planIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Valid plan IDs required'
            });
        }

        if (planIds.length > 5) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 5 plans can be compared at once'
            });
        }

        // Use existing controller logic by setting query
        req.query.ids = planIds.join(',');
        await getPlans(req, res);
    } catch (error) {
        console.error('❌ Compare Plans Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to compare plans',
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/subscriptions/plans/:id/activate
 * @desc    Activate a membership plan
 * @access  Admin only
 * @params  id - plan ID
 */
router.post('/:id/activate',
    protect,
    restrictTo('admin', 'superAdmin'),
    validatePlanId,
    async (req, res) => {
        try {
            // Set status to active in body and use update controller
            req.body = { status: 'active' };
            await updatePlan(req, res);
        } catch (error) {
            console.error('❌ Activate Plan Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to activate plan',
                message: error.message
            });
        }
    }
);

/**
 * @route   POST /api/v1/subscriptions/plans/:id/deactivate
 * @desc    Deactivate a membership plan
 * @access  Admin only
 * @params  id - plan ID
 */
router.post('/:id/deactivate',
    protect,
    restrictTo('admin', 'superAdmin'),
    validatePlanId,
    async (req, res) => {
        try {
            // Set status to inactive in body and use update controller
            req.body = { status: 'inactive' };
            await updatePlan(req, res);
        } catch (error) {
            console.error('❌ Deactivate Plan Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to deactivate plan',
                message: error.message
            });
        }
    }
);

/**
 * @route   GET /api/v1/subscriptions/plans/health-check
 * @desc    Health check for membership plans
 * @access  Public
 */
router.get('/health-check', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Membership plans service is operational',
        timestamp: new Date().toISOString(),
        features: {
            getPlans: '✅ Available',
            createPlan: '✅ Available (Admin)',
            updatePlan: '✅ Available (Admin)',
            deletePlan: '✅ Available (Admin)',
            comparePlans: '✅ Available',
            featuredPlans: '✅ Available'
        }
    });
});

module.exports = router;