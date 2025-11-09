const jwt = require("jsonwebtoken");
const User = require("../user/models/user.model");
const AdminUser = require("../admin/models/adminUser.model");
const createError = require("http-errors");

// Professional Eagle token configuration
const EAGLE_TOKEN_CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'JKJDhayyhnc',
  COOKIE_NAMES: [
    'admin_token',                          // Primary token used by frontend
    'Eagle_Auth_AccessToken_v2',
    'Eagle_Auth_RefreshToken_v2',
    'Eagle_Session_SecurityToken_v2',
    'Eagle_Admin_SecureSession_v2'
  ],
  LEGACY_COOKIE_NAMES: [
    'AdminToken',
    'EagleAccessToken',
    'adminToken',                           // Legacy token manager name
    'token'
  ]
};

/**
 * Extract Eagle token from various sources (cookies, headers)
 */
function extractEagleToken(req) {
  let token = null;

  // 1. Check Authorization header first
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
    if (token) {
      // // // console.info('🔐 EAGLE AUTH: Token found in Authorization header');
      return token;
    }
  }

  // 2. Check professional Eagle cookies
  if (req.cookies) {
    for (const cookieName of EAGLE_TOKEN_CONFIG.COOKIE_NAMES) {
      if (req.cookies[cookieName]) {
        token = req.cookies[cookieName];
        // console.info(`🔐 EAGLE AUTH: Token found in ${cookieName} cookie`);
        return token;
      }
    }

    // 3. Check legacy cookie names for backward compatibility
    for (const cookieName of EAGLE_TOKEN_CONFIG.LEGACY_COOKIE_NAMES) {
      if (req.cookies[cookieName]) {
        token = req.cookies[cookieName];
        // console.warn(`⚠️ EAGLE AUTH: Legacy token found in ${cookieName}, consider upgrading`);
        return token;
      }
    }
  }

  return null;
}

/**
 * Professional Eagle JWT verification middleware
 */
exports.protect = async (req, res, next) => {
  try {
    const token = extractEagleToken(req);

    if (!token) {
      throw createError(401, "Eagle Authentication Required - No valid token provided");
    }

    try {
      // Verify token using Eagle JWT secret
      const decoded = jwt.verify(token, EAGLE_TOKEN_CONFIG.JWT_SECRET);

      // Enhanced token validation
      if (!decoded.id && !decoded.userId) {
        throw createError(401, "Invalid token structure - missing user identifier");
      }

      // Get user from token and attach to request
      const userId = decoded.id || decoded.userId;

      // Check if this is an admin token (based on token type or adminLevel)
      const isAdminToken = decoded.type === 'admin' || decoded.adminLevel;

      let currentUser;

      if (isAdminToken) {
        // Look in AdminUser model for admin tokens
        currentUser = await AdminUser.findById(userId).select("-password");

        // if (process.env.NODE_ENV === 'development') {
        //   // // console.info('🔐 EAGLE AUTH: Looking up admin user', { userId, adminLevel: decoded.adminLevel });
        // }
      } else {
        // Look in regular User model for regular user tokens
        currentUser = await User.findById(userId).select("-password");

        // if (process.env.NODE_ENV === 'development') {
        //   // // console.info('🔐 EAGLE AUTH: Looking up regular user', { userId });
        // }
      }

      if (!currentUser) {
        const userType = isAdminToken ? 'Admin' : 'User';
        throw createError(401, `Eagle Authentication Failed - ${userType} account not found`);
      }

      // Attach professional user data to request
      req.user = currentUser;
      req.tokenPayload = decoded; // Include token payload for advanced features
      req.authMethod = 'Eagle_Professional_Token';

      // Map adminLevel to role for admin users (for RBAC compatibility)
      if (isAdminToken && currentUser.adminLevel) {
        // Map admin levels to role for restrictTo middleware
        const adminLevelToRoleMap = {
          'super_admin': 'admin',
          'finance_admin': 'admin',
          'growth_marketing': 'manager',
          'support': 'manager',
          'read_only': 'viewer'
        };
        req.user.role = adminLevelToRoleMap[currentUser.adminLevel] || 'viewer';
      }

      // Log successful authentication in development
      if (process.env.NODE_ENV === 'development') {
        console.info('✅ EAGLE AUTH: User authenticated successfully', {
          userId: currentUser._id,
          email: currentUser.email,
          role: currentUser.role,
          adminLevel: currentUser.adminLevel,
          authMethod: req.authMethod
        });
      }

      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw createError(401, "Eagle Token Expired - Please login again");
      } else if (error.name === "JsonWebTokenError") {
        throw createError(401, "Invalid Eagle Token - Authentication failed");
      } else if (error.name === "NotBeforeError") {
        throw createError(401, "Eagle Token Not Active - Token not yet valid");
      } else {
        // // console.error('🚫 EAGLE AUTH: Token verification failed:', error.message);
        throw error;
      }
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Professional Eagle optional authentication - allows both authenticated and guest users
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    const token = extractEagleToken(req);

    if (!token) {
      // No token provided, continue as guest with professional context
      req.user = null;
      req.authMethod = 'Guest_Session';
      req.isGuest = true;

      if (process.env.NODE_ENV === 'development') {
        // // console.info('👤 EAGLE AUTH: Continuing as guest user');
      }

      return next();
    }

    try {
      // Verify Eagle token
      const decoded = jwt.verify(token, EAGLE_TOKEN_CONFIG.JWT_SECRET);

      // Get user from token and attach to request
      const userId = decoded.id || decoded.userId;

      // Check if this is an admin token
      const isAdminToken = decoded.type === 'admin' || decoded.adminLevel;

      let currentUser;

      if (isAdminToken) {
        currentUser = await AdminUser.findById(userId).select("-password");
      } else {
        currentUser = await User.findById(userId).select("-password");
      }

      if (!currentUser) {
        // User no longer exists, continue as guest
        req.user = null;
        req.authMethod = 'Invalid_User_Session';
        req.isGuest = true;

        if (process.env.NODE_ENV === 'development') {
          // // console.warn('⚠️ EAGLE AUTH: User not found, continuing as guest');
        }

        return next();
      }

      // Attach authenticated user data
      req.user = currentUser;
      req.tokenPayload = decoded;
      req.authMethod = 'Eagle_Optional_Auth';
      req.isGuest = false;

      // Map adminLevel to role for admin users (for RBAC compatibility)
      if (isAdminToken && currentUser.adminLevel) {
        const adminLevelToRoleMap = {
          'super_admin': 'admin',
          'finance_admin': 'admin',
          'growth_marketing': 'manager',
          'support': 'manager',
          'read_only': 'viewer'
        };
        req.user.role = adminLevelToRoleMap[currentUser.adminLevel] || 'viewer';
      }

      if (process.env.NODE_ENV === 'development') {
        // console.info('✅ EAGLE AUTH: Optional authentication successful', {
        //   userId: currentUser._id,
        //   email: currentUser.email
        // });
      }

      next();
    } catch (error) {
      // Token invalid or expired, continue as guest with error context
      req.user = null;
      req.authMethod = 'Failed_Token_Session';
      req.isGuest = true;
      req.authError = error.message;

      if (process.env.NODE_ENV === 'development') {
        // // console.warn('⚠️ EAGLE AUTH: Token validation failed, continuing as guest:', error.message);
      }

      next();
    }
  } catch (err) {
    next(err);
  }
};

