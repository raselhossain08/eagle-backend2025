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
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const mongoSanitize = require("express-mongo-sanitize");
const cookieParser = require("cookie-parser");
const path = require("path");
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const subscriptionManagementRoutes = require("./subscription/routes/subscriptionManagement.routes");
const paymentRoutes = require("./routes/payment.routes");
const paypalRoutes = require("./routes/paypalRoutes");
const contractRoutes = require("./routes/contracts.routes");
const contractTemplatesRoutes = require("./routes/contractTemplates.routes");
const enhancedContractRoutes = require("./contract/routes/enhancedContract.routes");
const packageRoutes = require("./routes/package.routes");
const basicRoutes = require("./routes/basic.routes");
const functionRoutes = require("./routes/function.routes");
const analyticsRoutes = require("./analytics/routes/analytics.routes");
const rbacRoutes = require("./admin/routes/index");
const systemSettingsRoutes = require("./admin/routes/systemSettings.routes");
const notificationRoutes = require("./routes/notification.routes");

// User Module Routes
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
app.set('trust proxy', true);

// Connect to MongoDB and wait for it to be ready
const initializeApp = async () => {
  try {
    await connectDB();
    console.log("🚀 Database connection established successfully");

    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
      console.log("✅ MongoDB connection state: Connected");
    } else {
      console.log(`⚠️  MongoDB connection state: ${mongoose.connection.readyState}`);
    }

  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    console.error("Stack trace:", error.stack);

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
// Global Middleware - CORS COMPLETELY OPEN
// -----------------------------

// Simple and permissive CORS middleware - BEFORE everything else
app.use((req, res, next) => {
  // Get the origin from request or use wildcard
  const origin = req.headers.origin || '*';

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-API-Key, Accept, Origin, Cache-Control, Cookie, Set-Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Expose-Headers', 'Set-Cookie, Authorization, Content-Type, Content-Length');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    console.log(`✅ OPTIONS from: ${origin}`);
    return res.status(204).end();
  }

  next();
});

// Helmet removed to prevent CORS conflicts
// Security headers are already set by CORS middleware above

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

// Rate limiter removed - not needed

// -----------------------------
// Swagger Configuration
// -----------------------------
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Eagle Backend API",
      version: "1.0.0",
      description: "Comprehensive API documentation for Eagle Backend - Subscription Management System",
      contact: {
        name: "Eagle Backend Support",
        email: "support@eagle.com"
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT"
      }
    },
    servers: [
      {
        url: "http://localhost:5000",
        description: "Development server"
      },
      {
        url: "https://eagle-backend2025.vercel.app",
        description: "Production server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token"
        },
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "token",
          description: "JWT token stored in cookie"
        }
      }
    },
    security: [
      {
        bearerAuth: []
      },
      {
        cookieAuth: []
      }
    ]
  },
  apis: [
    // Main routes directory
    "./src/routes/*.js",

    // Auth module
    "./src/auth/routes/*.js",

    // User module
    "./src/user/routes/*.js",
    "./src/user/controllers/*.js",

    // Admin module
    "./src/admin/routes/*.js",
    "./src/admin/controllers/*.js",

    // RBAC module
    "./src/rbac/routes/*.js",

    // Subscription module
    "./src/subscription/routes/*.js",
    "./src/subscription/controllers/*.js",

    // Payment module
    "./src/payment/routes/*.js",
    "./src/payment/controllers/*.js",

    // Plans module
    "./src/plans/routes/*.js",
    "./src/plans/controllers/*.js",

    // Transaction module
    "./src/transaction/routes/*.js",
    "./src/transaction/controllers/*.js",

    // Analytics module
    "./src/analytics/routes/*.js",
    "./src/analytics/controllers/*.js",

    // Support module
    "./src/support/routes/*.js",
    "./src/support/controllers/*.js",

    // Dashboard module
    "./src/dashboard/routes/*.js",
    "./src/dashboard/controllers/*.js",

    // Integrations module
    "./src/integrations/routes/*.js",
    "./src/integrations/controllers/*.js",

    // WordPress integration
    "./src/wordpress/routes/*.js",
    "./src/wordpress/controllers/*.js",

    // Contract module
    "./src/contract/routes/*.js",
    "./src/contract/controllers/*.js",

    // Controllers (for standalone @swagger annotations)
    "./src/controllers/*.js"
  ]
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

// Swagger UI Route - Must be before other routes to avoid conflicts
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Eagle Backend API Docs",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

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

// API Documentation redirect
app.get("/docs", (req, res) => {
  res.redirect("/api-docs");
});

// -----------------------------
// Routes (Keep all your existing routes)
// -----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subscription", subscriptionManagementRoutes);
app.use("/api/subscriptions-legacy", subscriptionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/contracts", contractRoutes); // This already includes enhanced routes
app.use("/api/contract-templates", contractTemplatesRoutes);
// Removed duplicate: app.use("/api/contracts/enhanced", enhancedContractRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/basics", basicRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/admin", rbacRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/system-settings", systemSettingsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/users", userModuleRoutes);
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
app.use("/api/wordpress", wordpressRoutes);
app.use("/api/v1/subscriptions", subscriptionsRoutes);
app.use("/api/v1/subscribers", subscribersRoutes);
app.use("/api/v1/subscriptions", subscriptionModuleRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/transactions", transactionRoutes);

// -----------------------------
// Test Endpoints - CORS DISABLED
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
    message: "Eagle Backend API is running - CORS DISABLED",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    origin: req.headers.origin || "No origin header",
    apiDocs: {
      swagger: "http://localhost:5000/api-docs",
      alternativeUrl: "http://localhost:5000/docs"
    },
    database: {
      status: dbStatus,
      error: dbError,
      host: mongoose.connection.host || 'unknown'
    },
    cors: {
      enabled: false,
      status: "CORS completely disabled - Anyone can access"
    }
  });
});

// CORS test endpoint - COMPLETELY OPEN
app.get("/api/cors-test", (req, res) => {
  res.json({
    success: true,
    message: "CORS COMPLETELY DISABLED - Anyone can access from anywhere!",
    origin: req.headers.origin || "No origin header",
    userAgent: req.headers['user-agent'] || "Unknown",
    method: req.method,
    timestamp: new Date().toISOString(),
    note: "No CORS restrictions - API is open to all domains"
  });
});

// Public plans endpoint - COMPLETELY OPEN
app.get("/api/plans/public", (req, res) => {
  res.json({
    success: true,
    message: "Public plans endpoint - CORS DISABLED",
    data: [
      { name: "Basic", price: "$35/month" },
      { name: "Diamond", price: "$76/month" },
      { name: "Infinity", price: "$99/month" }
    ],
    cors: {
      status: "disabled",
      origin: req.headers.origin,
      allowed: true
    }
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

// Remove CORS error handler since CORS is disabled
// app.use((err, req, res, next) => {
//   // No CORS errors since CORS is disabled
//   next(err);
// });

module.exports = app;