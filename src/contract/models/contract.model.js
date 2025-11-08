const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Contract Template Schema
 * Versioned templates for different plans/regions with multi-language support
 */

const placeholderSchema = new mongoose.Schema({
  key: { type: String, required: true }, // e.g., "subscriber_name", "plan_price"
  label: { type: String, required: true }, // Human-readable label
  type: {
    type: String,
    enum: ['text', 'number', 'date', 'currency', 'email', 'boolean'],
    default: 'text'
  },
  required: { type: Boolean, default: true },
  defaultValue: { type: String },
  validation: {
    pattern: { type: String }, // Regex pattern
    minLength: { type: Number },
    maxLength: { type: Number },
    min: { type: Number },
    max: { type: Number }
  }
}, { _id: false });

const contractTemplateSchema = new mongoose.Schema({
  id: { type: String }, // Unique index defined in schema.index() below
  name: { type: String },
  description: { type: String },

  // Template Status
  status: {
    type: String,
    enum: ['draft', 'review', 'approved', 'active', 'deprecated', 'archived'],
    default: 'draft'
  },

  // Template Category and Locale
  category: {
    type: String,
    enum: ['investment_agreement', 'service_agreement', 'privacy_policy', 'terms_of_service', 'nda', 'custom'],
    default: 'custom'
  },
  locale: { type: String, default: 'en-US' },

  // Version Control
  version: { type: String, default: '1.0.0' },
  previousVersionId: { type: String },
  isActive: { type: Boolean, default: true },

  // Template Content
  content: {
    body: { type: String }, // Plain text content with placeholders
    htmlBody: { type: String }, // HTML content (optional)
    variables: [{
      name: { type: String },
      label: { type: String },
      type: {
        type: String,
        enum: ['text', 'number', 'date', 'boolean', 'select', 'textarea', 'email', 'phone', 'currency'],
        default: 'text'
      },
      required: { type: Boolean, default: false },
      defaultValue: { type: mongoose.Schema.Types.Mixed },
      options: [{ type: String }], // For select type
      description: { type: String },
      placeholder: { type: String },
      group: { type: String }
    }]
  },

  // Template Metadata
  metadata: {
    title: { type: String },
    description: { type: String },
    tags: [{ type: String }],
    keywords: [{ type: String }],
    author: { type: String },
    jurisdiction: { type: String },
    applicableLaw: { type: String }
  },

  // Legal Requirements
  legal: {
    requiresSignature: { type: Boolean, default: true },
    signatureType: {
      type: String,
      enum: ['electronic', 'digital', 'wet'],
      default: 'electronic'
    },
    witnessRequired: { type: Boolean, default: false },
    notarizationRequired: { type: Boolean, default: false },
    retentionPeriod: { type: String }, // e.g., "7 years"
    complianceNotes: { type: String }
  },

  // Template Configuration
  config: {
    // Applicable Plans
    applicablePlans: [{ type: String }], // Plan IDs this template applies to
    applicableRegions: [{ type: String }], // Country codes

    // Signing Requirements
    signingRequirements: {
      requireSignature: { type: Boolean, default: true },
      allowTypedSignature: { type: Boolean, default: true },
      allowDrawnSignature: { type: Boolean, default: true },
      allowUploadedSignature: { type: Boolean, default: false },
      requireInitials: { type: Boolean, default: false },

      // Identity Verification
      requireIdVerification: { type: Boolean, default: false },
      requireSelfie: { type: Boolean, default: false },
      requireDocumentUpload: { type: Boolean, default: false },

      // Consent Checkboxes
      requiredConsents: [{
        id: { type: String, required: true },
        label: { type: String, required: true },
        required: { type: Boolean, default: true },
        order: { type: Number, default: 0 }
      }]
    },

    // Legal Settings
    legal: {
      termsVersionId: { type: String },
      privacyVersionId: { type: String },
      cancellationPolicyVersionId: { type: String },
      jurisdiction: { type: String },
      governingLaw: { type: String }
    },

    // Expiration
    expirationDays: { type: Number, default: 30 },
    reminderDays: [{ type: Number }], // Days before expiration to send reminders

    // Security
    requireEncryption: { type: Boolean, default: true },
    allowOfflineAccess: { type: Boolean, default: false },
    ipRestrictions: [{ type: String }] // CIDR blocks
  },

  // Dynamic Placeholders
  placeholders: [placeholderSchema],

  // Styling
  styling: {
    theme: { type: String, default: 'default' },
    primaryColor: { type: String, default: '#007bff' },
    fontFamily: { type: String, default: 'Arial, sans-serif' },
    fontSize: { type: String, default: '14px' },
    customCSS: { type: String },
    logoUrl: { type: String },

    // Layout
    layout: {
      showHeader: { type: Boolean, default: true },
      showFooter: { type: Boolean, default: true },
      showWatermark: { type: Boolean, default: false },
      pageNumbers: { type: Boolean, default: true }
    }
  },

  // Audit Information
  audit: {
    createdBy: { type: String },
    createdByName: { type: String },
    createdAt: { type: Date, default: Date.now },

    lastModifiedBy: { type: String },
    lastModifiedByName: { type: String },
    lastModifiedAt: { type: Date },

    approvedBy: { type: String },
    approvedByName: { type: String },
    approvedAt: { type: Date },

    publishedBy: { type: String },
    publishedByName: { type: String },
    publishedAt: { type: Date }
  },

  // Usage Statistics
  statistics: {
    totalSent: { type: Number, default: 0 },
    totalSigned: { type: Number, default: 0 },
    totalDeclined: { type: Number, default: 0 },
    totalExpired: { type: Number, default: 0 },
    averageSigningTime: { type: Number, default: 0 }, // in minutes
    lastUsed: { type: Date }
  }
}, {
  timestamps: true,
  collection: 'contract_templates'
});

