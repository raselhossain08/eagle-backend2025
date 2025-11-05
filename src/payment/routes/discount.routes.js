const express = require('express');
const {
  getDiscountStats,
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getDiscountAnalytics,
  bulkGenerateDiscounts,
  exportDiscounts
} = require('../controllers/discount.controller');

const { protect } = require('../../middlewares/auth.middleware');
const rbacMiddleware = require('../../admin/middlewares/rbac.middleware');

const router = express.Router();

// Public routes (no authentication required)
router.post('/public/verify', validateDiscountCode);
router.get('/public/verify/:code', validateDiscountCode);

// Apply authentication to remaining routes
router.use(protect);

// Authenticated routes
router.get('/validate/:code', validateDiscountCode);

// Admin routes
router.use(rbacMiddleware.checkRole(['admin', 'moderator'])); // Only admin and moderator can manage discounts

// Stats and analytics
router.get('/stats', getDiscountStats);
router.get('/analytics', getDiscountAnalytics);

// Export
router.get('/export', exportDiscounts);

// Bulk operations
router.post('/bulk-generate', bulkGenerateDiscounts);

// CRUD operations
router.get('/', getDiscounts);
router.get('/:id', getDiscountById);
router.post('/', createDiscount);
router.put('/:id', updateDiscount);
router.delete('/:id', deleteDiscount);

module.exports = router;





