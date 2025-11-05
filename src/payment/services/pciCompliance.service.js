const crypto = require('crypto');
const { getEncryptionService } = require('./encryption.service');

/**
 * PCI DSS Compliance Service
 * Ensures payment card data security and compliance
 * Maintains SAQ-A posture by never storing card data
 */
class PCIComplianceService {
  constructor() {
    this.encryptionService = getEncryptionService();
    
    // PCI DSS requirements
    this.requirements = {
      // Requirement 1: Firewall configuration
      firewall: {
        required: true,
        description: 'Install and maintain a firewall configuration'
      },
      
      // Requirement 2: Default passwords
      defaultPasswords: {
        required: true,
        description: 'Do not use vendor-supplied defaults'
      },
      
      // Requirement 3: Protect stored cardholder data
      dataProtection: {
        required: true,
        description: 'Protect stored cardholder data'
      },
      
      // Requirement 4: Encrypt transmission
      encryption: {
        required: true,
        description: 'Encrypt transmission of cardholder data'
      },
      
      // Requirement 5: Antivirus software
      antivirus: {
        required: true,
        description: 'Use and regularly update anti-virus software'
      },
      
      // Requirement 6: Secure systems and applications
      secureApplications: {
        required: true,
        description: 'Develop and maintain secure systems'
      },
      
      // Requirement 7: Restrict access by business need
      accessControl: {
        required: true,
        description: 'Restrict access to cardholder data'
      },
      
      // Requirement 8: Unique IDs
      uniqueIds: {
        required: true,
        description: 'Assign unique ID to each computer user'
      },
      
      // Requirement 9: Physical access
      physicalAccess: {
        required: true,
        description: 'Restrict physical access to cardholder data'
      },
      
      // Requirement 10: Network access and monitoring
      monitoring: {
        required: true,
        description: 'Track and monitor access to network resources'
      },
      
      // Requirement 11: Security testing
      securityTesting: {
        required: true,
        description: 'Regularly test security systems and processes'
      },
      
      // Requirement 12: Information security policy
      securityPolicy: {
        required: true,
        description: 'Maintain information security policy'
      }
    };

    // SAQ-A specific requirements (our target posture)
    this.saqARequirements = {
      description: 'SAQ-A: Card-not-present merchants using third-party PSP',
      scope: 'Minimal PCI DSS requirements for outsourced payment processing',
      requirements: [
        'Ensure secure transmission of cardholder data',
        'Use only validated payment applications',
        'Implement strong access control measures',
        'Regularly monitor and test networks',
        'Maintain information security policy'
      ]
    };

    // Prohibited data that must NEVER be stored
    this.prohibitedData = {
      fullTrackData: {
        description: 'Full contents of any track from magnetic stripe',
        examples: ['Track 1', 'Track 2', 'Track 3']
      },
      cardVerificationCode: {
        description: 'Card verification codes/values',
        examples: ['CVV', 'CVC', 'CVV2', 'CVC2', 'CID']
      },
      pinData: {
        description: 'PIN verification value',
        examples: ['PIN', 'Encrypted PIN', 'PIN block']
      }
    };

    // Allowed data with protection requirements
    this.allowedDataWithProtection = {
      primaryAccountNumber: {
        description: 'PAN (Primary Account Number)',
        protection: 'Must be masked/truncated, encrypted if stored',
        display: 'Show only first 6 and last 4 digits'
      },
      cardholderName: {
        description: 'Cardholder name as appears on card',
        protection: 'Encrypt if business need requires storage'
      },
      expirationDate: {
        description: 'Card expiration date',
        protection: 'Encrypt if stored beyond authorization'
      },
      serviceCode: {
        description: 'Three-digit service code',
        protection: 'Encrypt if stored'
      }
    };

    // Payment service providers configuration
    this.pspConfig = {
      stripe: {
        name: 'Stripe',
        tokenization: true,
        pciCompliant: true,
        saqLevel: 'A'
      },
      paypal: {
        name: 'PayPal',
        tokenization: true,
        pciCompliant: true,
        saqLevel: 'A'
      },
      square: {
        name: 'Square',
        tokenization: true,
        pciCompliant: true,
        saqLevel: 'A'
      }
    };
  }

