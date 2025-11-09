
const express = require('express');
const taxController = require('../controllers/tax.controller');
const router = express.Router();

// Tax Rates CRUD
router.get('/rates', taxController.getTaxRates);
router.post('/rates', taxController.addTaxRate);
router.put('/rates/:id', taxController.updateTaxRate);
router.delete('/rates/:id', taxController.deleteTaxRate);

// Tax Calculation
router.post('/calculate', taxController.calculateTax);
router.post('/calculate/bulk', taxController.bulkCalculateTax);

// Tax Validation
router.post('/validate', taxController.validateTaxId);
router.post('/validate/bulk', taxController.bulkValidateTaxIds);

// Compliance
router.get('/compliance', taxController.getComplianceStatus);
router.put('/compliance/:country/:state', taxController.updateComplianceStatus);

// Reports & Analytics
router.get('/reports', taxController.getTaxReports);
router.get('/summary', taxController.getTaxSummary);
router.get('/analytics', taxController.getTaxAnalytics);

// Jurisdictions
router.get('/jurisdictions', taxController.getJurisdictions);

// Tax Exemptions
router.get('/exemptions', taxController.getExemptions);
router.post('/exemptions', taxController.createExemption);

// Tax Settings
router.get('/settings', taxController.getTaxSettings);
router.put('/settings', taxController.updateTaxSettings);

// Export
router.get('/export/rates.:format', taxController.exportTaxRates);
router.get('/export/report.:format', taxController.exportTaxReport);

module.exports = router;