/**
 * Signed Contract Schema
 * Individual contract instances with evidence packets
 */

const signerInfoSchema = new mongoose.Schema({
  // Signer Identity
  signerId: { type: String, required: true },
  signerType: { type: String, enum: ['subscriber', 'admin', 'third_party'], default: 'subscriber' },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  title: { type: String },
  company: { type: String },

  // Signing Process
  status: {
    type: String,
    enum: ['pending', 'sent', 'opened', 'signed', 'declined', 'expired'],
    default: 'pending'
  },

  // Timestamps
  sentAt: { type: Date },
  openedAt: { type: Date },
  signedAt: { type: Date },
  declinedAt: { type: Date },
  expiredAt: { type: Date },

  // Signature Data
  signature: {
    type: { type: String, enum: ['typed', 'drawn', 'uploaded'] },
    data: { type: String }, // Base64 encoded signature image or typed text
    coordinates: [{
      x: { type: Number },
      y: { type: Number },
      timestamp: { type: Number }
    }],

    // PKI Signature (if supported)
    cryptographic: {
      algorithm: { type: String },
      publicKey: { type: String },
      signature: { type: String },
      certificate: { type: String }
    }
  },

  // Identity Verification
  verification: {
    idDocument: {
      type: { type: String }, // passport, license, etc.
      number: { type: String },
      issuingCountry: { type: String },
      expirationDate: { type: Date },
      verified: { type: Boolean, default: false }
    },

    selfie: {
      imageUrl: { type: String },
      verified: { type: Boolean, default: false },
      confidence: { type: Number } // 0-100
    },

    biometric: {
      fingerprint: { type: String },
      voiceprint: { type: String },
      retinaScan: { type: String }
    }
  },

  // Consent Records
  consents: [{
    consentId: { type: String, required: true },
    label: { type: String, required: true },
    accepted: { type: Boolean, required: true },
    timestamp: { type: Date, default: Date.now }
  }],

  // Evidence Packet
  evidence: {
    // Technical Details
    ipAddress: { type: String, required: true },
    userAgent: { type: String, required: true },
    deviceFingerprint: { type: String },

    // Geolocation (if consent given)
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracy: { type: Number },
      country: { type: String },
      region: { type: String },
      city: { type: String },
      timezone: { type: String },

      // Legal basis for collection
      legalBasis: { type: String, enum: ['consent', 'legitimate_interest', 'contract'] },
      consentGiven: { type: Boolean, default: false }
    },

    // Device Information
    device: {
      type: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
      os: { type: String },
      browser: { type: String },
      screenResolution: { type: String },
      colorDepth: { type: Number },
      touchSupport: { type: Boolean }
    },

    // Session Information
    sessionId: { type: String },
    sessionDuration: { type: Number }, // in seconds
    pageViews: { type: Number },
    keystrokePattern: [{ type: Number }], // Timing between keystrokes for biometric analysis
    mouseMovements: [{
      x: { type: Number },
      y: { type: Number },
      timestamp: { type: Number }
    }],

    // Document Hash at Signing Time
    documentHash: { type: String, required: true },
    documentVersion: { type: String, required: true },

    // Legal References
    termsVersion: { type: String },
    privacyVersion: { type: String },
    cancellationPolicyVersion: { type: String },

    // Audit Trail
    accessLog: [{
      action: { type: String },
      timestamp: { type: Date, default: Date.now },
      ipAddress: { type: String },
      userAgent: { type: String }
    }]
  }
}, { _id: false });

const signedContractSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Unique index defined in schema.index() below
  contractId: { type: String }, // External system contract ID

  // Template Reference
  templateId: { type: String, required: true },
  templateVersion: { type: String, required: true },

  // Related Records
  subscriberId: { type: String, required: true },
  subscriptionId: { type: String },
  planId: { type: String },
  orderId: { type: String },

  // Contract Details
  title: { type: String, required: true },
  description: { type: String },
  language: { type: String, default: 'en' },
  currency: { type: String, default: 'USD' },

  // Status
  status: {
    type: String,
    enum: ['draft', 'sent', 'partially_signed', 'fully_signed', 'completed', 'declined', 'expired', 'voided'],
    default: 'draft'
  },

  // Rendered Content
  content: {
    originalHtml: { type: String, required: true },
    finalHtml: { type: String }, // After all signatures
    pdfUrl: { type: String },

    // Populated placeholder values
    placeholderValues: { type: Map, of: mongoose.Schema.Types.Mixed }
  },

  // Signers
  signers: [signerInfoSchema],

  // Important Dates
  dates: {
    created: { type: Date, default: Date.now },
    sent: { type: Date },
    firstOpened: { type: Date },
    lastActivity: { type: Date },
    completed: { type: Date },
    expires: { type: Date },
    voided: { type: Date }
  },

  // Security & Compliance
  security: {
    // Document Integrity
    originalHash: { type: String, required: true },
    finalHash: { type: String },
    hashAlgorithm: { type: String, default: 'SHA-256' },

    // Encryption
    encrypted: { type: Boolean, default: false },
    encryptionKey: { type: String },

    // Access Control
    allowedIPs: [{ type: String }],
    maxViews: { type: Number },
    currentViews: { type: Number, default: 0 },

    // Audit Requirements
    requiresNotarization: { type: Boolean, default: false },
    requiresWitnessing: { type: Boolean, default: false },
    requiresArchiving: { type: Boolean, default: true }
  },

  // Third-Party Integration
  integration: {
    provider: { type: String, enum: ['native', 'docusign', 'adobe_sign', 'dropbox_sign'] },
    externalId: { type: String },
    externalStatus: { type: String },
    webhookData: { type: Map, of: mongoose.Schema.Types.Mixed },
    syncedAt: { type: Date }
  },

  // Legal & Compliance
  compliance: {
    jurisdiction: { type: String },
    governingLaw: { type: String },

    // Regulatory Requirements
    gdprCompliant: { type: Boolean, default: true },
    hipaaCompliant: { type: Boolean, default: false },
    soxCompliant: { type: Boolean, default: false },

    // Retention
    retentionPeriod: { type: Number }, // in years
    destructionDate: { type: Date },
    legalHold: { type: Boolean, default: false },

    // Evidence Package
    evidencePackage: {
      certificateUrl: { type: String },
      evidencePackageUrl: { type: String },
      auditTrailUrl: { type: String },
      immutableStorageHash: { type: String }
    }
  },

  // Workflow & Notifications
  workflow: {
    currentStep: { type: Number, default: 0 },
    steps: [{
      stepId: { type: String },
      name: { type: String },
      status: { type: String, enum: ['pending', 'in_progress', 'completed', 'skipped'] },
      assignedTo: { type: String },
      dueDate: { type: Date },
      completedAt: { type: Date }
    }],

    // Notifications
    notifications: {
      enabled: { type: Boolean, default: true },
      reminderSchedule: [{ type: Number }], // Days
      escalationRules: [{
        condition: { type: String },
        action: { type: String },
        recipient: { type: String }
      }]
    }
  },

  // Analytics
  analytics: {
    totalViews: { type: Number, default: 0 },
    uniqueViews: { type: Number, default: 0 },
    timeToSign: { type: Number }, // in minutes
    bounceRate: { type: Number },

    // Engagement Metrics
    engagement: {
      scrollDepth: { type: Number },
      timeOnPage: { type: Number },
      clickHeatmap: [{ x: Number, y: Number, count: Number }]
    }
  },

  // Metadata
  metadata: {
    source: { type: String }, // web, api, admin, etc.
    campaign: { type: String },
    referrer: { type: String },
    utm: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      term: { type: String },
      content: { type: String }
    },

    // Custom Fields
    customFields: { type: Map, of: mongoose.Schema.Types.Mixed },
    tags: [{ type: String }]
  }
}, {
  timestamps: true,
  collection: 'signed_contracts'
});

