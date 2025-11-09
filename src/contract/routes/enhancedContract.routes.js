const express = require('express');
const {
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
} = require('../controllers/enhancedContract.controller');

const { protect, adminOnly } = require('../../middlewares/auth.middleware');
const { authRBAC, requireRole } = require('../../middlewares/rbacAuth.middleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ContractTemplate:
 *       type: object
 *       required:
 *         - name
 *         - content
 *       properties:
 *         id:
 *           type: string
 *           description: Unique template identifier
 *         name:
 *           type: string
 *           description: Template name
 *         description:
 *           type: string
 *           description: Template description
 *         version:
 *           type: string
 *           description: Template version
 *         isActive:
 *           type: boolean
 *           description: Whether template is active
 *         content:
 *           type: object
 *           description: Multi-language template content
 *         config:
 *           type: object
 *           description: Template configuration including signing requirements
 *         
 *     SignedContract:
 *       type: object
 *       required:
 *         - templateId
 *         - subscriberId
 *         - signers
 *       properties:
 *         id:
 *           type: string
 *           description: Unique contract identifier
 *         templateId:
 *           type: string
 *           description: Template used for this contract
 *         subscriberId:
 *           type: string
 *           description: ID of the subscriber
 *         status:
 *           type: string
 *           enum: [draft, sent, partially_signed, fully_signed, completed, declined, expired, voided]
 *         signers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               signerId:
 *                 type: string
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [pending, sent, opened, signed, declined, expired]
 */

// =============================================================================
// PUBLIC ROUTES (No Authentication Required)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/sign/{contractId}:
 *   get:
 *     summary: Get contract for signing (public access)
 *     tags: [Contract Signing]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: signerId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract details for signing
 *       404:
 *         description: Contract or signer not found
 *       400:
 *         description: Contract expired or invalid
 */
router.get('/sign/:contractId', getContractForSigning);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/sign-session:
 *   post:
 *     summary: Start signing session with evidence collection
 *     tags: [Contract Signing]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerId
 *             properties:
 *               signerId:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signing session started successfully
 *       400:
 *         description: Invalid request or contract expired
 *       404:
 *         description: Contract not found
 */
router.post('/:contractId/sign-session', startSigningSession);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/evidence:
 *   post:
 *     summary: Collect evidence during signing process
 *     tags: [Contract Signing]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerId
 *             properties:
 *               signerId:
 *                 type: string
 *               mouseMovements:
 *                 type: array
 *                 items:
 *                   type: object
 *               keystrokePattern:
 *                 type: array
 *                 items:
 *                   type: number
 *               scrollDepth:
 *                 type: number
 *               timeOnPage:
 *                 type: number
 *               geolocationConsent:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Evidence collected successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Contract or signing session not found
 */
router.post('/:contractId/evidence', collectSigningEvidence);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/signatures:
 *   post:
 *     summary: Submit signature for contract
 *     tags: [Contract Signing]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerId
 *               - signature
 *             properties:
 *               signerId:
 *                 type: string
 *               signature:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [typed, drawn, uploaded]
 *                   data:
 *                     type: string
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: object
 *               consents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     consentId:
 *                       type: string
 *                     label:
 *                       type: string
 *                     accepted:
 *                       type: boolean
 *               identityVerification:
 *                 type: object
 *                 properties:
 *                   idDocument:
 *                     type: object
 *                   selfie:
 *                     type: object
 *     responses:
 *       200:
 *         description: Signature submitted successfully
 *       400:
 *         description: Invalid signature or missing required consents
 *       404:
 *         description: Contract not found
 */
router.post('/:contractId/signatures', submitSignature);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/verify/{hash}:
 *   get:
 *     summary: Verify evidence integrity (public verification)
 *     tags: [Evidence & Compliance]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: hash
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence integrity verification result
 *       404:
 *         description: Contract not found
 */
router.get('/:contractId/verify/:hash', verifyEvidenceIntegrity);

/**
 * @swagger
 * /api/contracts/enhanced/webhooks/{provider}:
 *   post:
 *     summary: Handle webhooks from third-party e-signature providers
 *     tags: [Integration]
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [docusign, adobe_sign, dropbox_sign]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Provider-specific webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       500:
 *         description: Webhook processing failed
 */
router.post('/webhooks/:provider', handleProviderWebhook);

// =============================================================================
// PROTECTED ROUTES (Authentication Required)
// =============================================================================

// Apply authentication middleware to all subsequent routes
router.use(protect);

// =============================================================================
// TEMPLATE MANAGEMENT (Admin/Manager Access)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/templates:
 *   get:
 *     summary: Get all contract templates
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of contract templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ContractTemplate'
 *                 pagination:
 *                   type: object
 */
router.get('/templates', authRBAC, requireRole(['admin', 'manager']), getContractTemplates);

/**
 * @swagger
 * /api/contracts/enhanced/templates:
 *   post:
 *     summary: Create new contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - content
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: object
 *                 properties:
 *                   languages:
 *                     type: object
 *                   defaultLanguage:
 *                     type: string
 *                     default: "en"
 *               config:
 *                 type: object
 *               placeholders:
 *                 type: array
 *                 items:
 *                   type: object
 *               styling:
 *                 type: object
 *     responses:
 *       201:
 *         description: Template created successfully
 *       400:
 *         description: Invalid template data
 */
router.post('/templates', authRBAC, requireRole(['admin', 'manager']), createContractTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}:
 *   get:
 *     summary: Get contract template by ID
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: "en"
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Contract template details
 *       404:
 *         description: Template not found
 */
router.get('/templates/:templateId', authRBAC, requireRole(['admin', 'manager', 'support']), getContractTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}:
 *   put:
 *     summary: Update contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               content:
 *                 type: object
 *               config:
 *                 type: object
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       404:
 *         description: Template not found
 */
router.put('/templates/:templateId', authRBAC, requireRole(['admin', 'manager']), updateContractTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}:
 *   delete:
 *     summary: Delete contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *       400:
 *         description: Cannot delete template that is in use
 *       404:
 *         description: Template not found
 */
router.delete('/templates/:templateId', authRBAC, requireRole(['admin', 'manager']), deleteTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}/versions:
 *   post:
 *     summary: Create new version of template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: New template version created
 *       404:
 *         description: Template not found
 */
router.post('/templates/:templateId/versions', authRBAC, requireRole(['admin', 'manager']), createTemplateVersion);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}/approve:
 *   post:
 *     summary: Approve contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template approved successfully
 *       404:
 *         description: Template not found
 */
