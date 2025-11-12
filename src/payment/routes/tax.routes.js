
const express = require('express');
const taxController = require('../controllers/tax.controller');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Tax
 *     description: Tax management and calculation
 */

/**
 * @swagger
 * /api/tax/rates:
 *   get:
 *     summary: Get tax rates
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: List of tax rates
 *   post:
 *     summary: Add tax rate
 *     tags: [Tax]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Tax rate added
 */
router.get('/rates', taxController.getTaxRates);
router.post('/rates', taxController.addTaxRate);

/**
 * @swagger
 * /api/tax/rates/{id}:
 *   put:
 *     summary: Update tax rate
 *     tags: [Tax]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax rate updated
 *   delete:
 *     summary: Delete tax rate
 *     tags: [Tax]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax rate deleted
 */
router.put('/rates/:id', taxController.updateTaxRate);
router.delete('/rates/:id', taxController.deleteTaxRate);

/**
 * @swagger
 * /api/tax/calculate:
 *   post:
 *     summary: Calculate tax
 *     tags: [Tax]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               country:
 *                 type: string
 *               state:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tax calculated
 */
router.post('/calculate', taxController.calculateTax);

/**
 * @swagger
 * /api/tax/calculate/bulk:
 *   post:
 *     summary: Bulk calculate tax
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Taxes calculated
 */
router.post('/calculate/bulk', taxController.bulkCalculateTax);

/**
 * @swagger
 * /api/tax/validate:
 *   post:
 *     summary: Validate tax ID
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax ID validated
 */
router.post('/validate', taxController.validateTaxId);

/**
 * @swagger
 * /api/tax/validate/bulk:
 *   post:
 *     summary: Bulk validate tax IDs
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax IDs validated
 */
router.post('/validate/bulk', taxController.bulkValidateTaxIds);

/**
 * @swagger
 * /api/tax/compliance:
 *   get:
 *     summary: Get compliance status
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Compliance status
 */
router.get('/compliance', taxController.getComplianceStatus);

/**
 * @swagger
 * /api/tax/compliance/{country}/{state}:
 *   put:
 *     summary: Update compliance status
 *     tags: [Tax]
 *     parameters:
 *       - in: path
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Compliance updated
 */
router.put('/compliance/:country/:state', taxController.updateComplianceStatus);

/**
 * @swagger
 * /api/tax/reports:
 *   get:
 *     summary: Get tax reports
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax reports
 */
router.get('/reports', taxController.getTaxReports);

/**
 * @swagger
 * /api/tax/summary:
 *   get:
 *     summary: Get tax summary
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax summary
 */
router.get('/summary', taxController.getTaxSummary);

/**
 * @swagger
 * /api/tax/analytics:
 *   get:
 *     summary: Get tax analytics
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax analytics
 */
router.get('/analytics', taxController.getTaxAnalytics);

/**
 * @swagger
 * /api/tax/jurisdictions:
 *   get:
 *     summary: Get tax jurisdictions
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: List of jurisdictions
 */
router.get('/jurisdictions', taxController.getJurisdictions);

/**
 * @swagger
 * /api/tax/exemptions:
 *   get:
 *     summary: Get tax exemptions
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: List of exemptions
 *   post:
 *     summary: Create tax exemption
 *     tags: [Tax]
 *     responses:
 *       201:
 *         description: Exemption created
 */
router.get('/exemptions', taxController.getExemptions);
router.post('/exemptions', taxController.createExemption);

/**
 * @swagger
 * /api/tax/settings:
 *   get:
 *     summary: Get tax settings
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Tax settings
 *   put:
 *     summary: Update tax settings
 *     tags: [Tax]
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.get('/settings', taxController.getTaxSettings);
router.put('/settings', taxController.updateTaxSettings);

/**
 * @swagger
 * /api/tax/export/rates.{format}:
 *   get:
 *     summary: Export tax rates
 *     tags: [Tax]
 *     parameters:
 *       - in: path
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rates exported
 */
router.get('/export/rates.:format', taxController.exportTaxRates);

/**
 * @swagger
 * /api/tax/export/report.{format}:
 *   get:
 *     summary: Export tax report
 *     tags: [Tax]
 *     parameters:
 *       - in: path
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report exported
 */
router.get('/export/report.:format', taxController.exportTaxReport);

module.exports = router;