// Indexes
contractTemplateSchema.index({ id: 1 }, { unique: true });
contractTemplateSchema.index({ isActive: 1 });
contractTemplateSchema.index({ 'config.applicablePlans': 1 });
contractTemplateSchema.index({ version: 1 });

signedContractSchema.index({ id: 1 }, { unique: true });
signedContractSchema.index({ subscriberId: 1 });
signedContractSchema.index({ templateId: 1 });
signedContractSchema.index({ status: 1 });
signedContractSchema.index({ 'dates.created': -1 });
signedContractSchema.index({ 'dates.expires': 1 });
signedContractSchema.index({ 'signers.email': 1 });

// Methods for Contract Template
contractTemplateSchema.methods = {
  /**
   * Render template with placeholder values
   */
  render(placeholderValues = {}, language = 'en') {
    const content = this.content.languages.get(language) ||
      this.content.languages.get(this.content.defaultLanguage);

    if (!content) {
      throw new Error(`Template content not available for language: ${language}`);
    }

    let renderedBody = content.body;

    // Replace placeholders
    this.placeholders.forEach(placeholder => {
      const value = placeholderValues[placeholder.key] || placeholder.defaultValue || '';
      const regex = new RegExp(`{{${placeholder.key}}}`, 'g');
      renderedBody = renderedBody.replace(regex, value);
    });

    return {
      title: content.title,
      body: renderedBody,
      footer: content.footer,
      metadata: content.metadata
    };
  },

  /**
   * Validate placeholder values
   */
  validatePlaceholders(placeholderValues) {
    const errors = [];

    this.placeholders.forEach(placeholder => {
      const value = placeholderValues[placeholder.key];

      if (placeholder.required && !value) {
        errors.push(`${placeholder.label} is required`);
        return;
      }

      if (!value) return;

      // Type validation
      if (placeholder.type === 'number' && isNaN(Number(value))) {
        errors.push(`${placeholder.label} must be a number`);
      }

      if (placeholder.type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors.push(`${placeholder.label} must be a valid email`);
        }
      }

      // Validation rules
      if (placeholder.validation) {
        const { pattern, minLength, maxLength, min, max } = placeholder.validation;

        if (pattern && !new RegExp(pattern).test(value)) {
          errors.push(`${placeholder.label} format is invalid`);
        }

        if (minLength && value.length < minLength) {
          errors.push(`${placeholder.label} must be at least ${minLength} characters`);
        }

        if (maxLength && value.length > maxLength) {
          errors.push(`${placeholder.label} must be no more than ${maxLength} characters`);
        }

        if (min !== undefined && Number(value) < min) {
          errors.push(`${placeholder.label} must be at least ${min}`);
        }

        if (max !== undefined && Number(value) > max) {
          errors.push(`${placeholder.label} must be no more than ${max}`);
        }
      }
    });

    return errors;
  },

  /**
   * Create new version
   */
  createNewVersion(updates, userId, userName) {
    const newVersion = JSON.parse(JSON.stringify(this.toObject()));

    // Update version
    const versionParts = this.version.split('.').map(Number);
    versionParts[1]++; // Minor version bump
    newVersion.version = versionParts.join('.');
    newVersion.previousVersionId = this.id;
    newVersion.id = `${this.id.split('_')[0]}_v${newVersion.version.replace(/\./g, '_')}`;

    // Apply updates
    Object.assign(newVersion, updates);

    // Update audit info
    newVersion.audit.createdBy = userId;
    newVersion.audit.createdByName = userName;
    newVersion.audit.createdAt = new Date();
    newVersion.audit.lastModifiedBy = userId;
    newVersion.audit.lastModifiedByName = userName;
    newVersion.audit.lastModifiedAt = new Date();

    // Reset statistics
    newVersion.statistics = {
      totalSent: 0,
      totalSigned: 0,
      totalDeclined: 0,
      totalExpired: 0,
      averageSigningTime: 0
    };

    return newVersion;
  }
};

