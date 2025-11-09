const { ContractTemplate, SignedContract } = require('../models/contract.model');
const ContractTemplateService = require('../services/contractTemplate.service');
const ContractSigningService = require('../services/contractSigning.service');
const ContractIntegrationService = require('../services/contractIntegration.service');
const EvidenceComplianceService = require('../services/evidenceCompliance.service');

/**
 * Enhanced Contract Controller
 * Provides comprehensive e-signature and contract management capabilities
 */

// =============================================================================
// TEMPLATE MANAGEMENT
// =============================================================================

/**
 * @desc    Get all contract templates
 * @route   GET /api/contracts/templates
 * @access  Protected
 */
const getContractTemplates = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      isActive,
      applicablePlans,
      applicableRegions,
      language,
      search,
      sortBy = 'audit.lastModifiedAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    if (applicablePlans) filters.applicablePlans = applicablePlans.split(',');
    if (applicableRegions) filters.applicableRegions = applicableRegions.split(',');
    if (language) filters.language = language;
    if (search) filters.search = search;

    const options = { page: parseInt(page), limit: parseInt(limit), sortBy, sortOrder };

    const result = await ContractTemplateService.getTemplates(filters, options);

    res.json({
      success: true,
      data: result.templates,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching contract templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contract templates',
      error: error.message
    });
  }
};

/**
 * @desc    Get contract template by ID
 * @route   GET /api/contracts/templates/:templateId
 * @access  Protected
 */
const getContractTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { language = 'en', includeInactive = false } = req.query;

    const template = await ContractTemplateService.getTemplate(
      templateId,
      language,
      includeInactive === 'true'
    );

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching contract template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Create new contract template
 * @route   POST /api/contracts/templates
 * @access  Protected
 */
