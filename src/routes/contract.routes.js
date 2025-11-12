const express = require("express");
const {
  storeSignedContract,
  updatePaymentStatus,
  getUserContracts,
  getContractById,
  generateContractPDF,
  getContractPDFUrl,
  getContractsByContact,
  createContractWithContact,
  getGuestContractById,
  getPublicUserContracts,
  getGuestContracts,
  getAllContracts,
  deleteContract,
  updateContract,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  exportContracts,
  getEvidencePackets,
} = require("../contract/controllers/contract.controller");

// Import temporary stats function
const { getContractStats } = require("../contract/controllers/getContractStats");
const { processExistingContractsEndpoint } = require("../utils/processExistingContracts");
const { protect, optionalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Contracts (Legacy)
 *     description: Legacy contract endpoints - see Contracts tag for primary routes
 */

// Public routes (no authentication required)
// @route   POST /api/contracts/get-by-contact
// @desc    Get contracts by contact info (fullName, email, phone)
// @access  Public
router.post("/get-by-contact", getContractsByContact);

// @route   POST /api/contracts/create-with-contact
// @desc    Create contract with contact info (no auth required)
// @access  Public
router.post("/create-with-contact", createContractWithContact);

// @route   GET /api/contracts/guest/:contractId
// @desc    Get guest contract by ID (no auth required)
// @access  Public
router.get("/guest/:contractId", getGuestContractById);

// @route   POST /api/contracts/public/my-contracts
// @desc    Get user contracts by email (no auth required)
// @access  Public
router.post("/public/my-contracts", getPublicUserContracts);

// @route   GET /api/contracts/public/my-contracts/:email
// @desc    Get user contracts by email via GET (no auth required)
// @access  Public
router.get("/public/my-contracts/:email", getPublicUserContracts);

// @route   GET /api/contracts/my-contracts
// @desc    Get user's signed contracts (supports both authenticated and guest mode)
// @access  Public (but will check for auth token if available)
router.get("/my-contracts", optionalAuth, getUserContracts);

// @route   POST /api/contracts/my-contracts/guest
// @desc    Get guest contracts by contact info
// @access  Public
router.post("/my-contracts/guest", getGuestContracts);

// @route   POST /api/contracts/public/sign
// @desc    Store signed contract without authentication
// @access  Public
router.post("/public/sign", createContractWithContact);

// All other routes require authentication
router.use(protect);

// @route   GET /api/contracts/stats
// @desc    Get contract statistics
// @access  Protected
router.get("/stats", getContractStats);

// @route   GET /api/contracts/templates
// @desc    Get contract templates
// @access  Protected
router.get("/templates", getTemplates);

// @route   POST /api/contracts/templates
// @desc    Create contract template
// @access  Protected
router.post("/templates", createTemplate);

// @route   PUT /api/contracts/templates/:id
// @desc    Update contract template
// @access  Protected
router.put("/templates/:id", updateTemplate);

// @route   DELETE /api/contracts/templates/:id
// @desc    Delete contract template
// @access  Protected
router.delete("/templates/:id", deleteTemplate);

// @route   GET /api/contracts/export
// @desc    Export contracts
// @access  Protected
router.get("/export", exportContracts);

// @route   GET /api/contracts/evidence
// @desc    Get evidence packets
// @access  Protected
router.get("/evidence", getEvidencePackets);

// @route   GET /api/contracts
// @desc    Get all contracts with filters and pagination
// @access  Protected
router.get("/", getAllContracts);

// @route   POST /api/contracts/generate-pdf
// @desc    Generate PDF for contract
// @access  Protected
router.post("/generate-pdf", generateContractPDF);

// @route   POST /api/contracts/sign
// @desc    Store signed contract
// @access  Protected
router.post("/sign", storeSignedContract);

// @route   PUT /api/contracts/:contractId/payment
// @desc    Update contract payment status
// @access  Protected
router.put("/:contractId/payment", updatePaymentStatus);

// @route   GET /api/contracts/:contractId/pdf
// @desc    Get secure PDF URL for contract
// @access  Protected
router.get("/:contractId/pdf", getContractPDFUrl);

// @route   POST /api/contracts/process-existing
// @desc    Process existing contracts to create user accounts (utility endpoint)
// @access  Public (can be protected later if needed)
router.post("/process-existing", processExistingContractsEndpoint);

// @route   PUT /api/contracts/:id
// @desc    Update contract
// @access  Protected
router.put("/:id", updateContract);

// @route   DELETE /api/contracts/:id
// @desc    Delete contract
// @access  Protected
router.delete("/:id", deleteContract);

// @route   GET /api/contracts/:contractId
// @desc    Get contract by ID
// @access  Protected
router.get("/:contractId", getContractById);

module.exports = router;