// Methods for Signed Contract
signedContractSchema.methods = {
  /**
   * Generate document hash
   */
  generateDocumentHash() {
    const content = this.content.originalHtml || this.content.finalHtml;
    this.security.originalHash = crypto
      .createHash(this.security.hashAlgorithm.toLowerCase())
      .update(content)
      .digest('hex');

    return this.security.originalHash;
  },

  /**
   * Add signer evidence
   */
  addSignerEvidence(signerId, evidenceData) {
    const signer = this.signers.find(s => s.signerId === signerId);
    if (!signer) {
      throw new Error('Signer not found');
    }

    // Update evidence
    Object.assign(signer.evidence, evidenceData);

    // Add to access log
    signer.evidence.accessLog.push({
      action: 'evidence_collected',
      timestamp: new Date(),
      ipAddress: evidenceData.ipAddress,
      userAgent: evidenceData.userAgent
    });

    this.dates.lastActivity = new Date();

    return signer;
  },

  /**
   * Complete signing process
   */
  completeSigning(signerId, signatureData) {
    const signer = this.signers.find(s => s.signerId === signerId);
    if (!signer) {
      throw new Error('Signer not found');
    }

    if (signer.status === 'signed') {
      throw new Error('Document already signed by this signer');
    }

    // Update signer
    signer.status = 'signed';
    signer.signedAt = new Date();
    signer.signature = signatureData.signature;

    // Update consents
    if (signatureData.consents) {
      signer.consents = signatureData.consents.map(consent => ({
        ...consent,
        timestamp: new Date()
      }));
    }

    // Check if all signers have signed
    const allSigned = this.signers.every(s => s.status === 'signed');

    if (allSigned) {
      this.status = 'fully_signed';
      this.dates.completed = new Date();

      // Generate final hash
      this.security.finalHash = this.generateDocumentHash();
    } else {
      this.status = 'partially_signed';
    }

    this.dates.lastActivity = new Date();

    return signer;
  },

  /**
   * Generate evidence package
   */
  async generateEvidencePackage() {
    const evidenceData = {
      contractId: this.id,
      templateId: this.templateId,
      templateVersion: this.templateVersion,

      // Document Information
      document: {
        title: this.title,
        originalHash: this.security.originalHash,
        finalHash: this.security.finalHash,
        hashAlgorithm: this.security.hashAlgorithm,
        language: this.language,
        currency: this.currency
      },

      // Signers and Evidence
      signers: this.signers.map(signer => ({
        signerId: signer.signerId,
        fullName: signer.fullName,
        email: signer.email,
        status: signer.status,
        signedAt: signer.signedAt,

        // Evidence Summary
        evidence: {
          ipAddress: signer.evidence.ipAddress,
          userAgent: signer.evidence.userAgent,
          location: signer.evidence.location,
          device: signer.evidence.device,
          documentHash: signer.evidence.documentHash,
          termsVersion: signer.evidence.termsVersion,
          privacyVersion: signer.evidence.privacyVersion
        },

        // Signature Data
        signature: {
          type: signer.signature?.type,
          timestamp: signer.signedAt
        },

        // Consents
        consents: signer.consents
      })),

      // Timeline
      timeline: [
        { event: 'contract_created', timestamp: this.dates.created },
        { event: 'contract_sent', timestamp: this.dates.sent },
        { event: 'first_opened', timestamp: this.dates.firstOpened },
        { event: 'contract_completed', timestamp: this.dates.completed }
      ].filter(item => item.timestamp),

      // Compliance Information
      compliance: this.compliance,

      // Generation Metadata
      generatedAt: new Date(),
      generatedBy: 'system',
      version: '1.0'
    };

    return evidenceData;
  },

  /**
   * Void contract
   */
  voidContract(reason, voidedBy, voidedByName) {
    if (this.status === 'voided') {
      throw new Error('Contract is already voided');
    }

    this.status = 'voided';
    this.dates.voided = new Date();

    // Add void information to metadata
    this.metadata.voidReason = reason;
    this.metadata.voidedBy = voidedBy;
    this.metadata.voidedByName = voidedByName;
    this.metadata.voidedAt = new Date();

    // Mark all pending signers as voided
    this.signers.forEach(signer => {
      if (signer.status === 'pending' || signer.status === 'sent') {
        signer.status = 'expired';
      }
    });

    return this;
  },

  /**
   * Check if contract is expired
   */
  isExpired() {
    return this.dates.expires && new Date() > this.dates.expires;
  },

  /**
   * Get signing progress
   */
  getSigningProgress() {
    const totalSigners = this.signers.length;
    const signedCount = this.signers.filter(s => s.status === 'signed').length;

    return {
      totalSigners,
      signedCount,
      pendingCount: totalSigners - signedCount,
      percentageComplete: totalSigners > 0 ? (signedCount / totalSigners) * 100 : 0,
      isComplete: signedCount === totalSigners && totalSigners > 0
    };
  }
};

