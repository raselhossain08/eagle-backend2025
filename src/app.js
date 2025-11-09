// Catch any unhandled errors during module loading
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION during app initialization:', err);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION during app initialization:', reason);
  console.error('Promise:', promise);
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const subscriptionManagementRoutes = require("./subscription/routes/subscriptionManagement.routes"); // Admin dashboard subscription management
const paymentRoutes = require("./routes/payment.routes");
const paypalRoutes = require("./routes/paypalRoutes");
const contractRoutes = require("./routes/contracts.routes"); // Updated to use combined routes
const contractTemplatesRoutes = require("./routes/contractTemplates.routes"); // Dedicated template routes
const enhancedContractRoutes = require("./contract/routes/enhancedContract.routes"); // Enhanced contract signing system
const packageRoutes = require("./routes/package.routes");
const basicRoutes = require("./routes/basic.routes");
const functionRoutes = require("./routes/function.routes");
const analyticsRoutes = require("./analytics/routes/analytics.routes");
const rbacRoutes = require("./admin/routes/index");
const systemSettingsRoutes = require("./admin/routes/systemSettings.routes");
const notificationRoutes = require("./routes/notification.routes");

// User Module Routes (Public User Management + Admin User Management)
const userModuleRoutes = require("./user/routes/index");

// Comprehensive Payment Module Routes
const billingRoutes = require("./payment/routes/billing.routes");
const discountRoutes = require("./payment/routes/discount.routes");
const dunningRoutes = require("./payment/routes/dunning.routes");
const financeRoutes = require("./payment/routes/finance.routes");
const taxRoutes = require("./payment/routes/tax.routes");
const paymentProcessorsRoutes = require("./payment/routes/paymentProcessors.routes");
const invoicesRoutes = require("./payment/routes/invoices.routes");
const supportRoutes = require("./support/routes/index");
const integrationRoutes = require("./integrations/routes/index");

// Subscription module routes
const { subscriptionsRoutes, subscribersRoutes } = require("./subscription");
const subscriptionModuleRoutes = require("./subscription/routes/index");

// Plan Management Routes
const { planRoutes } = require("./plans");

// Transaction Module Routes
const transactionRoutes = require("./transaction/routes/transaction.routes");
const paymentSettingsRoutes = require("./routes/paymentSettings.routes");
const analyticsSettingsRoutes = require("./routes/analyticsSettings.routes");
const webhookRoutes = require("./routes/webhook.routes");
const verificationRoutes = require("./routes/verification.routes");

// WordPress Integration Routes
const wordpressRoutes = require("./wordpress/routes/wordpress.routes");

const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const config = require("./config/environment");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Init app first
const app = express();

// Trust proxy - Required when behind reverse proxy (Nginx, load balancer, etc.)
// This allows Express to trust X-Forwarded-* headers
app.set('trust proxy', true);

// Connect to MongoDB and wait for it to be ready
const initializeApp = async () => {
  try {
    await connectDB();
    console.log("🚀 Database connection established successfully");

    // Additional verification that connection is ready
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB connection state: Connected");
    } else {
      console.log(`⚠️  MongoDB connection state: ${mongoose.connection.readyState}`);
    }

  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("Stack trace:", error.stack);

    // For development, try to reconnect
    if (process.env.NODE_ENV !== 'production') {
      console.log("🔄 Retrying database connection in 5 seconds...");
      setTimeout(() => {
        initializeApp();
      }, 5000);
    } else {
      console.error("💥 Exiting due to database connection failure in production");
      process.exit(1);
    }
  }
};

// Initialize database connection immediately
initializeApp();

// -----------------------------
// Global Middleware - SIMPLIFIED CORS
// -----------------------------

