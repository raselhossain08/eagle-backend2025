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
// Global Middleware
// -----------------------------

// CORS must be applied BEFORE helmet to avoid conflicts
// CORS configuration to allow API access from frontend and other allowed origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    // Allowed origins list - Development & Production
    const allowedOrigins = [
      // Development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      // Production
      'https://admin.eagleinvest.us',
      'https://eagleinvest.us',
      'https://www.eagleinvest.us',
      'https://eagle-investors.com',
      'https://www.eagle-investors.com'
    ];

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed: ${origin}`);
      return callback(null, true);
    }

    // Also check CLIENT_URL from env as fallback
    if (config.CLIENT_URL && origin === config.CLIENT_URL) {
      console.log(`✅ CORS allowed (CLIENT_URL): ${origin}`);
      return callback(null, true);
    }

    console.log(`❌ CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'Cache-Control',
    'User-Agent',
    'Referer',
    'Accept-Encoding',
    'Accept-Language',
    'Connection',
    'Access-Control-Allow-Credentials'
  ],
  exposedHeaders: [
    'Authorization',
    'Content-Range',
    'X-Content-Range'
  ],
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Additional CORS headers middleware for maximum compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control, Access-Control-Allow-Credentials'
  );
  res.header('Access-Control-Expose-Headers', 'Authorization, Content-Range, X-Content-Range');
  res.header('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// Security headers with CORS configuration
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  contentSecurityPolicy: false, // Disable CSP to avoid CORS conflicts
}));

// Request logging - Disabled for cleaner output
// if (process.env.NODE_ENV !== "test") {
//   app.use(morgan("dev"));
//   app.use(requestLogger); // Custom detailed logging
// }

// Body parser with size limit - Increased for contract signatures and PDF data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie parser for JWT in cookies
app.use(cookieParser());

// Data sanitization against NoSQL injection attacks
// Prevents MongoDB operator injection (e.g., $gt, $ne, etc.)
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️  NoSQL injection attempt blocked: ${key} in request from ${req.ip}`);
  }
}));

// Response compression
app.use(compression());

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 for dev, 100 for production
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for local development
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') {
      const clientIP = req.ip || req.connection.remoteAddress;
      // Skip rate limiting for localhost
      return clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('localhost');
    }
    return false;
  }
});
app.use("/api", limiter);

// -----------------------------
// Static Files Serving
// -----------------------------
// Serve uploaded files (contracts, etc.)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Serve public files (including the landing page)
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
app.use("/api/subscription", subscriptionManagementRoutes); // Admin dashboard subscription management (must be before legacy routes)
app.use("/api/subscriptions-legacy", subscriptionRoutes); // Legacy subscription routes
app.use("/api/payment", paymentRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/contract-templates", contractTemplatesRoutes); // Direct template access
app.use("/api/contracts/enhanced", enhancedContractRoutes); // Enhanced contract signing system
app.use("/api/package", packageRoutes);
app.use("/api/basics", basicRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", rbacRoutes);
app.use("/api/rbac", rbacRoutes); // Alias for admin/RBAC routes
app.use("/api/system-settings", systemSettingsRoutes); // System settings (public + admin)
app.use("/api/notifications", notificationRoutes); // Notification management

// User Module Routes - Public User Management + Admin Dashboard
app.use("/api/users", userModuleRoutes);

// Comprehensive Payment Module Routes
app.use("/api/billing", billingRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/payments/discounts", discountRoutes); // Alias for payment path
// Compatibility alias for older frontend calls that expect /api/payment/discount
app.use("/api/payment/discount", discountRoutes);
app.use("/api/dunning", dunningRoutes);
app.use("/api/finance", financeRoutes);
app.use("/api/tax", taxRoutes);
app.use("/api/payment-processors", paymentProcessorsRoutes);
app.use("/api/payment-settings", paymentSettingsRoutes);
app.use("/api/analytics-settings", analyticsSettingsRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/invoices", invoicesRoutes); // Invoice management routes
app.use("/api/support", supportRoutes);
app.use("/api/integrations", integrationRoutes);

// WordPress Integration Routes
app.use("/api/wordpress", wordpressRoutes);

// Subscription module routes (comprehensive)
app.use("/api/v1/subscriptions", subscriptionsRoutes); // Admin subscription management
app.use("/api/v1/subscribers", subscribersRoutes); // Subscriber lifecycle management

// New comprehensive subscription lifecycle management
app.use("/api/v1/subscriptions", subscriptionModuleRoutes); // Complete subscription management

// Plan Management Routes
app.use("/api/plans", planRoutes);

// Transaction Module Routes
app.use("/api/transactions", transactionRoutes);

// -----------------------------
// API Routes Complete
// -----------------------------

// Health check endpoint
app.get("/api/health", async (req, res) => {
  const mongoose = require('mongoose');

  // Check database connection
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
    version: "1.0.0",
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    urls: {
      app: config.APP_URL,
      client: config.CLIENT_URL,
      current: `${req.protocol}://${req.get('host')}`
    },
    database: {
      status: dbStatus,
      error: dbError,
      host: mongoose.connection.host || 'unknown'
    },
    cors: {
      enabled: true,
      clientUrl: config.CLIENT_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      credentials: true
    },
    features: [
      "JWT Authentication",
      "Role-based Access Control",
      "Package Management System",
      "Payment Integration (Stripe/PayPal/Braintree)",
      "Communication Services (Email/SMS)",
      "Multi-Provider Integration System",
      "Support Tools (User Impersonation, Notes, Email Resend)",
      "WordPress Integration",
      "Contract Management",
      "API Documentation",
      "Configured CORS for Frontend"
    ]
  });
});