/**
 * Professional Eagle role-based access control
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, "Eagle Authentication Required - Please login"));
    }

    if (!roles.includes(req.user.role)) {
      if (process.env.NODE_ENV === 'development') {
        // console.warn('🚫 EAGLE RBAC: Access denied', {
        //   userRole: req.user.role,
        //   requiredRoles: roles,
        //   userId: req.user._id
        // });
      }

      return next(createError(403, `Eagle Access Denied - Role '${req.user.role}' insufficient. Required: ${roles.join(', ')}`));
    }

    if (process.env.NODE_ENV === 'development') {
      // console.info('✅ EAGLE RBAC: Access granted', {
      //   userRole: req.user.role,
      //   userId: req.user._id
      // });
    }

    next();
  };
};

/**
 * Professional Eagle admin level access control
 */
exports.requireAdminLevel = (...adminLevels) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, "Eagle Authentication Required - Please login"));
    }

    // Check if user has admin level in token payload
    const userAdminLevel = req.tokenPayload?.adminLevel || req.user.adminLevel;

    if (!adminLevels.includes(userAdminLevel)) {
      if (process.env.NODE_ENV === 'development') {
        // console.warn('🚫 EAGLE ADMIN: Admin access denied', {
        //   userAdminLevel,
        //   requiredLevels: adminLevels,
        //   userId: req.user._id
        // });
      }

      return next(createError(403, `Eagle Admin Access Denied - Level '${userAdminLevel}' insufficient. Required: ${adminLevels.join(', ')}`));
    }

    if (process.env.NODE_ENV === 'development') {
      // console.info('✅ EAGLE ADMIN: Admin access granted', {
      //   userAdminLevel,
      //   userId: req.user._id
      // });
    }

    next();
  };
};

/**
 * Professional Eagle subscription-based access control
 */
exports.requireSubscription = (...subscriptions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(createError(401, "Eagle Authentication Required - Please login"));
    }

    if (!subscriptions.includes(req.user.subscription)) {
      if (process.env.NODE_ENV === 'development') {
        // console.warn('🚫 EAGLE SUBSCRIPTION: Access denied', {
        //   userSubscription: req.user.subscription,
        //   requiredSubscriptions: subscriptions,
        //   userId: req.user._id
        // });
      }

      return next(
        createError(403, `Eagle Subscription Access Denied - Current: '${req.user.subscription}', Required: ${subscriptions.join(', ')}`)
      );
    }

    if (process.env.NODE_ENV === 'development') {
      // console.info('✅ EAGLE SUBSCRIPTION: Access granted', {
      //   userSubscription: req.user.subscription,
      //   userId: req.user._id
      // });
    }

    next();
  };
};

/**
 * Professional Eagle admin-only access control
 */
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return next(createError(401, "Eagle Authentication Required - Please login"));
  }

  if (req.user.role !== 'admin') {
    if (process.env.NODE_ENV === 'development') {
      // console.warn('🚫 EAGLE ADMIN: Admin access denied', {
      //   userRole: req.user.role,
      //   userId: req.user._id
      // });
    }

    return next(createError(403, `Eagle Admin Access Denied - Admin role required, current role: '${req.user.role}'`));
  }

  if (process.env.NODE_ENV === 'development') {
    // console.info('✅ EAGLE ADMIN: Admin access granted', {
    //   userRole: req.user.role,
    //   userId: req.user._id
    // });
  }

  next();
};

/**
 * Professional Eagle security audit middleware
 */
exports.auditAccess = (action = 'unknown') => {
  return (req, res, next) => {
    if (req.user) {
      // Log access for security auditing
      // console.info('🔍 EAGLE AUDIT:', {
      //   action,
      //   userId: req.user._id,
      //   email: req.user.email,
      //   role: req.user.role,
      //   adminLevel: req.tokenPayload?.adminLevel,
      //   ip: req.ip,
      //   userAgent: req.get('User-Agent'),
      //   timestamp: new Date().toISOString(),
      //   path: req.path,
      //   method: req.method
      // });
    }
    next();
  };
};
