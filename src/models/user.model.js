const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    name: { 
      type: String, 
      required: false, // For cases where we have full name instead of first/last
    },
    email: { type: String, required: true, unique: true },
    phone: { 
      type: String, 
      required: false 
    },
    password: { 
      type: String, 
      required: function() {
        return !this.isPendingUser; // Password not required for pending users
      }, 
      minlength: 6 
    },
    role: {
      type: String,
      enum: ["subscriber", "user", "admin", "superadmin"],
      default: "subscriber",
    },
    // RBAC Integration - Keep legacy role for backward compatibility
    // New RBAC roles are managed via UserRole model in src/api/models/userRole.model.js
    subscription: {
      type: String,
      enum: ["None", "Basic", "Diamond", "Infinity", "Script"],
      default: "None",
    },
    // Address Information
    address: {
      country: { type: String, required: false },
      streetAddress: { type: String, required: false },
      flatSuiteUnit: { type: String, required: false },
      townCity: { type: String, required: false },
      stateCounty: { type: String, required: false },
      postcodeZip: { type: String, required: false },
    },
    // Additional Contact Information
    discordUsername: { 
      type: String, 
      required: false 
    },
    // WordPress Integration Fields
    wordpressId: { 
      type: Number, 
      unique: true, 
      sparse: true,
      index: true 
    },
    isWordPressUser: { 
      type: Boolean, 
      default: false 
    },
    lastSyncedAt: { 
      type: Date, 
      default: Date.now 
    },
    // Password Reset
    resetToken: String,
    resetTokenExpiry: Date,
    // Account Activation
    activationToken: String,
    activationTokenExpiry: Date,
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    // Account Status
    isActive: {
      type: Boolean,
      default: true
    },
    isPendingUser: {
      type: Boolean,
      default: false
    },
    lastLoginAt: {
      type: Date
    }
  },
  { 
    timestamps: true,
    // Add indexes for better performance
    indexes: [
      { email: 1 },
      { wordpressId: 1 },
      { subscription: 1 },
      { isWordPressUser: 1 }
    ]
  }
);

// Hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Match password
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
