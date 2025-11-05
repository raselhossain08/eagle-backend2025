const createError = require("http-errors");

/**
 * Package access hierarchy:
 * Basic -> Limited features
 * Diamond -> Premium features
 * Infinity -> All features including advanced tools
 * Script -> Script-specific features
 */

const PACKAGE_HIERARCHY = {
  None: 0,
  Basic: 1,
  Diamond: 2,
  Infinity: 3,
  Script: 2, // Same level as Diamond but different features
};

const PACKAGE_FEATURES = {
  None: [],
  Basic: [
    "market_education",
    "basic_chat_room",
    "basic_market_updates",
    "email_support",
  ],
  Diamond: [
    "stock_alerts",
    "ai_advisor",
    "option_alerts",
    "diamond_chat_room",
    "live_trading_stream",
    "investment_recommendations",
    "watchlists",
    "unusual_options_activity",
    "ai_stock_breakouts",
    "analyst_grades",
    "darkpool_ideas",
  ],
  Infinity: [
    "advanced_market_screening",
    "professional_quant_scripts",
    "infinity_advisory_tickets",
    "portfolio_review_stream",
    "priority_sms_alerts",
    "enhanced_ai_advisor",
    "complete_education_library",
    "custom_analysis_tools",
    "vip_advisory_support",
    "infinity_discord_channels",
    "infinity_trading_chat",
    "infinity_challenges",
    "24_7_market_monitoring",
  ],
  Script: [
    "trading_scripts",
    "script_notifications",
    "technical_analysis_tools",
    "script_education",
  ],
};

/**
 * Check if user has required package access
 */
const requirePackage = (requiredPackages) => {
  return (req, res, next) => {
    try {
      const userSubscription = req.user?.subscription || "None";

      // Convert to array if string is passed
      const required = Array.isArray(requiredPackages)
        ? requiredPackages
        : [requiredPackages];

      // Check if user has any of the required packages
      const hasAccess = required.some((pkg) => {
        if (userSubscription === pkg) return true;

        // Special case: Infinity has access to all Diamond features
        if (userSubscription === "Infinity" && pkg === "Diamond") return true;

        // Check hierarchy level
        return PACKAGE_HIERARCHY[userSubscription] >= PACKAGE_HIERARCHY[pkg];
      });

      if (!hasAccess) {
        throw createError(
          403,
          `Access denied. Required package: ${required.join(
            " or "
          )}. Your package: ${userSubscription}`
        );
      }

      req.userPackage = userSubscription;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user has specific feature access
 */
const requireFeature = (featureName) => {
  return (req, res, next) => {
    try {
      const userSubscription = req.user?.subscription || "None";
      const userFeatures = PACKAGE_FEATURES[userSubscription] || [];

      // Check if user has the required feature
      const hasFeature =
        userFeatures.includes(featureName) ||
        (userSubscription === "Infinity" &&
          PACKAGE_FEATURES.Diamond.includes(featureName));

      if (!hasFeature) {
        throw createError(
          403,
          `Feature '${featureName}' not available in your package: ${userSubscription}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Get user's available features
 */
const getUserFeatures = (subscription) => {
  const features = [...(PACKAGE_FEATURES[subscription] || [])];

  // Infinity users get all Diamond features too
  if (subscription === "Infinity") {
    features.push(...PACKAGE_FEATURES.Diamond);
  }

  return [...new Set(features)]; // Remove duplicates
};

/**
 * Check if user can access a specific route based on package
 */
const canAccessRoute = (userSubscription, routePackage) => {
  if (!routePackage) return true; // Public route

  return (
    PACKAGE_HIERARCHY[userSubscription] >= PACKAGE_HIERARCHY[routePackage] ||
    (userSubscription === "Infinity" && routePackage === "Diamond")
  );
};

module.exports = {
  requirePackage,
  requireFeature,
  getUserFeatures,
  canAccessRoute,
  PACKAGE_HIERARCHY,
  PACKAGE_FEATURES,
};
