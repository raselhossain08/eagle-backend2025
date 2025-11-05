/**
 * Payment Branding Configuration
 * This file contains all branding and display information for payment processors
 */

const PAYMENT_BRANDING = {
  // Business Information
  businessName: process.env.BUSINESS_NAME || "Eagle Investors",
  businessLegalName: process.env.BUSINESS_LEGAL_NAME || "Eagle Investors LLC",
  supportEmail: process.env.BUSINESS_SUPPORT_EMAIL || "support@eagle-investors.com",
  website: process.env.BUSINESS_WEBSITE || "https://eagle-investors.com",

  // Statement Descriptors (what appears on bank/credit card statements)
  statementDescriptor: process.env.PAYMENT_STATEMENT_DESCRIPTOR || "EAGLE INVESTORS",

  // PayPal Specific Configuration
  paypal: {
    brandName: process.env.BUSINESS_NAME || "Eagle Investors",
    landingPage: "NO_PREFERENCE",
    shippingPreference: "NO_SHIPPING",
    userAction: "PAY_NOW",
    logoUrl: process.env.BUSINESS_LOGO_URL || null, // Optional logo URL
  },

  // Stripe Specific Configuration
  stripe: {
    statementDescriptor: process.env.PAYMENT_STATEMENT_DESCRIPTOR || "EAGLE INVESTORS",
    receiptEmail: true, // Send receipt emails
    metadata: {
      businessName: process.env.BUSINESS_NAME || "Eagle Investors",
      supportEmail: process.env.BUSINESS_SUPPORT_EMAIL || "support@eagle-investors.com",
    },
  },

  // Product-specific payment descriptions
  getProductDescription: (productInfo, subscriptionType) => {
    const subscriptionText = subscriptionType === "yearly" ? "Annual" : "Monthly";
    return `${productInfo.name} - ${subscriptionText} Subscription`;
  },

  // Bank statement descriptor suffix based on product
  getStatementDescriptorSuffix: (productName) => {
    const productMap = {
      "Basic Package": "BASIC",
      "Basic Advisory": "BASIC",
      "Diamond Package": "DIAMOND",
      "Diamond Advisory": "DIAMOND",
      "Infinity Package": "INFINITY",
      "Infinity Advisory": "INFINITY",
      "Script Package": "SCRIPTS",
      "Script Package (Monthly)": "SCRIPTS",
      "Script Package (Yearly)": "SCRIPTS",
      "Investment Advising": "ADVISOR",
      "Trading Tutor": "TUTOR",
      "Eagle Ultimate": "ULTIMATE",
      "Eagle Premium Monthly": "PREMIUM",
      "Eagle Premium Annual": "PREMIUM",
      "Eagle Investors Subscriptions": "EAGLE",
    };

    // Return mapped value or safely create a default suffix
    if (productMap[productName]) {
      return productMap[productName];
    }

    // Safe fallback - handle undefined or null productName
    if (!productName || typeof productName !== 'string') {
      return "EAGLE";
    }

    return productName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  // Return URLs for payment completion
  getReturnUrls: () => {
    const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:3000";
    return {
      success: `${baseUrl}/payment/success`,
      cancel: `${baseUrl}/payment/cancel`,
      error: `${baseUrl}/payment/error`,
    };
  },

  // Customer service information for payment pages
  customerService: {
    phone: process.env.BUSINESS_PHONE || null,
    email: process.env.BUSINESS_SUPPORT_EMAIL || "support@eagle-investors.com",
    hours: "Monday-Friday 9AM-6PM EST",
    website: process.env.BUSINESS_WEBSITE || "https://eagle-investors.com",
  },
};

module.exports = PAYMENT_BRANDING;
