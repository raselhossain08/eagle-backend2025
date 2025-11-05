const express = require("express");
const router = express.Router();
const { protect } = require("../../../middlewares/auth.middleware");
const {
  globalSearch,
  searchSubscribers,
  searchContracts,
  getSearchSuggestions,
} = require("../controllers/search.controller");

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Global search functionality
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Global search across all content
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [subscriber, contract, notification, page]
 *         description: Filter by specific content type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       url:
 *                         type: string
 *                       data:
 *                         type: object
 *                 count:
 *                   type: integer
 *       400:
 *         description: Invalid query
 *       401:
 *         description: Unauthorized
 */
router.get("/", protect, globalSearch);

/**
 * @swagger
 * /api/search/subscribers:
 *   get:
 *     summary: Search subscribers (Admin only)
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query for subscriber name or email
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Subscriber search results
 *       400:
 *         description: Invalid query
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin privileges required
 */
router.get("/subscribers", protect, searchSubscribers);

/**
 * @swagger
 * /api/search/contracts:
 *   get:
 *     summary: Search contracts
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Search query for contract title or client
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *         description: Maximum number of results
 *     responses:
 *       200:
 *         description: Contract search results
 *       400:
 *         description: Invalid query
 *       401:
 *         description: Unauthorized
 */
router.get("/contracts", protect, searchContracts);

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Get search suggestions
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Partial search query
 *     responses:
 *       200:
 *         description: Search suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       text:
 *                         type: string
 *                       type:
 *                         type: string
 *                       icon:
 *                         type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/suggestions", protect, getSearchSuggestions);

module.exports = router;