router.post('/templates/:templateId/approve', authRBAC, requireRole(['admin']), approveTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}/publish:
 *   post:
 *     summary: Publish contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template published successfully
 *       400:
 *         description: Template must be approved before publishing
 *       404:
 *         description: Template not found
 */
router.post('/templates/:templateId/publish', authRBAC, requireRole(['admin']), publishTemplate);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}/statistics:
 *   get:
 *     summary: Get template usage statistics
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template statistics
 *       404:
 *         description: Template not found
 */
router.get('/templates/:templateId/statistics', authRBAC, requireRole(['admin', 'manager']), getTemplateStatistics);

/**
 * @swagger
 * /api/contracts/enhanced/templates/{templateId}/clone:
 *   post:
 *     summary: Clone contract template
 *     tags: [Template Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newName
 *             properties:
 *               newName:
 *                 type: string
 *     responses:
 *       201:
 *         description: Template cloned successfully
 *       400:
 *         description: New name is required
 *       404:
 *         description: Template not found
 */
router.post('/templates/:templateId/clone', authRBAC, requireRole(['admin', 'manager']), cloneTemplate);

// =============================================================================
// CONTRACT MANAGEMENT ROUTES (Admin/Manager Access)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}:
 *   get:
 *     summary: Get contract by ID
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *         description: Contract ID
 *     responses:
 *       200:
 *         description: Contract retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/contracts/:contractId', authRBAC, getContractById);