// SIMPLIFIED CORS Configuration - Fix for admin.eagleinvest.us
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins in development
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    // Production - allow specific domains and ALL subdomains of eagleinvest.us
    const allowedOrigins = [
      'https://eagleinvest.us',
      'https://www.eagleinvest.us',
      'https://admin.eagleinvest.us',
      'https://eagle-investors.com',
      'https://www.eagle-investors.com'
    ];

    // Allow ALL subdomains of eagleinvest.us
    if (origin && (
      origin.endsWith('.eagleinvest.us') ||
      origin === 'https://eagleinvest.us' ||
      origin === 'https://admin.eagleinvest.us'
    )) {
      console.log(`✅ CORS allowed (subdomain): ${origin}`);
      return callback(null, true);
    }

    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed: ${origin}`);
      return callback(null, true);
    }

    console.log(`❌ CORS blocked origin: ${origin}`);
    console.log(`📋 Allowed origins:`, allowedOrigins);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'Cache-Control',
    'Access-Control-Allow-Credentials'
  ],
  exposedHeaders: [
    'Authorization',
    'Content-Range',
    'X-Content-Range'
  ],
  maxAge: 86400,
  optionsSuccessStatus: 200
};

// Apply CORS middleware FIRST
app.use(cors(corsOptions));

// Handle preflight requests globally
app.options('*', cors(corsOptions));

// Enhanced CORS headers middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Dynamically set allowed origin
  if (origin && (
    origin.endsWith('.eagleinvest.us') ||
    origin === 'https://eagleinvest.us' ||
    origin === 'https://admin.eagleinvest.us' ||
    origin === 'https://eagle-investors.com' ||
    origin === 'https://www.eagle-investors.com' ||
    process.env.NODE_ENV !== 'production'
  )) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env.NODE_ENV !== 'production') {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control, Access-Control-Allow-Credentials'
  );
  res.header('Access-Control-Expose-Headers', 'Authorization, Content-Range, X-Content-Range');
  res.header('Access-Control-Max-Age', '86400');
  res.header('Vary', 'Origin');

  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    console.log(`🛬 Preflight request from: ${origin}`);
    return res.status(200).json({
      message: 'Preflight OK',
      origin: origin,
      allowed: true
    });
  }

  next();
});

// Security headers with CORS compatibility
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false,
}));

// Request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
  app.use(requestLogger);
}

// Body parser with size limit
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie parser for JWT in cookies
app.use(cookieParser());

// Data sanitization against NoSQL injection attacks
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  NoSQL injection attempt blocked: ${key} in request from ${req.ip}`);
  }
}));

// Response compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'unknown';
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      const clientIP = req.ip || req.connection.remoteAddress;
      return clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('localhost');
    }
    return false;
  }
});
app.use("/api", limiter);