const createContractTemplate = async (req, res) => {
  try {
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    // Debug: Log received request body
    console.log('🎯 [Controller] Received template data:', {
      name: req.body.name,
      category: req.body.category,
      status: req.body.status,
      locale: req.body.locale,
      contentBodyLength: req.body.content?.body?.length,
      contentHtmlLength: req.body.content?.htmlBody?.length,
      variablesCount: req.body.content?.variables?.length,
      hasMetadata: !!req.body.metadata,
      hasLegal: !!req.body.legal,
    });
    console.log('📄 [Controller] Full content object:', JSON.stringify(req.body.content, null, 2));

    const template = await ContractTemplateService.createTemplate(req.body, userId, userName);

    // Debug: Log created template
    console.log('✅ [Controller] Template created:', {
      id: template.id,
      name: template.name,
      contentBodyLength: template.content?.body?.length,
      contentHtmlLength: template.content?.htmlBody?.length,
      variablesCount: template.content?.variables?.length,
    });
    console.log('📄 [Controller] Created template content:', JSON.stringify(template.content, null, 2));

    res.status(201).json({
      success: true,
      message: 'Contract template created successfully',
      data: template
    });
  } catch (error) {
    console.error('Error creating contract template:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Update contract template
 * @route   PUT /api/contracts/templates/:templateId
 * @access  Protected
 */
const updateContractTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    const template = await ContractTemplateService.updateTemplate(
      templateId,
      req.body,
      userId,
      userName
    );

    res.json({
      success: true,
      message: 'Contract template updated successfully',
      data: template
    });
  } catch (error) {
    console.error('Error updating contract template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Create new version of contract template
 * @route   POST /api/contracts/templates/:templateId/versions
 * @access  Protected
 */
const createTemplateVersion = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    const newTemplate = await ContractTemplateService.createNewVersion(
      templateId,
      req.body,
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      message: 'New template version created successfully',
      data: newTemplate
    });
  } catch (error) {
    console.error('Error creating template version:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Approve contract template
 * @route   POST /api/contracts/templates/:templateId/approve
 * @access  Protected
 */
const approveTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    const template = await ContractTemplateService.approveTemplate(templateId, userId, userName);

    res.json({
      success: true,
      message: 'Template approved successfully',
      data: template
    });
  } catch (error) {
    console.error('Error approving template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Publish contract template
 * @route   POST /api/contracts/templates/:templateId/publish
 * @access  Protected
 */
const publishTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    const template = await ContractTemplateService.publishTemplate(templateId, userId, userName);

    res.json({
      success: true,
      message: 'Template published successfully',
      data: template
    });
  } catch (error) {
    console.error('Error publishing template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get template statistics
 * @route   GET /api/contracts/templates/:templateId/statistics
 * @access  Protected
 */
const getTemplateStatistics = async (req, res) => {
  try {
    const { templateId } = req.params;

    const statistics = await ContractTemplateService.getTemplateStatistics(templateId);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error fetching template statistics:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Clone contract template
 * @route   POST /api/contracts/templates/:templateId/clone
 * @access  Protected
 */
const cloneTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { newName } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    if (!newName) {
      return res.status(400).json({
        success: false,
        message: 'New template name is required'
      });
    }

    const clonedTemplate = await ContractTemplateService.cloneTemplate(
      templateId,
      newName,
      userId,
      userName
    );

    res.status(201).json({
      success: true,
      message: 'Template cloned successfully',
      data: clonedTemplate
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Delete contract template
 * @route   DELETE /api/contracts/templates/:templateId
 * @access  Protected
 */
const deleteTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    const template = await ContractTemplateService.deleteTemplate(
      templateId,
      userId,
      userName
    );

    res.json({
      success: true,
      message: 'Template deleted successfully',
      data: template
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    const statusCode = error.message.includes('not found')
      ? 404
      : error.message.includes('being used')
        ? 400
        : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
};

// =============================================================================
// CONTRACT SIGNING WORKFLOW
// =============================================================================

/**
 * @desc    Initiate contract signing process
 * @route   POST /api/contracts/initiate
 * @access  Protected
 */
const initiateContractSigning = async (req, res) => {
  try {
    const userId = req.user.id;
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
      metadata = {},
      integrationProvider = 'native',
      integrationConfig = {}
    } = req.body;

    // Validate required fields
    if (!templateId || !subscriberId || !signers.length) {
      return res.status(400).json({
        success: false,
        message: 'Template ID, subscriber ID, and signers are required'
      });
    }

    // Initiate contract with native system
    const contractResult = await ContractSigningService.initiateContract({
      templateId,
      subscriberId,
      subscriptionId,
      planId,
      language,
      currency,
      placeholderValues,
      signers,
      expirationDays,
      metadata
    }, userId);

    let finalResult = contractResult;

    // If using third-party integration, send via external provider
    if (integrationProvider !== 'native') {
      try {
        const integrationResult = await ContractIntegrationService.sendContract(
          contractResult.contract.id,
          integrationProvider,
          integrationConfig
        );

        finalResult = {
          ...contractResult,
          integration: integrationResult.providerResponse
        };
      } catch (integrationError) {
        console.error('Integration failed, falling back to native:', integrationError);
        // Continue with native signing if integration fails
      }
    }

    res.status(201).json({
      success: true,
      message: 'Contract initiated successfully',
      data: finalResult
    });
  } catch (error) {
    console.error('Error initiating contract:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Start signing session
 * @route   POST /api/contracts/:contractId/sign-session
 * @access  Public
 */
const startSigningSession = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signerId, token } = req.body;

    // Collect request evidence
    const requestData = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      headers: {
        'accept-language': req.get('Accept-Language'),
        'accept-encoding': req.get('Accept-Encoding'),
        'screen-resolution': req.get('X-Screen-Resolution'),
        'color-depth': req.get('X-Color-Depth'),
        'timezone': req.get('X-Timezone'),
        'pixel-ratio': req.get('X-Pixel-Ratio'),
        'touch-support': req.get('X-Touch-Support')
      }
    };

    const sessionData = await ContractSigningService.startSigningSession(
      contractId,
      signerId,
      requestData
    );

    res.json({
      success: true,
      data: sessionData
    });
  } catch (error) {
    console.error('Error starting signing session:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Collect evidence during signing
 * @route   POST /api/contracts/:contractId/evidence
 * @access  Public
 */
const collectSigningEvidence = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signerId } = req.body;

    const result = await ContractSigningService.collectEvidence(
      contractId,
      signerId,
      req.body
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error collecting evidence:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Submit signature
 * @route   POST /api/contracts/:contractId/signatures
 * @access  Public
 */
const submitSignature = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signerId, signature, consents = [], identityVerification = {}, metadata = {} } = req.body;

    if (!signerId || !signature) {
      return res.status(400).json({
        success: false,
        message: 'Signer ID and signature are required'
      });
    }

    const result = await ContractSigningService.processSignature(contractId, signerId, {
      signature,
      consents,
      identityVerification,
      metadata
    });

    res.json({
      success: true,
      message: 'Signature submitted successfully',
      data: result
    });
  } catch (error) {
    console.error('Error submitting signature:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get contract for signing
 * @route   GET /api/contracts/:contractId/sign
 * @access  Public
 */
const getContractForSigning = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signerId, token } = req.query;

    const contract = await SignedContract.findOne({ id: contractId });
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    if (contract.isExpired()) {
      return res.status(400).json({
        success: false,
        message: 'Contract has expired'
      });
    }

    const signer = contract.signers.find(s => s.signerId === signerId);
    if (!signer) {
      return res.status(404).json({
        success: false,
        message: 'Signer not found'
      });
    }

    // Get signing requirements
    const signingRequirements = await ContractSigningService.getSigningRequirements(
      contract.templateId
    );

    res.json({
      success: true,
      data: {
        contract: {
          id: contract.id,
          title: contract.title,
          content: contract.content.originalHtml,
          language: contract.language,
          expiresAt: contract.dates.expires,
          status: contract.status
        },
        signer: {
          id: signer.signerId,
          name: signer.fullName,
          email: signer.email,
          status: signer.status
        },
        signingRequirements,
        progress: contract.getSigningProgress()
      }
    });
  } catch (error) {
    console.error('Error getting contract for signing:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// =============================================================================
// EVIDENCE & COMPLIANCE
// =============================================================================

/**
 * @desc    Generate evidence package
 * @route   POST /api/contracts/:contractId/evidence-package
 * @access  Protected
 */
const generateEvidencePackage = async (req, res) => {
  try {
    const { contractId } = req.params;

    const evidencePackage = await EvidenceComplianceService.generateEvidencePackage(contractId);

    res.json({
      success: true,
      message: 'Evidence package generated successfully',
      data: evidencePackage
    });
  } catch (error) {
    console.error('Error generating evidence package:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Download evidence package
 * @route   GET /api/contracts/:contractId/download-package
 * @access  Protected
 */
const downloadEvidencePackage = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { format = 'zip' } = req.query;

    const packageData = await EvidenceComplianceService.exportEvidencePackage(contractId, format);

    res.setHeader('Content-Type', packageData.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${packageData.filename}"`);
    res.send(packageData.content);
  } catch (error) {
    console.error('Error downloading evidence package:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get certificate of completion
 * @route   GET /api/contracts/:contractId/certificate
 * @access  Protected
 */
const getCertificateOfCompletion = async (req, res) => {
  try {
    const { contractId } = req.params;

    // Use Evidence Compliance Service to generate certificate
    const certificate = await EvidenceComplianceService.generateCertificate(contractId);

    res.json({
      success: true,
      message: 'Certificate generated successfully',
      data: certificate
    });
  } catch (error) {
    console.error('Error getting certificate:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Verify evidence integrity
 * @route   GET /api/contracts/:contractId/verify/:hash
 * @access  Public
 */
const verifyEvidenceIntegrity = async (req, res) => {
  try {
    const { contractId, hash } = req.params;

    const verification = await EvidenceComplianceService.verifyEvidenceIntegrity(contractId, hash);

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Error verifying evidence:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get contract audit trail
 * @route   GET /api/contracts/:contractId/audit-trail
 * @access  Protected
 */
const getContractAuditTrail = async (req, res) => {
  try {
    const { contractId } = req.params;

    const auditTrail = await ContractSigningService.getContractAuditTrail(contractId);

    res.json({
      success: true,
      data: auditTrail
    });
  } catch (error) {
    console.error('Error getting audit trail:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

// =============================================================================
// ADMIN CONTROLS
// =============================================================================

/**
 * @desc    Void contract
 * @route   POST /api/contracts/:contractId/void
 * @access  Protected
 */
const voidContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userName = req.user.name || `${req.user.firstName} ${req.user.lastName}`;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason for voiding is required'
      });
    }

    const contract = await ContractSigningService.voidContract(contractId, reason, userId, userName);

    res.json({
      success: true,
      message: 'Contract voided successfully',
      data: contract
    });
  } catch (error) {
    console.error('Error voiding contract:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Resend contract to signer
 * @route   POST /api/contracts/:contractId/resend
 * @access  Protected
 */
const resendContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { signerId } = req.body;

    if (!signerId) {
      return res.status(400).json({
        success: false,
        message: 'Signer ID is required'
      });
    }

    const result = await ContractSigningService.resendContract(contractId, signerId);

    res.json({
      success: true,
      message: 'Contract resent successfully',
      data: result
    });
  } catch (error) {
    console.error('Error resending contract:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Search contracts with advanced filters
 * @route   GET /api/contracts/search
 * @access  Protected
 */
const searchContracts = async (req, res) => {
  try {
    const {
      subscriberId,
      templateId,
      status,
      dateRange,
      signedBy,
      search,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {};
    if (subscriberId) filters.subscriberId = subscriberId;
    if (templateId) filters.templateId = templateId;
    if (status) filters.status = status.split(',');
    if (signedBy) filters.signedBy = signedBy;
    if (search) filters.search = search;

    if (dateRange) {
      try {
        const [start, end] = dateRange.split(',');
        filters.dateRange = { start, end };
      } catch (dateError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date range format. Use: start,end'
        });
      }
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    };

    const result = await SignedContract.searchContracts(filters, options);

    res.json({
      success: true,
      data: result.contracts,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error searching contracts:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get contract analytics dashboard
 * @route   GET /api/contracts/analytics/dashboard
 * @access  Protected
 */
const getContractAnalytics = async (req, res) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get analytics data
    const [
      totalContracts,
      sentContracts,
      signedContracts,
      completedContracts,
      voidedContracts,
      expiredContracts,
      templateUsage
    ] = await Promise.all([
      SignedContract.countDocuments({ 'dates.created': { $gte: startDate, $lte: endDate } }),
      SignedContract.countDocuments({
        'dates.sent': { $gte: startDate, $lte: endDate },
        status: { $in: ['sent', 'partially_signed', 'fully_signed', 'completed'] }
      }),
      SignedContract.countDocuments({
        'dates.completed': { $gte: startDate, $lte: endDate },
        status: { $in: ['fully_signed', 'completed'] }
      }),
      SignedContract.countDocuments({
        'dates.completed': { $gte: startDate, $lte: endDate },
        status: 'completed'
      }),
      SignedContract.countDocuments({
        'dates.voided': { $gte: startDate, $lte: endDate },
        status: 'voided'
      }),
      SignedContract.countDocuments({
        'dates.created': { $gte: startDate, $lte: endDate },
        status: 'expired'
      }),
      SignedContract.aggregate([
        { $match: { 'dates.created': { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$templateId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    // Calculate conversion rate
    const conversionRate = sentContracts > 0 ? Math.round((signedContracts / sentContracts) * 100) : 0;

    // Get recent activity
    const recentActivity = await SignedContract.find({
      'dates.created': { $gte: startDate, $lte: endDate }
    })
      .sort({ 'dates.created': -1 })
      .limit(10)
      .select('id title status dates.created signers.fullName')
      .lean();

    res.json({
      success: true,
      data: {
        summary: {
          totalContracts,
          sentContracts,
          signedContracts,
          completedContracts,
          voidedContracts,
          expiredContracts,
          conversionRate
        },
        templateUsage,
        recentActivity,
        timeframe,
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error getting contract analytics:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Handle third-party provider webhooks
 * @route   POST /api/contracts/webhooks/:provider
 * @access  Public
 */
const handleProviderWebhook = async (req, res) => {
  try {
    const { provider } = req.params;

    const result = await ContractIntegrationService.handleWebhook(provider, req.body);

    res.json({
      success: true,
      message: 'Webhook processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Get all contracts with pagination and filtering
 * @route   GET /api/contracts/all
 * @access  Protected (Admin/Manager)
 */
const getAllContracts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      subscriberId,
      templateId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;

    // Build query filter
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (subscriberId) {
      query.subscriberId = subscriberId;
    }

    if (templateId) {
      query.templateId = templateId;
    }

    if (search) {
      query.$or = [
        { 'subscriberInfo.fullName': { $regex: search, $options: 'i' } },
        { 'subscriberInfo.email': { $regex: search, $options: 'i' } },
        { 'signers.fullName': { $regex: search, $options: 'i' } },
        { 'signers.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute queries in parallel
    const [contracts, total] = await Promise.all([
      SignedContract.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SignedContract.countDocuments(query)
    ]);

    // Calculate statistics
    const stats = await SignedContract.aggregate([
      {
        $group: {
          _id: null,
          totalContracts: { $sum: 1 },
          draftContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          sentContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          partiallySignedContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'partially_signed'] }, 1, 0] }
          },
          fullySignedContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'fully_signed'] }, 1, 0] }
          },
          completedContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          declinedContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] }
          },
          expiredContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] }
          },
          voidedContracts: {
            $sum: { $cond: [{ $eq: ['$status', 'voided'] }, 1, 0] }
          }
        }
      }
    ]);

    const statistics = stats.length > 0 ? stats[0] : {
      totalContracts: 0,
      draftContracts: 0,
      sentContracts: 0,
      partiallySignedContracts: 0,
      fullySignedContracts: 0,
      completedContracts: 0,
      declinedContracts: 0,
      expiredContracts: 0,
      voidedContracts: 0
    };

    res.status(200).json({
      success: true,
      data: {
        contracts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1
        },
        statistics
      }
    });
  } catch (error) {
    console.error('❌ Get All Contracts Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contracts',
      message: error.message
    });
  }
};

/**
 * Get all signatures across all contracts
 * @desc Retrieve all signatures with filtering and pagination
 * @route GET /api/contracts/signatures
 * @access Private (Admin, Manager, Support)
 */
const getAllSignatures = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      contractId,
      signerEmail,
      search,
      sortBy = 'signedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Filter by contract ID
    if (contractId) {
      query._id = contractId;
    }

    // Filter by contract status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by signer email
    if (signerEmail) {
      query['signers.email'] = signerEmail;
    }

    // Search functionality
    if (search) {
      query.$or = [
        { 'signers.fullName': new RegExp(search, 'i') },
        { 'signers.email': new RegExp(search, 'i') },
        { templateId: new RegExp(search, 'i') },
        { subscriberId: new RegExp(search, 'i') }
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Fetch contracts with signatures
    const contracts = await SignedContract.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Extract all signatures from contracts
    const signatures = [];
    contracts.forEach(contract => {
      if (contract.signers && contract.signers.length > 0) {
        contract.signers.forEach(signer => {
          signatures.push({
            contractId: contract._id,
            templateId: contract.templateId,
            subscriberId: contract.subscriberId,
            contractStatus: contract.status,
            signer: {
              signerId: signer.signerId,
              fullName: signer.fullName,
              email: signer.email,
              phone: signer.phone,
              title: signer.title,
              company: signer.company,
              status: signer.status,
              signedAt: signer.signedAt,
              declinedAt: signer.declinedAt,
              signature: signer.signature,
              ipAddress: signer.ipAddress,
              device: signer.device,
              location: signer.location
            },
            createdAt: contract.createdAt,
            updatedAt: contract.updatedAt
          });
        });
      }
    });

    // Get total count for pagination
    const totalContracts = await SignedContract.countDocuments(query);

    // Calculate signature statistics
    const totalSignatures = signatures.length;
    const signedCount = signatures.filter(s => s.signer.status === 'signed').length;
    const pendingCount = signatures.filter(s => s.signer.status === 'pending').length;
    const declinedCount = signatures.filter(s => s.signer.status === 'declined').length;

    res.status(200).json({
      success: true,
      data: {
        signatures,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalContracts / parseInt(limit)),
          totalContracts,
          totalSignatures,
          limit: parseInt(limit)
        },
        statistics: {
          total: totalSignatures,
          signed: signedCount,
          pending: pendingCount,
          declined: declinedCount,
          completionRate: totalSignatures > 0 ? ((signedCount / totalSignatures) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get All Signatures Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve signatures',
      error: error.message
    });
  }
};

module.exports = {
  // Template Management
  getContractTemplates,
  getContractTemplate,
  createContractTemplate,
  updateContractTemplate,
  deleteTemplate,
  createTemplateVersion,
  approveTemplate,
  publishTemplate,
  getTemplateStatistics,
  cloneTemplate,

  // Contract Signing
  initiateContractSigning,
  startSigningSession,
  collectSigningEvidence,
  submitSignature,
  getContractForSigning,

  // Evidence & Compliance
  generateEvidencePackage,
  downloadEvidencePackage,
  getCertificateOfCompletion,
  verifyEvidenceIntegrity,
  getContractAuditTrail,

  // Admin Controls
  voidContract,
  resendContract,
  searchContracts,
  getAllContracts,
  getAllSignatures,
  getContractAnalytics,
  handleProviderWebhook
};