/**
 * @swagger
 * /api/contracts/enhanced/contracts:
 *   post:
 *     summary: Create new contract
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - subscriberId
 *               - title
 *             properties:
 *               templateId:
 *                 type: string
 *               subscriberId:
 *                 type: string
 *               title:
 *                 type: string
 *               signers:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Contract created successfully
 */
router.post('/contracts', authRBAC, requireRole(['admin', 'manager']), createContract);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}:
 *   put:
 *     summary: Update contract
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Contract updated successfully
 */
router.put('/contracts/:contractId', authRBAC, requireRole(['admin', 'manager']), updateContract);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}:
 *   delete:
 *     summary: Delete contract
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contract deleted successfully
 */
router.delete('/contracts/:contractId', authRBAC, requireRole(['admin', 'manager']), deleteContract);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}/cancel:
 *   post:
 *     summary: Cancel contract
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contract cancelled successfully
 */
router.post('/contracts/:contractId/cancel', authRBAC, requireRole(['admin', 'manager']), cancelContract);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}/send-for-signature:
 *   post:
 *     summary: Send contract for signature
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Contract sent for signature successfully
 */
router.post('/contracts/:contractId/send-for-signature', authRBAC, requireRole(['admin', 'manager']), sendForSignature);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}/signature-status:
 *   get:
 *     summary: Get contract signature status
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Signature status retrieved successfully
 */
router.get('/contracts/:contractId/signature-status', authRBAC, getSignatureStatus);

/**
 * @swagger
 * /api/contracts/enhanced/contracts/{contractId}/signature-reminder:
 *   post:
 *     summary: Send signature reminder
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - partyType
 *             properties:
 *               partyType:
 *                 type: string
 *               partyIndex:
 *                 type: number
 *     responses:
 *       200:
 *         description: Reminder sent successfully
 */
router.post('/contracts/:contractId/signature-reminder', authRBAC, requireRole(['admin', 'manager']), sendSignatureReminder);

// =============================================================================
// CONTRACT INITIATION & MANAGEMENT (Admin/Manager Access)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/initiate:
 *   post:
 *     summary: Initiate contract signing process
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - subscriberId
 *               - signers
 *             properties:
 *               templateId:
 *                 type: string
 *               subscriberId:
 *                 type: string
 *               subscriptionId:
 *                 type: string
 *               planId:
 *                 type: string
 *               language:
 *                 type: string
 *                 default: "en"
 *               currency:
 *                 type: string
 *                 default: "USD"
 *               placeholderValues:
 *                 type: object
 *               signers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - fullName
 *                     - email
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     title:
 *                       type: string
 *                     company:
 *                       type: string
 *               expirationDays:
 *                 type: integer
 *               integrationProvider:
 *                 type: string
 *                 enum: [native, docusign, adobe_sign, dropbox_sign]
 *                 default: "native"
 *               integrationConfig:
 *                 type: object
 *     responses:
 *       201:
 *         description: Contract initiated successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/initiate', authRBAC, requireRole(['admin', 'manager']), initiateContractSigning);

/**
 * @swagger
 * /api/contracts/enhanced/search:
 *   get:
 *     summary: Search contracts with advanced filters
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: subscriberId
 *         schema:
 *           type: string
 *       - in: query
 *         name: templateId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           description: Comma-separated list of statuses
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           description: "Format: startDate,endDate"
 *       - in: query
 *         name: signedBy
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SignedContract'
 */
router.get('/search', authRBAC, requireRole(['admin', 'manager', 'support']), searchContracts);

/**
 * @swagger
 * /api/contracts/all:
 *   get:
 *     summary: Get all contracts with pagination and filtering
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           description: Filter by status (or 'all')
 *       - in: query
 *         name: subscriberId
 *         schema:
 *           type: string
 *       - in: query
 *         name: templateId
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of all contracts with statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     contracts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SignedContract'
 *                     pagination:
 *                       type: object
 *                     statistics:
 *                       type: object
 */
