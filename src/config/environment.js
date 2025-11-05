const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
  // Application Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || 'http://localhost:5000',

  // Database Configuration
  MONGO_URI: process.env.MONGO_URI,

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',

  // Email Configuration
  EMAIL: {
    USER: process.env.EMAIL_USER,
    PASS: process.env.EMAIL_PASS,
    FROM: process.env.EMAIL_FROM || `Eagle Investors <${process.env.EMAIL_USER}>`,
  },

  // Payment Gateway Configuration
  STRIPE: {
    PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
    SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  },

  PAYPAL: {
    MODE: process.env.PAYPAL_MODE || 'sandbox',
    CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    API_URL: process.env.PAYPAL_API || 'https://api-m.sandbox.paypal.com',
  },

  // WordPress Integration
  WORDPRESS: {
    API_KEY: process.env.WORDPRESS_API_KEY,
    URL: process.env.WORDPRESS_URL,
    USERNAME: process.env.WORDPRESS_USERNAME,
    PASSWORD: process.env.WORDPRESS_PASSWORD,
  },

  // Cloudinary Configuration
  CLOUDINARY: {
    CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    API_KEY: process.env.CLOUDINARY_API_KEY,
    API_SECRET: process.env.CLOUDINARY_API_SECRET,
    FOLDER: process.env.CLOUDINARY_FOLDER || 'contracts',
    RESOURCE_TYPE: process.env.CLOUDINARY_RESOURCE_TYPE || 'raw',
    SECURE: process.env.CLOUDINARY_SECURE === 'true',
    USE_FILENAME: process.env.CLOUDINARY_USE_FILENAME === 'true',
    UNIQUE_FILENAME: process.env.CLOUDINARY_UNIQUE_FILENAME === 'true',
  },

  // Security & Performance
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || ['pdf', 'doc', 'docx'],
  RATE_LIMIT: {
    WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW) || 900000, // 15 minutes
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 3600000, // 1 hour
};

// Validation function
const validateConfig = () => {
  const required = [
    'MONGO_URI',
    'JWT_SECRET',
    'EMAIL.USER',
    'EMAIL.PASS',
    'CLOUDINARY.CLOUD_NAME',
    'CLOUDINARY.API_KEY',
    'CLOUDINARY.API_SECRET'
  ];

  const missing = required.filter(key => {
    const keys = key.split('.');
    let value = config;
    for (const k of keys) {
      value = value[k];
      if (!value) return true;
    }
    return false;
  });

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    process.exit(1);
  }

  console.log('✅ Environment configuration loaded successfully');
};

// Validate configuration in production
if (config.NODE_ENV === 'production') {
  validateConfig();
}

module.exports = config;
