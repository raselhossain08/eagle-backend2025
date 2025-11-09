const express = require('express');
const {
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
    cloneTemplate
} = require('../contract/controllers/enhancedContract.controller');

const { protect } = require('../middlewares/auth.middleware');
const { authRBAC, requireRole } = require('../middlewares/rbacAuth.middleware');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(authRBAC);

/**
 * @route   GET /api/contract-templates
 * @desc    Get all contract templates
 * @access  Admin, Manager
 */
router.get('/', requireRole(['admin', 'manager']), getContractTemplates);

/**
 * @route   POST /api/contract-templates
 * @desc    Create new contract template
 * @access  Admin, Manager
 */
router.post('/', requireRole(['admin', 'manager']), createContractTemplate);

/**
 * @route   GET /api/contract-templates/:templateId
 * @desc    Get contract template by ID
 * @access  Admin, Manager, Support
 */
router.get('/:templateId', requireRole(['admin', 'manager', 'support']), getContractTemplate);

/**
 * @route   PUT /api/contract-templates/:templateId
 * @desc    Update contract template
 * @access  Admin, Manager
 */
router.put('/:templateId', requireRole(['admin', 'manager']), updateContractTemplate);

/**
 * @route   DELETE /api/contract-templates/:templateId
 * @desc    Delete contract template (soft delete by default)
 * @access  Admin, Manager
 */
router.delete('/:templateId', requireRole(['admin', 'manager']), deleteContractTemplate);

/**
 * @route   POST /api/contract-templates/:templateId/restore
 * @desc    Restore deleted contract template
 * @access  Admin, Manager
 */
router.post('/:templateId/restore', requireRole(['admin', 'manager']), restoreContractTemplate);

/**
 * @route   POST /api/contract-templates/:templateId/versions
 * @desc    Create new version of template
 * @access  Admin, Manager
 */
router.post('/:templateId/versions', requireRole(['admin', 'manager']), createTemplateVersion);

/**
 * @route   POST /api/contract-templates/:templateId/approve
 * @desc    Approve contract template
 * @access  Admin only
 */
router.post('/:templateId/approve', requireRole(['admin']), approveTemplate);

/**
 * @route   POST /api/contract-templates/:templateId/publish
 * @desc    Publish contract template
 * @access  Admin only
 */
router.post('/:templateId/publish', requireRole(['admin']), publishTemplate);

/**
 * @route   GET /api/contract-templates/:templateId/statistics
 * @desc    Get template usage statistics
 * @access  Admin, Manager
 */
router.get('/:templateId/statistics', requireRole(['admin', 'manager']), getTemplateStatistics);

/**
 * @route   POST /api/contract-templates/:templateId/clone
 * @desc    Clone contract template
 * @access  Admin, Manager
 */
router.post('/:templateId/clone', requireRole(['admin', 'manager']), cloneTemplate);

module.exports = router;
