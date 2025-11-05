const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const paymentRoutes = require("./routes/payment.routes");
const paypalRoutes = require("./routes/paypalRoutes");
const contractRoutes = require("./routes/contract.routes");
const packageRoutes = require("./routes/package.routes");
const basicRoutes = require("./routes/basic.routes");
const functionRoutes = require("./routes/function.routes");
const rbacRoutes = require("./admin/routes/index");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Init app first
const app = express();

// Connect to MongoDB and wait for it to be ready
const initializeApp = async () => {
  try {
    await connectDB();
    console.log("🚀 Database connection established successfully");
    
    // Additional verification that connection is ready
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) {
    } else {
    }
    
  } catch (error) {

    
    // For development, try to reconnect
    if (process.env.NODE_ENV !== 'production') {
      setTimeout(() => {
       
        initializeApp();
      }, 5000);
    }
  }
};

// Initialize database connection immediately
initializeApp();

// -----------------------------
// Global Middleware
// -----------------------------

// Security headers with CORS configuration
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "*"]
    },
  } : false, // Disable CSP in development for easier testing
}));

// CORS configuration to allow API access from specific origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL,
  process.env.DASHBOARD_URL,
].filter(Boolean); // Filter out undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
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
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Additional CORS headers middleware for maximum compatibility
app.use((req, res, next) => {
  // Allow any origin
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.header('Access-Control-Allow-Headers', 
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key, Cache-Control, Access-Control-Allow-Credentials'
  );
  res.header('Access-Control-Expose-Headers', 'Authorization, Content-Range, X-Content-Range');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Request logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
  app.use(requestLogger); // Custom detailed logging
}

// Body parser with size limit - Increased for contract signatures and PDF data
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Cookie parser for JWT in cookies
app.use(cookieParser());

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
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/paypal", paypalRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/package", packageRoutes);
app.use("/api/basic", basicRoutes);
app.use("/api/functions", functionRoutes);
app.use("/api/rbac", rbacRoutes);

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
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      status: dbStatus,
      error: dbError,
      host: mongoose.connection.host || 'unknown'
    },
    cors: {
      enabled: true,
      allowAllOrigins: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
      credentials: true
    },
    features: [
      "JWT Authentication",
      "Role-based Access Control", 
      "Package Management System",
      "Payment Integration (Stripe/PayPal)",
      "WordPress Integration",
      "Contract Management",
      "API Documentation",
      "CORS Enabled for All Origins"
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
