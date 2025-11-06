/**
 * Contract Routes - Unified Entry Point
 * 
 * This file serves as the main entry point for all contract-related routes.
 * It mounts the enhanced contract system as the primary handler.
 * 
 * Migration Status:  Complete
 * - Old contract.controller.js  legacy/
 * - Old getContractStats.js  legacy/
 * - Enhanced routes now serve all functionality
 * 
 * For legacy implementations, see: src/contract/legacy/
 */

const express = require('express');
const router = express.Router();

// Import enhanced contract routes (primary system)
const enhancedRoutes = require('./enhancedContract.routes');

// Mount enhanced routes at root level for backward compatibility
router.use('/', enhancedRoutes);

/**
 * Route Mapping (Old  New):
 * 
 * TEMPLATES:
 * - GET    /templates               /templates
 * - POST   /templates               /templates
 * - PUT    /templates/:id           /templates/:templateId
 * - DELETE /templates/:id           /templates/:templateId
 * 
 * STATS:
 * - GET    /stats                   /analytics/dashboard
 * 
 * CONTRACTS:
 * - GET    /                        /search (with query params)
 * - POST   /sign                    /initiate (new workflow)
 * - GET    /:contractId             Handled by enhanced routes
 * - PUT    /:contractId             Use /:contractId/void or resend
 * - DELETE /:contractId             Use /:contractId/void
 * 
 * EVIDENCE:
 * - GET    /evidence                /:contractId/evidence-package
 * - GET    /:contractId/pdf         /:contractId/certificate
 * 
 * PUBLIC ROUTES:
 * - GET    /sign/:contractId        /sign/:contractId (preserved)
 * - POST   /public/sign             Use /initiate instead
 * - GET    /guest/:contractId       /sign/:contractId (with token)
 */

module.exports = router;
