const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const createError = require("http-errors");

/**
 * Protect middleware - JWT verification
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw createError(401, "Not authorized - No token provided");
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token and attach to request
      const currentUser = await User.findById(decoded.id).select("-password");

      if (!currentUser) {
        throw createError(401, "User no longer exists");
      }

      req.user = currentUser;
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw createError(401, "Token has expired");
      } else if (error.name === "JsonWebTokenError") {
        throw createError(401, "Invalid token");
      } else {
        throw error;
      }
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Optional authentication middleware - allows both authenticated and guest users
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      // No token provided, continue as guest
      req.user = null;
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token and attach to request
      const currentUser = await User.findById(decoded.id).select("-password");

      if (!currentUser) {
        // User no longer exists, continue as guest
        req.user = null;
        return next();
      }

      req.user = currentUser;
      next();
    } catch (error) {
      // Token invalid or expired, continue as guest
      req.user = null;
      next();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(createError(403, "Access denied - Insufficient permissions"));
    }
    next();
  };
};

/**
 * Subscription-based access control
 */
exports.requireSubscription = (...subscriptions) => {
  return (req, res, next) => {
    if (!subscriptions.includes(req.user.subscription)) {
      return next(
        createError(403, "Access denied - Subscription level required")
      );
    }
    next();
  };
};
