const express = require("express");
const router = express.Router();
const {
  processStripePayment,
} = require("../controllers/payment/stripePayment");
const {
  processPaypalPayment,
} = require("../controllers/payment/paypalPayment");
const {
  executePaypalPayment,
} = require("../controllers/payment/paypalExecute");
const validatePayment = require("../middlewares/validatePayment");

router.post("/stripe-payment", validatePayment, processStripePayment);
router.post("/paypal-payment", validatePayment, processPaypalPayment);
router.get("/success", executePaypalPayment);
router.get("/cancel", (req, res) => res.render("cancel"));
router.get("/error", (req, res) => {
  res.render("error", { error: "An error occurred during payment processing" });
});

module.exports = router;