// CORS test endpoint
app.get("/api/cors-test", (req, res) => {
  res.json({
    success: true,
    message: "CORS is working! API can be accessed from anywhere.",
    origin: req.headers.origin || "No origin header",
    userAgent: req.headers['user-agent'] || "Unknown",
    method: req.method,
    timestamp: new Date().toISOString(),
    headers: {
      'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.get('Access-Control-Allow-Credentials'),
      'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
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
      endpoints: "/api/endpoints"
    },
    instructions: {
      authentication: "Use Bearer token in Authorization header",
      format: "Authorization: Bearer <your-jwt-token>",
      login_endpoint: "/api/auth/login",
      register_endpoint: "/api/auth/register"
    },
    timestamp: new Date().toISOString()
  });
});

// Database health check endpoint
app.get("/api/db-health", async (req, res) => {
  const mongoose = require('mongoose');

  try {
    // Test database connection with a simple operation
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

// Backend info endpoint for the landing page
app.get("/api/info", (req, res) => {
  res.json({
    success: true,
    name: "Eagle Investors Backend",
    description: "Professional Investment Advisory API Platform",
    version: "1.0.0",
    author: "Eagle Investors Team",
    endpoints: {
      auth: [
        "POST /api/auth/register",
        "POST /api/auth/login",
        "POST /api/auth/forgot-password",
        "GET /api/auth/profile"
      ],
      user: [
        "GET /api/user/profile",
        "DELETE /api/user/profile"
      ],
      packages: [
        "GET /api/basic/*",
        "GET /api/diamond/*",
        "GET /api/infinity/*",
        "GET /api/package/features"
      ],
      payments: [
        "POST /api/payment/stripe-payment",
        "POST /api/paypal/create-order",
        "POST /api/contracts/sign"
      ],
      wordpress: [
        "GET /api/wordpress/health",
        "POST /api/wordpress/bulk-sync",
        "POST /api/wordpress/user-webhook"
      ]
    },
    packages: {
      Basic: { price: "$35/month", features: ["Education", "Community", "Basic Alerts"] },
      Diamond: { price: "$76/month", features: ["AI Advisor", "Live Streams", "Premium Alerts"] },
      Infinity: { price: "$99/month", features: ["All Diamond Features", "VIP Support", "Advanced Tools"] },
      Script: { price: "$29/month", features: ["Trading Scripts", "Technical Analysis"] }
    },
    security: [
      "JWT Authentication",
      "Password Hashing (bcrypt)",
      "Rate Limiting",
      "CORS Protection",
      "Helmet Security Headers",
      "Input Validation"
    ],
    techStack: [
      "Node.js", "Express.js", "MongoDB", "Mongoose",
      "JWT", "Stripe API", "PayPal API",
      "bcrypt", "CORS", "Helmet", "Vercel"
    ]
  });
});

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

module.exports = app;