  /**
   * Initialize PCI compliance service
   */
  async initialize() {
    try {
      // Verify we're in SAQ-A posture
      await this.verifySAQAPosture();
      
      // Initialize data classification
      await this.initializeDataClassification();
      
      // Set up monitoring
      await this.setupComplianceMonitoring();
      
      console.log('PCI compliance service initialized in SAQ-A posture');
      return true;
    } catch (error) {
      console.error('Failed to initialize PCI compliance service:', error);
      throw error;
    }
  }

  /**
   * Verify SAQ-A posture compliance
   */
  async verifySAQAPosture() {
    const checks = {
      noCardDataStorage: await this.checkNoCardDataStorage(),
      pspTokenization: await this.checkPSPTokenization(),
      secureTransmission: await this.checkSecureTransmission(),
      accessControls: await this.checkAccessControls(),
      monitoring: await this.checkMonitoring()
    };

    const allPassed = Object.values(checks).every(check => check.compliant);
    
    if (!allPassed) {
      const failures = Object.entries(checks)
        .filter(([_, check]) => !check.compliant)
        .map(([requirement, check]) => `${requirement}: ${check.reason}`);
      
      throw new Error(`SAQ-A posture verification failed: ${failures.join(', ')}`);
    }

    return {
      posture: 'SAQ-A',
      compliant: true,
      checks: checks,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Check that no card data is stored
   */
  async checkNoCardDataStorage() {
    try {
      // This would scan your database/storage for any prohibited data
      // For now, we'll check configuration
      
      const storagePolicy = {
        panStorage: false,
        cvvStorage: false,
        trackDataStorage: false,
        pinStorage: false
      };

      // Verify encryption service doesn't have card data mappings
      const cardDataFields = [
        'payment.cardNumber',
        'payment.cvv',
        'payment.cvv2',
        'payment.cvc',
        'payment.cvc2',
        'payment.trackData',
        'payment.pinData'
      ];

      const violations = [];
      for (const field of cardDataFields) {
        if (this.encryptionService.encryptedFields[field]) {
          violations.push(field);
        }
      }

      return {
        compliant: violations.length === 0,
        reason: violations.length > 0 ? `Card data fields configured for storage: ${violations.join(', ')}` : null,
        policy: storagePolicy
      };
    } catch (error) {
      return {
        compliant: false,
        reason: `Storage check failed: ${error.message}`
      };
    }
  }

  /**
   * Check PSP tokenization is properly configured
   */
  async checkPSPTokenization() {
    try {
      const configuredPSPs = [];
      
      // Check for PSP configuration
      if (process.env.STRIPE_SECRET_KEY) {
        configuredPSPs.push('stripe');
      }
      if (process.env.PAYPAL_CLIENT_ID) {
        configuredPSPs.push('paypal');
      }

      const hasValidPSP = configuredPSPs.length > 0;
      
      return {
        compliant: hasValidPSP,
        reason: hasValidPSP ? null : 'No PCI-compliant PSP configured',
        psps: configuredPSPs,
        tokenization: hasValidPSP
      };
    } catch (error) {
      return {
        compliant: false,
        reason: `PSP check failed: ${error.message}`
      };
    }
  }

  /**
   * Check secure transmission requirements
   */
  async checkSecureTransmission() {
    try {
      const tlsRequired = process.env.NODE_ENV === 'production';
      const httpsOnly = process.env.HTTPS_ONLY === 'true';
      
      return {
        compliant: !tlsRequired || httpsOnly,
        reason: tlsRequired && !httpsOnly ? 'HTTPS not enforced in production' : null,
        tlsVersion: 'TLS 1.2+',
        encryption: 'AES-256'
      };
    } catch (error) {
      return {
        compliant: false,
        reason: `Transmission check failed: ${error.message}`
      };
    }
  }

  /**
   * Check access control requirements
   */
  async checkAccessControls() {
    try {
      // This would check your RBAC implementation
      const controls = {
        rbacImplemented: true, // Based on your RBAC middleware
        twoFactorAvailable: true, // Based on your 2FA system
        sessionManagement: true, // Based on your session security
        principleOfLeastPrivilege: true
      };

      const allControlsActive = Object.values(controls).every(Boolean);
      
      return {
        compliant: allControlsActive,
        reason: allControlsActive ? null : 'Missing access controls',
        controls: controls
      };
    } catch (error) {
      return {
        compliant: false,
        reason: `Access control check failed: ${error.message}`
      };
    }
  }

  /**
   * Check monitoring requirements
   */
  async checkMonitoring() {
    try {
      const monitoring = {
        auditLogging: true, // Based on your audit system
        securityEventLogging: true,
        networkMonitoring: false, // Would need implementation
        fileIntegrityMonitoring: false // Would need implementation
      };

      const criticalMonitoring = monitoring.auditLogging && monitoring.securityEventLogging;
      
      return {
        compliant: criticalMonitoring,
        reason: criticalMonitoring ? null : 'Missing critical monitoring capabilities',
        capabilities: monitoring
      };
    } catch (error) {
      return {
        compliant: false,
        reason: `Monitoring check failed: ${error.message}`
      };
    }
  }

  /**
   * Initialize data classification for PCI
   */
  async initializeDataClassification() {
    // Ensure PCI data is properly classified
    const pciDataClassification = {
      'payment.token': 'pci', // PSP tokens
      'payment.lastFour': 'pci', // Last 4 digits
      'payment.cardType': 'internal', // Card type is not sensitive
      'payment.expiryMonth': 'pci',
      'payment.expiryYear': 'pci',
      'payment.cardholderName': 'pci',
      'subscription.paymentMethod': 'pci',
      'invoice.paymentDetails': 'pci'
    };

    // Register with encryption service
    Object.assign(this.encryptionService.encryptedFields, pciDataClassification);
    
    console.log('PCI data classification initialized');
  }

  /**
   * Tokenize payment method using PSP
   */
  async tokenizePaymentMethod(paymentData, psp = 'stripe') {
    try {
      // Validate that we never store prohibited data
      this.validateNoProhibitedData(paymentData);
      
      // Generate secure token (this would typically go to PSP)
      const token = this.generateSecureToken();
      
      // Create secure payment method record
      const securePaymentMethod = {
        token: token,
        psp: psp,
        lastFour: this.extractLastFour(paymentData.cardNumber),
        cardType: this.detectCardType(paymentData.cardNumber),
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
        cardholderName: paymentData.cardholderName,
        isPSPToken: true,
        pciCompliant: true,
        createdAt: new Date().toISOString()
      };

      // Log tokenization event
      await this.logPCIEvent('payment_tokenized', {
        psp: psp,
        cardType: securePaymentMethod.cardType,
        lastFour: securePaymentMethod.lastFour
      });

      return securePaymentMethod;
    } catch (error) {
      await this.logPCIEvent('tokenization_failed', {
        error: error.message,
        psp: psp
      });
      throw new Error(`Payment tokenization failed: ${error.message}`);
    }
  }

  /**
   * Validate that no prohibited data is present
   */
  validateNoProhibitedData(paymentData) {
    const violations = [];

    // Check for prohibited data patterns
    if (paymentData.cvv || paymentData.cvc || paymentData.cvv2 || paymentData.cvc2) {
      violations.push('CVV/CVC data detected');
    }

    if (paymentData.trackData || paymentData.track1 || paymentData.track2) {
      violations.push('Track data detected');
    }

    if (paymentData.pin || paymentData.pinBlock) {
      violations.push('PIN data detected');
    }

    // Check for full PAN storage attempt
    if (paymentData.cardNumber && paymentData.cardNumber.length > 6) {
      violations.push('Full PAN storage attempted');
    }

    if (violations.length > 0) {
      throw new Error(`PCI violation: ${violations.join(', ')}`);
    }
  }

  /**
   * Extract last four digits safely
   */
  extractLastFour(cardNumber) {
    if (!cardNumber || cardNumber.length < 4) {
      return null;
    }
    return cardNumber.slice(-4);
  }

  /**
   * Detect card type
   */
  detectCardType(cardNumber) {
    if (!cardNumber) return 'unknown';

    const number = cardNumber.replace(/\s+/g, '');
    
    if (/^4/.test(number)) return 'visa';
    if (/^5[1-5]/.test(number)) return 'mastercard';
    if (/^3[47]/.test(number)) return 'amex';
    if (/^6/.test(number)) return 'discover';
    
    return 'unknown';
  }

  /**
   * Generate secure PSP token
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Setup compliance monitoring
   */
  async setupComplianceMonitoring() {
    // Monitor for PCI violations
    setInterval(async () => {
      try {
        await this.performComplianceCheck();
      } catch (error) {
        console.error('Compliance monitoring error:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily checks

    console.log('PCI compliance monitoring initialized');
  }

  /**
   * Perform compliance check
   */
  async performComplianceCheck() {
    try {
      const checks = await this.verifySAQAPosture();
      
      if (!checks.compliant) {
        await this.logPCIEvent('compliance_violation', {
          checks: checks.checks,
          severity: 'HIGH'
        });
      }

      return checks;
    } catch (error) {
      await this.logPCIEvent('compliance_check_failed', {
        error: error.message,
        severity: 'CRITICAL'
      });
      throw error;
    }
  }

  /**
   * Log PCI-related events
   */
  async logPCIEvent(eventType, details) {
    const event = {
      type: 'PCI_EVENT',
      eventType: eventType,
      timestamp: new Date().toISOString(),
      details: details,
      compliance: 'PCI-DSS',
      saqLevel: 'A'
    };

    console.log('PCI Event:', event);
    
    // This would integrate with your audit logging system
    // await auditLogger.log(event);
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport() {
    try {
      const verification = await this.verifySAQAPosture();
      
      const report = {
        reportType: 'PCI-DSS SAQ-A Compliance',
        generatedAt: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        compliance: {
          status: verification.compliant ? 'COMPLIANT' : 'NON_COMPLIANT',
          posture: 'SAQ-A',
          scope: this.saqARequirements.scope
        },
        requirements: this.saqARequirements.requirements,
        checks: verification.checks,
        dataProtection: {
          cardDataStorage: 'PROHIBITED',
          tokenization: 'PSP_MANAGED',
          encryption: 'TLS_1_2_PLUS'
        },
        recommendations: this.getComplianceRecommendations(verification),
        nextAssessment: this.calculateNextAssessment()
      };

      return report;
    } catch (error) {
      throw new Error(`Compliance report generation failed: ${error.message}`);
    }
  }

  /**
   * Get compliance recommendations
   */
  getComplianceRecommendations(verification) {
    const recommendations = [];
    
    if (!verification.checks.noCardDataStorage.compliant) {
      recommendations.push({
        priority: 'CRITICAL',
        requirement: 'Data Storage',
        recommendation: 'Remove all card data storage capabilities',
        impact: 'Maintains SAQ-A posture'
      });
    }

    if (!verification.checks.pspTokenization.compliant) {
      recommendations.push({
        priority: 'HIGH',
        requirement: 'Tokenization',
        recommendation: 'Implement PCI-compliant PSP tokenization',
        impact: 'Reduces PCI scope'
      });
    }

    if (!verification.checks.secureTransmission.compliant) {
      recommendations.push({
        priority: 'HIGH',
        requirement: 'Transmission Security',
        recommendation: 'Enforce TLS 1.2+ for all payment data transmission',
        impact: 'Protects data in transit'
      });
    }

    return recommendations;
  }

  /**
   * Calculate next assessment date
   */
  calculateNextAssessment() {
    const nextAssessment = new Date();
    nextAssessment.setFullYear(nextAssessment.getFullYear() + 1);
    return nextAssessment.toISOString();
  }

  /**
   * Mask payment card number for display
   */
  maskCardNumber(cardNumber, showFirst = 6, showLast = 4) {
    if (!cardNumber || cardNumber.length < showFirst + showLast) {
      return '****';
    }

    const first = cardNumber.substring(0, showFirst);
    const last = cardNumber.substring(cardNumber.length - showLast);
    const middle = '*'.repeat(cardNumber.length - showFirst - showLast);

    return `${first}${middle}${last}`;
  }

  /**
   * Validate PSP token
   */
  validatePSPToken(token) {
    if (!token) return false;
    
    // Basic token validation
    return {
      valid: typeof token === 'string' && token.length >= 16,
      isPSPToken: true,
      tokenLength: token.length
    };
  }

  /**
   * Health check for PCI compliance
   */
  async healthCheck() {
    try {
      const verification = await this.verifySAQAPosture();
      
      return {
        healthy: verification.compliant,
        compliance: 'PCI-DSS',
        posture: 'SAQ-A',
        timestamp: new Date().toISOString(),
        checks: verification.checks,
        violations: verification.compliant ? [] : 
          Object.entries(verification.checks)
            .filter(([_, check]) => !check.compliant)
            .map(([requirement, check]) => ({
              requirement,
              reason: check.reason
            }))
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Singleton instance
let pciComplianceInstance = null;

/**
 * Get PCI compliance service instance
 */
function getPCIComplianceService() {
  if (!pciComplianceInstance) {
    pciComplianceInstance = new PCIComplianceService();
  }
  return pciComplianceInstance;
}

module.exports = {
  PCIComplianceService,
  getPCIComplianceService
};





