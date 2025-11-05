const { SignedContract } = require('../models/contract.model');
const ContractTemplateService = require('./contractTemplate.service');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

/**
 * Contract Signing Service
 * Handles the complete e-signature process with evidence collection
 */
class ContractSigningService {

  /**
   * Initiate contract signing process
   */
  static async initiateContract(contractData, userId) {
    try {
      const {
        templateId,
        subscriberId,
        subscriptionId,
        planId,
        language = 'en',
        currency = 'USD',
        placeholderValues = {},
        signers = [],
        expirationDays,
        metadata = {}
      } = contractData;

      // Get and render template
      const renderedTemplate = await ContractTemplateService.renderTemplate(
        templateId, 
        placeholderValues, 
        language
      );

      // Generate unique contract ID
      const contractId = `contract_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Calculate expiration date
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 
        (expirationDays || renderedTemplate.template.config.expirationDays || 30));

      // Generate document hash
      const documentHash = crypto
        .createHash('sha256')
        .update(renderedTemplate.renderedContent.body)
        .digest('hex');

      // Create signed contract
      const signedContract = new SignedContract({
        id: contractId,
        templateId,
        templateVersion: renderedTemplate.template.version,
        subscriberId,
        subscriptionId,
        planId,
        title: renderedTemplate.renderedContent.title,
        language,
        currency,
        content: {
          originalHtml: renderedTemplate.renderedContent.body,
          placeholderValues: new Map(Object.entries(placeholderValues))
        },
        signers: signers.map(signer => ({
          signerId: signer.id || `signer_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          signerType: signer.type || 'subscriber',
          fullName: signer.fullName,
          email: signer.email,
          phone: signer.phone,
          title: signer.title,
          company: signer.company,
          status: 'pending'
        })),
        dates: {
          created: new Date(),
          expires: expirationDate
        },
        security: {
          originalHash: documentHash,
          hashAlgorithm: 'SHA-256',
          encrypted: false,
          maxViews: renderedTemplate.template.config.signingRequirements.maxViews || 10,
          currentViews: 0
        },
        compliance: {
          jurisdiction: renderedTemplate.template.config.legal.jurisdiction,
          governingLaw: renderedTemplate.template.config.legal.governingLaw,
          gdprCompliant: true,
          retentionPeriod: 7, // 7 years default
          evidencePackage: {}
        },
        workflow: {
          currentStep: 0,
          steps: [
            {
              stepId: 'send_contract',
              name: 'Send Contract',
              status: 'pending',
              assignedTo: userId
            },
            {
              stepId: 'collect_signatures',
              name: 'Collect Signatures',
              status: 'pending'
            },
            {
              stepId: 'complete_contract',
              name: 'Complete Contract',
              status: 'pending'
            }
          ]
        },
        metadata: {
          source: 'api',
          ...metadata
        }
      });

      await signedContract.save();

      return {
        contract: signedContract,
        signingUrls: this.generateSigningUrls(signedContract),
        renderedContent: renderedTemplate.renderedContent
      };
    } catch (error) {
      throw new Error(`Failed to initiate contract: ${error.message}`);
    }
  }

  /**
   * Generate signing URLs for signers
   */
  static generateSigningUrls(contract) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    return contract.signers.map(signer => {
      const token = crypto.randomBytes(32).toString('hex');
      
      return {
        signerId: signer.signerId,
        email: signer.email,
        signingUrl: `${baseUrl}/sign/${contract.id}?token=${token}&signer=${signer.signerId}`,
        token,
        expires: contract.dates.expires
      };
    });
  }

  /**
   * Start signing session with evidence collection
   */
  static async startSigningSession(contractId, signerId, requestData) {
    try {
      const { ip, userAgent, headers = {} } = requestData;

      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      if (contract.isExpired()) {
        throw new Error('Contract has expired');
      }

      const signer = contract.signers.find(s => s.signerId === signerId);
      if (!signer) {
        throw new Error('Signer not found');
      }

      if (signer.status === 'signed') {
        throw new Error('Contract already signed by this signer');
      }

      // Increment view count
      contract.security.currentViews++;
      if (contract.security.currentViews > contract.security.maxViews) {
        throw new Error('Maximum view limit exceeded');
      }

      // Parse user agent
      const parser = new UAParser(userAgent);
      const device = parser.getResult();

      // Get geolocation (if legal basis exists)
      let location = null;
      if (ip && !this.isPrivateIP(ip)) {
        const geo = geoip.lookup(ip);
        if (geo) {
          location = {
            country: geo.country,
            region: geo.region,
            city: geo.city,
            timezone: geo.timezone,
            latitude: geo.ll[0],
            longitude: geo.ll[1],
            accuracy: 10000, // City-level accuracy
            legalBasis: 'legitimate_interest', // Can be updated based on consent
            consentGiven: false
          };
        }
      }

      // Initialize evidence collection
      signer.evidence = {
        ipAddress: ip,
        userAgent,
        deviceFingerprint: this.generateDeviceFingerprint(headers),
        location,
        device: {
          type: device.device.type || 'desktop',
          os: `${device.os.name} ${device.os.version}`,
          browser: `${device.browser.name} ${device.browser.version}`,
          screenResolution: headers['screen-resolution'],
          colorDepth: parseInt(headers['color-depth']) || null,
          touchSupport: headers['touch-support'] === 'true'
        },
        sessionId: crypto.randomBytes(16).toString('hex'),
        sessionDuration: 0,
        pageViews: 1,
        documentHash: contract.security.originalHash,
        documentVersion: contract.templateVersion,
        termsVersion: contract.compliance.termsVersion,
        privacyVersion: contract.compliance.privacyVersion,
        accessLog: [{
          action: 'session_started',
          timestamp: new Date(),
          ipAddress: ip,
          userAgent
        }]
      };

      // Update timestamps
      if (!signer.sentAt) signer.sentAt = new Date();
      if (!signer.openedAt) signer.openedAt = new Date();
      if (!contract.dates.firstOpened) contract.dates.firstOpened = new Date();
      
      contract.dates.lastActivity = new Date();
      signer.status = 'opened';

      await contract.save();

      return {
        sessionId: signer.evidence.sessionId,
        contract: {
          id: contract.id,
          title: contract.title,
          content: contract.content.originalHtml,
          signingRequirements: await this.getSigningRequirements(contract.templateId),
          expiresAt: contract.dates.expires
        },
        signer: {
          id: signer.signerId,
          name: signer.fullName,
          email: signer.email,
          status: signer.status
        }
      };
    } catch (error) {
      throw new Error(`Failed to start signing session: ${error.message}`);
    }
  }

  /**
   * Collect additional evidence during signing
   */
  static async collectEvidence(contractId, signerId, evidenceData) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const signer = contract.signers.find(s => s.signerId === signerId);
      if (!signer || !signer.evidence) {
        throw new Error('Signing session not found');
      }

      const {
        mouseMovements = [],
        keystrokePattern = [],
        scrollDepth,
        timeOnPage,
        geolocationConsent,
        biometricData = {}
      } = evidenceData;

      // Update evidence
      if (mouseMovements.length > 0) {
        signer.evidence.mouseMovements = [
          ...(signer.evidence.mouseMovements || []),
          ...mouseMovements
        ];
      }

      if (keystrokePattern.length > 0) {
        signer.evidence.keystrokePattern = [
          ...(signer.evidence.keystrokePattern || []),
          ...keystrokePattern
        ];
      }

      if (scrollDepth !== undefined) {
        contract.analytics.engagement.scrollDepth = Math.max(
          contract.analytics.engagement.scrollDepth || 0,
          scrollDepth
        );
      }

      if (timeOnPage !== undefined) {
        contract.analytics.engagement.timeOnPage = timeOnPage;
        signer.evidence.sessionDuration = timeOnPage;
      }

      // Update geolocation consent
      if (geolocationConsent !== undefined && signer.evidence.location) {
        signer.evidence.location.consentGiven = geolocationConsent;
        signer.evidence.location.legalBasis = geolocationConsent ? 'consent' : 'legitimate_interest';
      }

      // Store biometric data if provided
      if (Object.keys(biometricData).length > 0) {
        signer.verification.biometric = {
          ...signer.verification.biometric,
          ...biometricData
        };
      }

      // Add to access log
      signer.evidence.accessLog.push({
        action: 'evidence_collected',
        timestamp: new Date(),
        ipAddress: signer.evidence.ipAddress,
        userAgent: signer.evidence.userAgent,
        data: {
          mouseMovements: mouseMovements.length,
          keystrokePattern: keystrokePattern.length,
          scrollDepth,
          timeOnPage
        }
      });

      contract.dates.lastActivity = new Date();
      await contract.save();

      return { success: true, evidenceCollected: true };
    } catch (error) {
      throw new Error(`Failed to collect evidence: ${error.message}`);
    }
  }

  /**
   * Process signature submission
   */
  static async processSignature(contractId, signerId, signatureData) {
    try {
      const {
        signature,
        consents = [],
        identityVerification = {},
        metadata = {}
      } = signatureData;

      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const signer = contract.signers.find(s => s.signerId === signerId);
      if (!signer) {
        throw new Error('Signer not found');
      }

      if (signer.status === 'signed') {
        throw new Error('Contract already signed by this signer');
      }

      // Get signing requirements
      const requirements = await this.getSigningRequirements(contract.templateId);

      // Validate signature
      if (!signature || !signature.data) {
        throw new Error('Signature is required');
      }

      // Validate required consents
      const requiredConsents = requirements.requiredConsents.filter(c => c.required);
      for (const requiredConsent of requiredConsents) {
        const consent = consents.find(c => c.consentId === requiredConsent.id);
        if (!consent || !consent.accepted) {
          throw new Error(`Consent required: ${requiredConsent.label}`);
        }
      }

      // Store signature
      signer.signature = {
        type: signature.type,
        data: signature.data,
        coordinates: signature.coordinates || [],
        cryptographic: signature.cryptographic || null
      };

      // Store consents
      signer.consents = consents.map(consent => ({
        consentId: consent.consentId,
        label: consent.label,
        accepted: consent.accepted,
        timestamp: new Date()
      }));

      // Store identity verification if provided
      if (identityVerification.idDocument) {
        signer.verification.idDocument = identityVerification.idDocument;
      }
      if (identityVerification.selfie) {
        signer.verification.selfie = identityVerification.selfie;
      }

      // Complete signing for this signer
      const completedSigner = contract.completeSigning(signerId, {
        signature: signer.signature,
        consents: signer.consents
      });

      // Add completion to access log
      signer.evidence.accessLog.push({
        action: 'signature_completed',
        timestamp: new Date(),
        ipAddress: signer.evidence.ipAddress,
        userAgent: signer.evidence.userAgent,
        metadata
      });

      await contract.save();

      // Generate certificate if all signers have signed
      let certificateData = null;
      if (contract.status === 'fully_signed') {
        certificateData = await this.generateCertificateOfCompletion(contract);
      }

      return {
        success: true,
        signer: completedSigner,
        contract: {
          id: contract.id,
          status: contract.status,
          signingProgress: contract.getSigningProgress()
        },
        certificate: certificateData
      };
    } catch (error) {
      throw new Error(`Failed to process signature: ${error.message}`);
    }
  }

  /**
   * Generate Certificate of Completion
   */
  static async generateCertificateOfCompletion(contract) {
    try {
      const certificateId = `cert_${contract.id}_${Date.now()}`;
      
      const certificateData = {
        certificateId,
        contractId: contract.id,
        templateId: contract.templateId,
        templateVersion: contract.templateVersion,
        
        // Contract Information
        title: contract.title,
        completedAt: contract.dates.completed,
        
        // Signers Summary
        signers: contract.signers.map(signer => ({
          name: signer.fullName,
          email: signer.email,
          role: signer.title || 'Signatory',
          signedAt: signer.signedAt,
          ipAddress: signer.evidence.ipAddress,
          location: signer.evidence.location?.city,
          device: signer.evidence.device?.type
        })),
        
        // Security Information
        documentHash: contract.security.originalHash,
        finalHash: contract.security.finalHash,
        hashAlgorithm: contract.security.hashAlgorithm,
        
        // Compliance
        jurisdiction: contract.compliance.jurisdiction,
        governingLaw: contract.compliance.governingLaw,
        
        // Certificate Metadata
        generatedAt: new Date(),
        generatedBy: 'Eagle Contract System',
        version: '1.0',
        
        // Verification URL
        verificationUrl: `${process.env.FRONTEND_URL}/verify-certificate/${certificateId}`
      };

      // Generate certificate hash for integrity
      const certificateHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(certificateData))
        .digest('hex');

      certificateData.certificateHash = certificateHash;

      // Store certificate reference in contract
      contract.compliance.evidencePackage.certificateUrl = 
        `/api/contracts/${contract.id}/certificate/${certificateId}`;

      await contract.save();

      return certificateData;
    } catch (error) {
      throw new Error(`Failed to generate certificate: ${error.message}`);
    }
  }

  /**
   * Get signing requirements for template
   */
  static async getSigningRequirements(templateId) {
    try {
      const template = await ContractTemplateService.getTemplate(templateId);
      return template.config.signingRequirements;
    } catch (error) {
      throw new Error(`Failed to get signing requirements: ${error.message}`);
    }
  }

  /**
   * Generate device fingerprint
   */
  static generateDeviceFingerprint(headers) {
    const fingerprint = {
      userAgent: headers['user-agent'],
      acceptLanguage: headers['accept-language'],
      acceptEncoding: headers['accept-encoding'],
      acceptCharset: headers['accept-charset'],
      platform: headers['sec-ch-ua-platform'],
      mobile: headers['sec-ch-ua-mobile'],
      screenResolution: headers['screen-resolution'],
      timezone: headers['timezone'],
      colorDepth: headers['color-depth'],
      pixelRatio: headers['pixel-ratio']
    };

    return crypto
      .createHash('md5')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
  }

  /**
   * Check if IP is private
   */
  static isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  /**
   * Void contract
   */
  static async voidContract(contractId, reason, voidedBy, voidedByName) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      contract.voidContract(reason, voidedBy, voidedByName);
      await contract.save();

      return contract;
    } catch (error) {
      throw new Error(`Failed to void contract: ${error.message}`);
    }
  }

  /**
   * Resend contract to signer
   */
  static async resendContract(contractId, signerId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const signer = contract.signers.find(s => s.signerId === signerId);
      if (!signer) {
        throw new Error('Signer not found');
      }

      if (signer.status === 'signed') {
        throw new Error('Contract already signed by this signer');
      }

      // Update sent timestamp
      signer.sentAt = new Date();
      contract.dates.lastActivity = new Date();

      await contract.save();

      // Generate new signing URL
      const signingUrls = this.generateSigningUrls(contract);
      const signerUrl = signingUrls.find(url => url.signerId === signerId);

      return {
        success: true,
        signingUrl: signerUrl,
        contract: {
          id: contract.id,
          title: contract.title,
          expires: contract.dates.expires
        }
      };
    } catch (error) {
      throw new Error(`Failed to resend contract: ${error.message}`);
    }
  }

  /**
   * Get contract audit trail
   */
  static async getContractAuditTrail(contractId) {
    try {
      const contract = await SignedContract.findOne({ id: contractId });
      if (!contract) {
        throw new Error('Contract not found');
      }

      const auditTrail = [];

      // Contract events
      auditTrail.push({
        event: 'contract_created',
        timestamp: contract.dates.created,
        actor: 'system',
        details: { templateId: contract.templateId, templateVersion: contract.templateVersion }
      });

      if (contract.dates.sent) {
        auditTrail.push({
          event: 'contract_sent',
          timestamp: contract.dates.sent,
          actor: 'system',
          details: { signerCount: contract.signers.length }
        });
      }

      if (contract.dates.firstOpened) {
        auditTrail.push({
          event: 'first_opened',
          timestamp: contract.dates.firstOpened,
          actor: 'signer',
          details: {}
        });
      }

      // Signer events
      contract.signers.forEach(signer => {
        // Add all access log events
        signer.evidence?.accessLog?.forEach(logEntry => {
          auditTrail.push({
            event: logEntry.action,
            timestamp: logEntry.timestamp,
            actor: signer.fullName,
            actorEmail: signer.email,
            details: {
              signerId: signer.signerId,
              ipAddress: logEntry.ipAddress,
              userAgent: logEntry.userAgent,
              ...logEntry.data
            }
          });
        });

        if (signer.signedAt) {
          auditTrail.push({
            event: 'signature_completed',
            timestamp: signer.signedAt,
            actor: signer.fullName,
            actorEmail: signer.email,
            details: {
              signerId: signer.signerId,
              signatureType: signer.signature?.type,
              consentsCount: signer.consents?.length || 0
            }
          });
        }
      });

      if (contract.dates.completed) {
        auditTrail.push({
          event: 'contract_completed',
          timestamp: contract.dates.completed,
          actor: 'system',
          details: { finalHash: contract.security.finalHash }
        });
      }

      if (contract.dates.voided) {
        auditTrail.push({
          event: 'contract_voided',
          timestamp: contract.dates.voided,
          actor: contract.metadata.voidedByName || 'system',
          details: { reason: contract.metadata.voidReason }
        });
      }

      // Sort by timestamp
      auditTrail.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      return auditTrail;
    } catch (error) {
      throw new Error(`Failed to get audit trail: ${error.message}`);
    }
  }
}

module.exports = ContractSigningService;