// Static methods
signedContractSchema.statics = {
  /**
   * Search contracts with filters
   */
  async searchContracts(filters = {}, options = {}) {
    const {
      subscriberId,
      templateId,
      status,
      dateRange,
      signedBy,
      search
    } = filters;

    const {
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const query = {};

    if (subscriberId) query.subscriberId = subscriberId;
    if (templateId) query.templateId = templateId;
    if (status) query.status = Array.isArray(status) ? { $in: status } : status;

    if (dateRange?.start && dateRange?.end) {
      query['dates.created'] = {
        $gte: new Date(dateRange.start),
        $lte: new Date(dateRange.end)
      };
    }

    if (signedBy) {
      query['signers.email'] = signedBy;
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { 'signers.fullName': new RegExp(search, 'i') },
        { 'signers.email': new RegExp(search, 'i') }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [contracts, total] = await Promise.all([
      this.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.countDocuments(query)
    ]);

    return {
      contracts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
};

// Pre-save middleware
signedContractSchema.pre('save', function (next) {
  // Update analytics
  this.analytics.totalViews = this.analytics.uniqueViews;

  // Check expiration
  if (this.isExpired() && this.status !== 'voided' && this.status !== 'fully_signed') {
    this.status = 'expired';
  }

  next();
});

// Transform template output to ensure frontend gets the custom ID
contractTemplateSchema.set('toJSON', {
  transform: function(doc, ret) {
    // Ensure the custom id is available as both 'id' and 'templateId' for frontend compatibility
    ret.templateId = ret.id;
    
    // Optionally keep _id for internal MongoDB operations
    ret._id = doc._id;
    
    return ret;
  }
});

// Virtual field for easier access
contractTemplateSchema.virtual('templateId').get(function() {
  return this.id;
});

const ContractTemplate = mongoose.model('ContractTemplate', contractTemplateSchema);

// Check if SignedContract model already exists to prevent overwrite error
let SignedContract;
try {
  SignedContract = mongoose.model('SignedContract');
} catch (error) {
  SignedContract = mongoose.model('SignedContract', signedContractSchema);
}

module.exports = {
  ContractTemplate,
  SignedContract
};





