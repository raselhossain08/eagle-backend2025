const mongoose = require("mongoose");

const signedContractSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Allow null for guest contracts
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false, // Optional phone number
    },
    // Address Information
    country: {
      type: String,
      required: false, // Country
    },
    streetAddress: {
      type: String,
      required: false, // Street address
    },
    flatSuiteUnit: {
      type: String,
      required: false, // Apartment, suite, unit, etc. (optional)
    },
    townCity: {
      type: String,
      required: false, // Town or city
    },
    stateCounty: {
      type: String,
      required: false, // State or county
    },
    postcodeZip: {
      type: String,
      required: false, // Postal code or ZIP code
    },
    discordUsername: {
      type: String,
      required: false, // Discord username for community access
    },
    signature: {
      type: String,
      required: true,
    },
    productType: {
      type: String,
      required: true,
      enum: [
        "basic",
        "diamond",
        "infinity",
        "script",
        "investment-advising",
        "trading-tutor",
        "ultimate",
        // New product types from updated frontend
        "basic-subscription",
        "diamond-subscription",
        "infinity-subscription",
        "mentorship-package",
        "product-purchase",
        "eagle-ultimate",
        "trading-tutoring",
      ],
    },
    // PDF storage information (optional - frontend may handle PDF generation)
    pdfPath: {
      type: String,
      required: false, // Made optional since PDF generation may be handled by frontend
    },
    // Cloudinary specific fields (optional)
    pdfCloudinaryUrl: {
      type: String, // Secure URL from Cloudinary
      required: false,
    },
    pdfCloudinaryPublicId: {
      type: String, // Public ID for Cloudinary management
      required: false,
    },
    pdfStorageProvider: {
      type: String,
      enum: ['local', 'cloudinary', 'frontend'],
      default: 'frontend', // Default to frontend handling
    },
    // Contract HTML template for frontend PDF generation
    contractHtmlTemplate: {
      type: String,
      required: false, // HTML template for frontend PDF generation
    },
    contractTitle: {
      type: String,
      required: false, // Contract title for reference
    },
    pdfGenerationMethod: {
      type: String,
      enum: ['backend', 'frontend', 'none'],
      default: 'frontend', // Indicates where PDF generation should happen
    },
    signedDate: {
      type: Date,
      default: Date.now,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    status: {
      type: String,
      enum: ["signed", "payment_pending", "completed", "cancelled"],
      default: "signed",
    },
    paymentId: {
      type: String,
    },
    paymentProvider: {
      type: String,
      enum: ["paypal", "stripe"],
    },
    subscriptionType: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "yearly",
    },
    subscriptionPrice: {
      type: Number,
      required: true,
    },
    subscriptionStartDate: {
      type: Date,
    },
    subscriptionEndDate: {
      type: Date,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    isGuestContract: {
      type: Boolean,
      default: false, // Flag to identify guest contracts (created without user account)
    },
    scheduledDowngrade: {
      targetSubscription: {
        type: String,
        enum: ["Basic", "Diamond", "Infinity"],
      },
      scheduledDate: {
        type: Date,
      },
      effectiveDate: {
        type: Date,
      },
      status: {
        type: String,
        enum: ["scheduled", "processed", "cancelled"],
        default: "scheduled",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
signedContractSchema.index({ userId: 1, productType: 1 });
signedContractSchema.index({ email: 1 });
signedContractSchema.index({ status: 1 });

module.exports = mongoose.model("SignedContract", signedContractSchema);