router.get('/all', authRBAC, requireRole(['super_admin', 'admin', 'manager', 'support']), getAllContracts);

/**
 * @swagger
 * /api/contracts/signatures:
 *   get:
 *     summary: Get all signatures across all contracts
 *     tags: [Contract Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           description: Filter by contract status
 *       - in: query
 *         name: contractId
 *         schema:
 *           type: string
 *           description: Filter by specific contract ID
 *       - in: query
 *         name: signerEmail
 *         schema:
 *           type: string
 *           description: Filter by signer email
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Search in signer name, email, template ID, or subscriber ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: signedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of all signatures with statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     signatures:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           contractId:
 *                             type: string
 *                           templateId:
 *                             type: string
 *                           subscriberId:
 *                             type: string
 *                           contractStatus:
 *                             type: string
 *                           signer:
 *                             type: object
 *                     pagination:
 *                       type: object
 *                     statistics:
 *                       type: object
 */
router.get('/signatures', authRBAC, requireRole(['super_admin', 'admin', 'manager', 'support']), getAllSignatures);

/**
 * @swagger
 * /api/contracts/enhanced/analytics/dashboard:
 *   get:
 *     summary: Get contract analytics dashboard
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: "30d"
 *     responses:
 *       200:
 *         description: Analytics dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     summary:
 *                       type: object
 *                     templateUsage:
 *                       type: array
 *                     recentActivity:
 *                       type: array
 */
router.get('/analytics/dashboard', authRBAC, requireRole(['admin', 'manager']), getContractAnalytics);

// =============================================================================
// EVIDENCE & COMPLIANCE (Admin/Legal Access)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/evidence-package:
 *   post:
 *     summary: Generate comprehensive evidence package
 *     tags: [Evidence & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Evidence package generated successfully
 *       404:
 *         description: Contract not found
 */
router.post('/:contractId/evidence-package', authRBAC, requireRole(['admin', 'legal']), generateEvidencePackage);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/download-package:
 *   get:
 *     summary: Download evidence package as ZIP
 *     tags: [Evidence & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [zip, json]
 *           default: "zip"
 *     responses:
 *       200:
 *         description: Evidence package file
 *         content:
 *           application/zip:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: object
 *       404:
 *         description: Contract not found
 */
router.get('/:contractId/download-package', authRBAC, requireRole(['admin', 'legal']), downloadEvidencePackage);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/certificate:
 *   get:
 *     summary: Get certificate of completion
 *     tags: [Evidence & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Certificate of completion
 *       400:
 *         description: Certificate only available for completed contracts
 *       404:
 *         description: Contract not found
 */
router.get('/:contractId/certificate', authRBAC, requireRole(['admin', 'legal', 'manager']), getCertificateOfCompletion);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/audit-trail:
 *   get:
 *     summary: Get comprehensive audit trail
 *     tags: [Evidence & Compliance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed audit trail
 *       404:
 *         description: Contract not found
 */
router.get('/:contractId/audit-trail', authRBAC, requireRole(['admin', 'legal', 'support']), getContractAuditTrail);

// =============================================================================
// ADMIN CONTROLS (Admin Only)
// =============================================================================

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/void:
 *   post:
 *     summary: Void a contract
 *     tags: [Admin Controls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for voiding the contract
 *     responses:
 *       200:
 *         description: Contract voided successfully
 *       400:
 *         description: Reason is required
 *       404:
 *         description: Contract not found
 */
router.post('/:contractId/void', authRBAC, requireRole(['admin']), voidContract);

/**
 * @swagger
 * /api/contracts/enhanced/{contractId}/resend:
 *   post:
 *     summary: Resend contract to signer
 *     tags: [Admin Controls]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signerId
 *             properties:
 *               signerId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contract resent successfully
 *       400:
 *         description: Signer ID is required
 *       404:
 *         description: Contract or signer not found
 */
router.post('/:contractId/resend', authRBAC, requireRole(['admin', 'manager']), resendContract);

module.exports = router;