// -----------------------------
// Static Files Serving
// -----------------------------
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// -----------------------------
// Root Route - Landing Page
// -----------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// -----------------------------
// Routes
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscription", subscriptionManagementRoutes);
app.use("/api/subscriptions-legacy", subscriptionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/contract-templates", contractTemplatesRoutes);
app.use("/api/contracts/enhanced", enhancedContractRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/basics", basicRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", rbacRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/notifications", notificationRoutes);

// User Module Routes
app.use("/api/users", userModuleRoutes);

// Comprehensive Payment Module Routes
app.use("/api/billing", billingRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/payments/discounts", discountRoutes);
app.use("/api/payment/discount", discountRoutes);
app.use("/api/dunning", dunningRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/payment-processors", paymentProcessorsRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);
app.use("/api/analytics-settings", analyticsSettingsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/integrations", integrationRoutes);

// WordPress Integration Routes
app.use("/api/wordpress", wordpressRoutes);

// Subscription module routes
app.use("/api/v1/subscriptions", subscriptionsRoutes);
app.use("/api/v1/subscribers", subscribersRoutes);
app.use("/api/v1/subscriptions", subscriptionModuleRoutes);

// Plan Management Routes
app.use("/api/plans", planRoutes);

// Transaction Module Routes
app.use("/api/transactions", transactionRoutes);

// -----------------------------
// Special CORS Test Endpoints
// -----------------------------

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const mongoose = require('mongoose');

  let dbStatus = 'disconnected';
  let dbError = null;

  try {
    if (mongoose.connection.readyState === 1) {
      dbStatus = 'connected';
    } else if (mongoose.connection.readyState === 2) {
      dbStatus = 'connecting';
    } else if (mongoose.connection.readyState === 3) {
      dbStatus = 'disconnecting';
    }
  } catch (error) {
    dbError = error.message;
  }

  res.json({
    success: true,
    message: "Eagle Backend API is running",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    origin: req.headers.origin || "No origin header",
    database: {
      status: dbStatus,
      error: dbError,
      host: mongoose.connection.host || 'unknown'
    },
    cors: {
      enabled: true,
      clientUrl: config.CLIENT_URL,
      allowedOrigins: [
        'https://eagleinvest.us',
        'https://www.eagleinvest.us',
        'https://admin.eagleinvest.us',
        'https://eagle-investors.com',
        'https://www.eagle-investors.com'
      ],
      credentials: true
    }
  });
});

// Enhanced CORS test endpoint
app.get("/api/cors-test", (req, res) => {
  const origin = req.headers.origin;

  res.json({
    success: true,
    message: "CORS Test Successful!",
    origin: origin || "No origin header",
    userAgent: req.headers['user-agent'] || "Unknown",
    method: req.method,
    timestamp: new Date().toISOString(),
    corsHeaders: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
    },
    allowed: true,
    note: "If you can see this, CORS is working properly!"
  });
});

// Specific admin CORS test
app.get("/api/admin-cors-test", (req, res) => {
  res.json({
    success: true,
    message: "Admin CORS Test - Successful for admin.eagleinvest.us",
    intendedFor: "https://admin.eagleinvest.us",
    actualOrigin: req.headers.origin,
    timestamp: new Date().toISOString(),
    status: "CORS configured correctly"
  });
});

// Public plans endpoint with CORS headers
app.get("/api/plans/public", (req, res) => {
  // Add specific CORS headers for this endpoint
  const origin = req.headers.origin;

  if (origin && origin.endsWith('.eagleinvest.us')) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Credentials', 'true');

  res.json({
    success: true,
    message: "Public plans endpoint",
    data: [
      { name: "Basic", price: "$35/month" },
      { name: "Diamond", price: "$76/month" },
      { name: "Infinity", price: "$99/month" }
    ],
    cors: {
      origin: origin,
      allowed: true
    }
  });
});

// API documentation index endpoint
app.get("/api/docs", (req, res) => {
  res.json({
    success: true,
    message: "Eagle Investors API Documentation",
    documentation: {
      health: "/api/health",
      corsTest: "/api/cors-test",
      adminCorsTest: "/api/admin-cors-test",
      publicPlans: "/api/plans/public"
    },
    corsStatus: "Configured for all eagleinvest.us subdomains",
    timestamp: new Date().toISOString()
  });
});

// Database health check endpoint
app.get("/api/db-health", async (req, res) => {
  const mongoose = require('mongoose');

  try {
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.ping();

    res.json({
      success: true,
      message: "Database connection is healthy",
      status: "connected",
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState,
      ping: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
      readyState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    });
  }
});

// Backend info endpoint
app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    name: "Eagle Investors Backend",
    description: "Professional Investment Advisory API Platform",
    version: "1.0.0",
    cors: {
      status: "Enabled",
      allowedDomains: "All eagleinvest.us subdomains",
      adminAccess: "https://admin.eagleinvest.us"
    },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API Not Found",
    requestedUrl: req.originalUrl,
  });
});

// -----------------------------
// Error Handler (should be last)
// -----------------------------
app.use(errorHandler);

// Final CORS error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    console.log(`🚫 CORS Blocked: ${req.headers.origin} trying to access ${req.url}`);
    return res.status(403).json({
      success: false,
      message: 'CORS Policy: Origin not allowed',
      origin: req.headers.origin,
      allowedOrigins: [
        'https://eagleinvest.us',
        'https://www.eagleinvest.us',
        'https://admin.eagleinvest.us',
        'https://eagle-investors.com',
        'https://www.eagle-investors.com'
      ]
    });
  }
  next(err);
});

module.exports = app;