const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const {
  requirePackage,
  requireFeature,
} = require("../middlewares/packageAccess.middleware");

/**
 * @swagger
 * tags:
 *   name: Package
 *   description: Package management and access control
 */

// Protect all package routes
router.use(protect);

// Get user's package features
router.get("/features", (req, res) => {
  res.json({
    success: true,
    message: "Package features retrieved successfully",
    data: {
      basic: ["Education", "Community", "Basic Alerts"],
      diamond: ["AI Advisor", "Live Streams", "Premium Alerts"],
      infinity: ["All Diamond Features", "VIP Support", "Advanced Tools"],
      script: ["Trading Scripts", "Technical Analysis"]
    }
  });
});

// Check access to specific routes/features
router.post("/access/check", (req, res) => {
  res.json({
    success: true,
    message: "Access check completed",
    hasAccess: true
  });
});

// Get upgrade suggestions
router.get("/upgrade/suggestions", (req, res) => {
  res.json({
    success: true,
    message: "Upgrade suggestions retrieved",
    suggestions: [
      {
        package: "Diamond",
        price: "$76/month",
        features: ["AI Advisor", "Live Streams", "Premium Alerts"]
      },
      {
        package: "Infinity", 
        price: "$99/month",
        features: ["All Diamond Features", "VIP Support", "Advanced Tools"]
      }
    ]
  });
});

// Package-specific routes
router.get("/diamond/status", requirePackage("Diamond"), (req, res) => {
  res.json({
    success: true,
    message: "Diamond package access confirmed",
    package: req.userPackage,
    features: ["Premium alerts", "AI advisor", "Live streams"],
  });
});

router.get("/infinity/status", requirePackage("Infinity"), (req, res) => {
  res.json({
    success: true,
    message: "Infinity package access confirmed",
    package: req.userPackage,
    features: [
      "All Diamond features",
      "Advanced screening",
      "Professional scripts",
      "VIP support",
    ],
  });
});

router.get("/script/status", requirePackage("Script"), (req, res) => {
  res.json({
    success: true,
    message: "Script package access confirmed",
    package: req.userPackage,
    features: ["Trading scripts", "Technical analysis", "Script notifications"],
  });
});

// Feature-specific routes
router.get("/feature/ai-advisor", requireFeature("ai_advisor"), (req, res) => {
  res.json({
    success: true,
    message: "AI Advisor feature access confirmed",
    feature: "ai_advisor",
  });
});

router.get(
  "/feature/live-stream",
  requireFeature("live_trading_stream"),
  (req, res) => {
    res.json({
      success: true,
      message: "Live Trading Stream feature access confirmed",
      feature: "live_trading_stream",
    });
  }
);

router.get(
  "/feature/professional-scripts",
  requireFeature("professional_quant_scripts"),
  (req, res) => {
    res.json({
      success: true,
      message: "Professional Scripts feature access confirmed",
      feature: "professional_quant_scripts",
    });
  }
);

module.exports = router;
