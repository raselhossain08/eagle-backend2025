const express = require("express");
const router = express.Router();
const {
  createOrder,
  captureOrder,
  getAllTransactions,
  getTransactionDetails,
  getAnalytics,
  processRefund,
  getAllRefunds,
  getAllSubscriptions,
  getSubscriptionByOrder,
  cancelSubscription,
  handleWebhook,
} = require("../controllers/paypalController");
const {
  createContractOrder,
  captureContractOrder,
  createStripePaymentIntent,
  confirmStripePayment,
} = require("../../controllers/contractPayment.controller");
const { protect, optionalAuth } = require("../../middlewares/auth.middleware");
const { adminOnly } = require("../../middlewares/adminOnly.middleware");

// Legacy routes
router.post("/create-order", createOrder);
router.post("/capture-order/:orderId", captureOrder);

// Contract payment routes - PayPal (support both authenticated and guest users)
router.post("/contracts/create-order", optionalAuth, createContractOrder);
router.post("/contracts/capture-order/:orderId", optionalAuth, captureContractOrder);

// Contract payment routes - Stripe (support both authenticated and guest users)
router.post(
  "/contracts/create-payment-intent",
  optionalAuth,
  createStripePaymentIntent
);
router.post("/contracts/confirm-payment", optionalAuth, confirmStripePayment);

// ==================== ADMIN DASHBOARD ROUTES ====================

// Transactions Management
router.get("/admin/transactions", protect, adminOnly, getAllTransactions);
router.get("/admin/transactions/:id", protect, adminOnly, getTransactionDetails);

// Analytics
router.get("/admin/analytics", protect, adminOnly, getAnalytics);

// Refunds Management
router.get("/admin/refunds", protect, adminOnly, getAllRefunds);
router.post("/admin/refunds", protect, adminOnly, processRefund);

// Subscriptions Management
router.get("/admin/subscriptions", protect, adminOnly, getAllSubscriptions);
router.get("/admin/subscriptions/:orderId", protect, adminOnly, getSubscriptionByOrder);
router.post("/admin/subscriptions/:id/cancel", protect, adminOnly, cancelSubscription);

// Webhook (Public endpoint - no auth required)
router.post("/webhooks", handleWebhook);

module.exports = router;





