const express = require('express');
const router = express.Router();
const TransactionTaxService = require('../services/transactionTax.service');
const TaxService = require('../../payment/services/tax.service');

const transactionTaxService = new TransactionTaxService();
const { protect, adminOnly } = require('../../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   - name: Transaction Tax
 *     description: Transaction tax calculation and management
 */

// Apply authentication to all routes
router.use(protect);

/**
 * @swagger
 * /api/transactions/tax/calculate:
 *   post:
 *     summary: Calculate tax for transaction preview
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - userLocation
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *               userLocation:
 *                 type: object
 *               productType:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tax calculated
 */
router.post('/calculate', async (req, res) => {
    try {
        const { amount, currency, userLocation, productType, description } = req.body;

        if (!amount || !userLocation) {
            return res.status(400).json({
                success: false,
                message: 'Amount and user location are required'
            });
        }

        const transactionData = {
            amount: { gross: parseFloat(amount) },
            currency: currency || 'USD',
            type: 'preview',
            description: description || 'Tax preview calculation'
        };

        const businessLocation = {
            country: process.env.BUSINESS_COUNTRY || 'US',
            state: process.env.BUSINESS_STATE || 'CA',
            city: process.env.BUSINESS_CITY || 'San Francisco',
            postalCode: process.env.BUSINESS_POSTAL_CODE || '94102'
        };

        const taxResult = await transactionTaxService.calculateTransactionTax(
            transactionData,
            userLocation,
            businessLocation
        );

        res.json({
            success: true,
            data: {
                originalAmount: taxResult.originalAmount,
                taxAmount: taxResult.taxAmount,
                totalAmount: taxResult.totalAmount,
                taxRate: taxResult.rate,
                jurisdiction: taxResult.jurisdiction,
                provider: taxResult.provider,
                breakdown: taxResult.breakdown || []
            }
        });

    } catch (error) {
        console.error('Tax calculation error:', error);
        res.status(500).json({
            success: false,
            message: 'Tax calculation failed',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/transactions/tax/subscription-preview:
 *   post:
 *     summary: Calculate tax preview for subscription
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subscriptionData:
 *                 type: object
 *               planData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Subscription tax preview
 */
router.post('/subscription-preview', async (req, res) => {
    try {
        const { subscriptionData, planData } = req.body;
        const userData = req.user;

        if (!subscriptionData?.amount || !planData) {
            return res.status(400).json({
                success: false,
                message: 'Subscription data and plan data are required'
            });
        }

        const taxResult = await transactionTaxService.calculateSubscriptionTax(
            subscriptionData,
            userData,
            planData
        );

        res.json({
            success: true,
            data: {
                planName: planData.name,
                originalAmount: taxResult.originalAmount,
                taxAmount: taxResult.taxAmount,
                totalAmount: taxResult.totalAmount,
                taxRate: taxResult.rate,
                jurisdiction: taxResult.jurisdiction,
                provider: taxResult.provider,
                billing: {
                    subtotal: taxResult.originalAmount,
                    tax: taxResult.taxAmount,
                    total: taxResult.totalAmount
                }
            }
        });

    } catch (error) {
        console.error('Subscription tax preview error:', error);
        res.status(500).json({
            success: false,
            message: 'Subscription tax preview failed',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/transactions/tax/report:
 *   get:
 *     summary: Generate tax report for transactions (Admin)
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *     responses:
 *       200:
 *         description: Tax report generated
 */
router.get('/report', adminOnly, async (req, res) => {
    try {
        const {
            startDate,
            endDate,
            country,
            state,
            format = 'json'
        } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const filters = {};
        if (country) filters.country = country;
        if (state) filters.state = state;

        const taxReport = await transactionTaxService.generateTaxReport(
            new Date(startDate),
            new Date(endDate),
            filters
        );

        if (format === 'csv') {
            // CSV format জন্য header set করি
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=tax_report_${startDate}_to_${endDate}.csv`);

            const csvData = this.convertReportToCSV(taxReport);
            return res.send(csvData);
        }

        res.json({
            success: true,
            data: taxReport
        });

    } catch (error) {
        console.error('Tax report generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Tax report generation failed',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/transactions/tax/rates:
 *   get:
 *     summary: Get available tax rates by location (Admin)
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tax rates retrieved
 */
router.get('/rates', adminOnly, async (req, res) => {
    try {
        const taxService = new TaxService();
        const { page, limit, country, searchTerm } = req.query;

        const queryParams = {
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            searchTerm,
            filterType: 'all'
        };

        const taxRates = await taxService.getTaxRates(queryParams);

        res.json({
            success: true,
            data: taxRates
        });

    } catch (error) {
        console.error('Get tax rates error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve tax rates',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/transactions/{transactionId}/tax/update:
 *   post:
 *     summary: Update tax information for existing transaction (Admin)
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
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
 *               - taxAmount
 *               - reason
 *             properties:
 *               taxAmount:
 *                 type: number
 *               taxRate:
 *                 type: number
 *               jurisdiction:
 *                 type: string
 *               provider:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Transaction tax updated
 */
router.post('/:transactionId/tax/update', adminOnly, async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { taxAmount, taxRate, jurisdiction, provider = 'manual' } = req.body;

        if (!taxAmount && taxAmount !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Tax amount is required'
            });
        }

        const taxData = {
            taxAmount: parseFloat(taxAmount),
            rate: taxRate,
            jurisdiction,
            provider,
            updatedBy: req.user._id,
            updatedAt: new Date()
        };

        const updatedTransaction = await transactionTaxService.updateTransactionWithTax(
            transactionId,
            taxData
        );

        res.json({
            success: true,
            message: 'Transaction tax updated successfully',
            data: {
                transactionId: updatedTransaction.transactionId,
                taxAmount: updatedTransaction.amount.tax,
                netAmount: updatedTransaction.amount.net
            }
        });

    } catch (error) {
        console.error('Update transaction tax error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update transaction tax',
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/transactions/tax/jurisdictions:
 *   get:
 *     summary: Get available tax jurisdictions (Admin)
 *     tags: [Transaction Tax]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tax jurisdictions retrieved
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
 *                     type: object
 */
router.get('/jurisdictions', adminOnly, async (req, res) => {
    try {
        // This would typically come from a tax service provider
        const jurisdictions = [
            {
                country: 'US',
                name: 'United States',
                states: [
                    { code: 'CA', name: 'California', rate: 8.25 },
                    { code: 'NY', name: 'New York', rate: 8.0 },
                    { code: 'TX', name: 'Texas', rate: 6.25 },
                    { code: 'FL', name: 'Florida', rate: 6.0 }
                ]
            },
            {
                country: 'CA',
                name: 'Canada',
                rate: 13.0,
                type: 'GST+PST'
            },
            {
                country: 'GB',
                name: 'United Kingdom',
                rate: 20.0,
                type: 'VAT'
            }
        ];

        res.json({
            success: true,
            data: jurisdictions
        });

    } catch (error) {
        console.error('Get jurisdictions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve jurisdictions',
            error: error.message
        });
    }
});

// Helper function to convert report to CSV
function convertReportToCSV(report) {
    const headers = ['Country', 'State', 'Tax Rate', 'Transactions', 'Gross Amount', 'Tax Amount', 'Net Amount'];
    const csvRows = [headers.join(',')];

    report.byJurisdiction.forEach(item => {
        const row = [
            item._id.country || '',
            item._id.state || '',
            `${(item.avgTaxRate * 100).toFixed(2)}%`,
            item.totalTransactions,
            `$${(item.totalGross / 100).toFixed(2)}`,
            `$${(item.totalTax / 100).toFixed(2)}`,
            `$${(item.totalNet / 100).toFixed(2)}`
        ];
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

module.exports = router;