/**
 * Contracts Routes - Main Entry Point
 * 
 * This file serves as the primary router for all contract-related endpoints.
 * All routes now use the enhanced contract system.
 * 
 * Migration completed on: 2025-01-15
 * - Legacy files moved to: src/contract/legacy/
 * - Enhanced system is now the default
 * 
 * Route Structure:
 * - /api/contracts/*              → Enhanced contract routes (direct access)
 * - /api/contracts/enhanced/*     → Enhanced contract routes (legacy compatibility)
 */

const express = require('express');
const enhancedContractRoutes = require('../contract/routes/enhancedContract.routes');

const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Contracts
 *     description: Contracts API endpoints
 */

// Mount enhanced contract routes at root level (primary access)
router.use('/', enhancedContractRoutes);

// Mount enhanced routes under /enhanced prefix for backward compatibility
// This allows gradual migration for frontend apps still using /enhanced URLs
router.use('/enhanced', enhancedContractRoutes);

module.exports = router;