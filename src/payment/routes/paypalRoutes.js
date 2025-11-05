const express = require("express");
const router = express.Router();
const {
  createOrder,
  captureOrder,
} = require("../controllers/paypalController");
const {
  createContractOrder,
  captureContractOrder,
  createStripePaymentIntent,
  confirmStripePayment,
} = require("../../controllers/contractPayment.controller");
const { protect, optionalAuth } = require("../../middlewares/auth.middleware");

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

module.exports = router;





