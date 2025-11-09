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

    const template = await ContractTemplateService.createTemplate(req.body, userId, userName);

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
 * @route   DELETE /api/contract-templates/:templateId
 * @access  Protected - Admin, Manager
 */
const deleteContractTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { permanent = false } = req.query;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const result = await ContractTemplateService.deleteTemplate(
      templateId,
      userId,
      userName,
      permanent === 'true'
    );

    res.json({
      success: true,
      message: `Template ${permanent === 'true' ? 'permanently deleted' : 'moved to archive'} successfully`,
      data: result
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(error.message.includes('not found') ? 404 : 
               error.message.includes('being used') ? 409 : 500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * @desc    Restore deleted contract template
 * @route   POST /api/contract-templates/:templateId/restore
 * @access  Protected - Admin, Manager
 */
const restoreContractTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const restoredTemplate = await ContractTemplateService.restoreTemplate(
      templateId,
      userId,
      userName
    );

    res.json({
      success: true,
      message: 'Template restored successfully',
      data: restoredTemplate
    });
  } catch (error) {
    console.error('Error restoring template:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
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
 * @desc    Get contract by ID
 * @route   GET /api/contracts/new/:contractId
 * @access  Protected
 */
const getContractById = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await SignedContract.findById(contractId).lean();

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    res.status(200).json({
      success: true,
      data: contract
    });
  } catch (error) {
    console.error('❌ Get Contract By ID Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contract',
      message: error.message
    });
  }
};

/**
 * @desc    Create new contract
 * @route   POST /api/contracts/new
 * @access  Protected - Admin, Manager
 */
const createContract = async (req, res) => {
  try {
    const {
      templateId,
      title,
      parties,
      variableValues,
      terms,
      financialTerms
    } = req.body;

    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    // Validate required fields
    if (!templateId || !title || !parties) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: templateId, title, parties'
      });
    }

    // Get template to validate it exists
    const template = await ContractTemplate.findOne({ 
      $or: [{ id: templateId }, { _id: templateId }]
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Contract template not found'
      });
    }

    // Generate contract number
    const contractNumber = `CNT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create contract data
    const contractData = {
      contractNumber,
      title,
      templateId: template.id,
      templateRef: template._id,
      status: 'draft',
      subscriberId: userId,
      subscriberInfo: {
        fullName: parties.primary?.name || userName,
        email: parties.primary?.email || req.user.email,
        phone: parties.primary?.phone || '',
        address: parties.primary?.address || {}
      },
      signers: [],
      variableValues: variableValues || {},
      content: {
        originalTemplate: template.content?.body || '',
        processedContent: template.content?.body || '',
        variables: variableValues || {}
      },
      terms: {
        effectiveDate: terms?.effectiveDate || new Date(),
        expirationDate: terms?.expirationDate || null,
        ...terms
      },
      financialTerms: financialTerms || null,
      metadata: {
        createdBy: userId,
        createdByName: userName,
        templateVersion: template.version || '1.0.0',
        locale: template.locale || 'en-US'
      },
      events: [{
        type: 'contract_created',
        timestamp: new Date(),
        performedBy: userId,
        performedByName: userName,
        details: { title, templateId }
      }]
    };

    // Add signers from parties
    if (parties.primary?.signatureRequired !== false) {
      contractData.signers.push({
        signerId: parties.primary.userId || `primary_${Date.now()}`,
        type: 'primary',
        fullName: parties.primary.name,
        email: parties.primary.email,
        phone: parties.primary.phone || '',
        address: parties.primary.address || {},
        role: 'Primary Party',
        signatureRequired: true,
        status: 'pending',
        order: 1
      });
    }

    if (parties.secondary?.signatureRequired !== false) {
      contractData.signers.push({
        signerId: parties.secondary.userId || `secondary_${Date.now()}`,
        type: 'secondary',
        fullName: parties.secondary.name,
        email: parties.secondary.email,
        phone: parties.secondary.phone || '',
        address: parties.secondary.address || {},
        role: 'Secondary Party',
        signatureRequired: true,
        status: 'pending',
        order: 2
      });
    }

    // Add additional signers
    if (parties.additional && Array.isArray(parties.additional)) {
      parties.additional.forEach((party, index) => {
        if (party.signatureRequired !== false) {
          contractData.signers.push({
            signerId: party.userId || `additional_${index}_${Date.now()}`,
            type: 'additional',
            fullName: party.name,
            email: party.email,
            phone: party.phone || '',
            role: party.role || `Additional Party ${index + 1}`,
            signatureRequired: true,
            status: 'pending',
            order: index + 3
          });
        }
      });
    }

    const contract = new SignedContract(contractData);
    await contract.save();

    res.status(201).json({
      success: true,
      message: 'Contract created successfully',
      data: contract
    });
  } catch (error) {
    console.error('❌ Create Contract Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create contract',
      message: error.message
    });
  }
};

/**
 * @desc    Update contract
 * @route   PUT /api/contracts/:contractId
 * @access  Protected - Admin, Manager
 */
const updateContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check if contract can be updated (only draft and pending_review contracts)
    if (!['draft', 'pending_review'].includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: 'Contract cannot be updated in current status'
      });
    }

    // Update contract fields
    const allowedUpdates = ['title', 'variableValues', 'terms', 'financialTerms', 'status'];
    const updates = {};

    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Update metadata
    updates.updatedAt = new Date();
    updates['metadata.updatedBy'] = userId;
    updates['metadata.updatedByName'] = userName;

    // Add event
    if (!contract.events) contract.events = [];
    contract.events.push({
      type: 'contract_updated',
      timestamp: new Date(),
      performedBy: userId,
      performedByName: userName,
      details: { updates: Object.keys(updates) }
    });

    Object.assign(contract, updates);
    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Contract updated successfully',
      data: contract
    });
  } catch (error) {
    console.error('❌ Update Contract Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contract',
      message: error.message
    });
  }
};

/**
 * @desc    Delete contract
 * @route   DELETE /api/contracts/:contractId
 * @access  Protected - Admin, Manager
 */
const deleteContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { permanent = false } = req.query;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check if contract can be deleted
    if (['fully_signed', 'completed', 'executed'].includes(contract.status) && permanent === 'true') {
      return res.status(409).json({
        success: false,
        message: 'Cannot permanently delete signed or executed contracts'
      });
    }

    if (permanent === 'true') {
      // Permanent deletion
      await SignedContract.findByIdAndDelete(contractId);
      
      res.status(200).json({
        success: true,
        message: 'Contract permanently deleted',
        data: { deleted: true, permanent: true }
      });
    } else {
      // Soft delete - mark as cancelled
      contract.status = 'cancelled';
      contract.metadata.deletedBy = userId;
      contract.metadata.deletedByName = userName;
      contract.metadata.deletedAt = new Date();

      // Add deletion event
      if (!contract.events) contract.events = [];
      contract.events.push({
        type: 'contract_deleted',
        timestamp: new Date(),
        performedBy: userId,
        performedByName: userName,
        details: { reason: 'User requested deletion', permanent: false }
      });

      await contract.save();

      res.status(200).json({
        success: true,
        message: 'Contract moved to cancelled status',
        data: { deleted: true, permanent: false, contract }
      });
    }
  } catch (error) {
    console.error('❌ Delete Contract Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contract',
      message: error.message
    });
  }
};

/**
 * @desc    Cancel contract
 * @route   POST /api/contracts/:contractId/cancel
 * @access  Protected - Admin, Manager
 */
const cancelContract = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required'
      });
    }

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check if contract can be cancelled
    if (['completed', 'cancelled', 'voided'].includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: 'Contract cannot be cancelled in current status'
      });
    }

    // Update contract status
    contract.status = 'cancelled';
    contract.cancellation = {
      reason: reason.trim(),
      cancelledBy: userId,
      cancelledByName: userName,
      cancelledAt: new Date()
    };

    // Add cancellation event
    if (!contract.events) contract.events = [];
    contract.events.push({
      type: 'contract_cancelled',
      timestamp: new Date(),
      performedBy: userId,
      performedByName: userName,
      details: { reason: reason.trim() }
    });

    await contract.save();

    res.status(200).json({
      success: true,
      message: 'Contract cancelled successfully',
      data: contract
    });
  } catch (error) {
    console.error('❌ Cancel Contract Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel contract',
      message: error.message
    });
  }
};

/**
 * @desc    Send contract for signature
 * @route   POST /api/contracts/:contractId/send-for-signature
 * @access  Protected - Admin, Manager
 */
const sendForSignature = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { recipients } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Check if contract can be sent for signature
    if (!['draft', 'pending_review', 'approved'].includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: 'Contract cannot be sent for signature in current status'
      });
    }

    // Update contract status
    contract.status = 'sent_for_signature';
    contract.signatureFlow = {
      startedAt: new Date(),
      startedBy: userId,
      startedByName: userName,
      emailsSent: contract.signers.filter(s => s.email).length,
      recipients: recipients || []
    };

    // Add signature sending event
    if (!contract.events) contract.events = [];
    contract.events.push({
      type: 'signature_request_sent',
      timestamp: new Date(),
      performedBy: userId,
      performedByName: userName,
      details: { 
        recipientCount: contract.signers.length,
        recipients: contract.signers.map(s => ({ name: s.fullName, email: s.email }))
      }
    });

    await contract.save();

    res.status(200).json({
      success: true,
      message: `Contract sent for signature to ${contract.signers.length} recipients`,
      data: contract
    });
  } catch (error) {
    console.error('❌ Send For Signature Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send for signature',
      message: error.message
    });
  }
};

/**
 * @desc    Get signature status
 * @route   GET /api/contracts/:contractId/signature-status
 * @access  Protected
 */
const getSignatureStatus = async (req, res) => {
  try {
    const { contractId } = req.params;

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    const signers = contract.signers || [];
    const totalRequired = signers.filter(s => s.signatureRequired).length;
    const totalSigned = signers.filter(s => s.status === 'signed').length;
    const percentage = totalRequired > 0 ? Math.round((totalSigned / totalRequired) * 100) : 0;
    const isFullySigned = totalRequired > 0 && totalSigned === totalRequired;

    const pendingParties = signers
      .filter(s => s.signatureRequired && s.status !== 'signed')
      .map(s => ({
        partyType: s.type,
        partyIndex: s.order || 0,
        partyName: s.fullName,
        partyEmail: s.email
      }));

    const signedParties = signers
      .filter(s => s.status === 'signed')
      .map(s => ({
        partyType: s.type,
        partyIndex: s.order || 0,
        partyName: s.fullName,
        signedAt: s.signedAt || new Date().toISOString(),
        signedBy: s.fullName
      }));

    res.status(200).json({
      success: true,
      data: {
        totalRequired,
        totalSigned,
        percentage,
        isFullySigned,
        pendingParties,
        signedParties,
        contractStatus: contract.status
      }
    });
  } catch (error) {
    console.error('❌ Get Signature Status Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get signature status',
      message: error.message
    });
  }
};

/**
 * @desc    Send signature reminder
 * @route   POST /api/contracts/:contractId/signature-reminder
 * @access  Protected - Admin, Manager
 */
const sendSignatureReminder = async (req, res) => {
  try {
    const { contractId } = req.params;
    const { partyType, partyIndex } = req.body;
    const userId = req.user.id;
    const userName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

    const contract = await SignedContract.findById(contractId);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }

    // Find the specific signer
    const signer = contract.signers.find(s => 
      s.type === partyType && (partyIndex === undefined || s.order === partyIndex)
    );

    if (!signer) {
      return res.status(404).json({
        success: false,
        message: 'Signer not found'
      });
    }

    if (signer.status === 'signed') {
      return res.status(400).json({
        success: false,
        message: 'Signer has already signed the contract'
      });
    }

    // Add reminder event
    if (!contract.events) contract.events = [];
    contract.events.push({
      type: 'signature_reminder_sent',
      timestamp: new Date(),
      performedBy: userId,
      performedByName: userName,
      details: { 
        recipientName: signer.fullName,
        recipientEmail: signer.email,
        partyType,
        partyIndex
      }
    });

    // Update last reminder timestamp
    signer.lastReminderSent = new Date();

    await contract.save();

    res.status(200).json({
      success: true,
      message: `Reminder sent to ${signer.fullName}`,
      data: { 
        sent: true,
        recipient: {
          name: signer.fullName,
          email: signer.email,
          type: partyType
        }
      }
    });
  } catch (error) {
    console.error('❌ Send Signature Reminder Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send reminder',
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
  deleteContractTemplate,
  restoreContractTemplate,
  createTemplateVersion,
  approveTemplate,
  publishTemplate,
  getTemplateStatistics,
  cloneTemplate,

  // Contract Management
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  cancelContract,
  sendForSignature,
  getSignatureStatus,
  sendSignatureReminder,

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





