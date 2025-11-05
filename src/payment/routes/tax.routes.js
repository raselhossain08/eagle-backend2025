
const express = require('express');
const taxController = require('../controllers/tax.controller');
const router = express.Router();

router.get('/rates', taxController.getTaxRates);
router.post('/rates', taxController.addTaxRate);
router.put('/rates/:id', taxController.updateTaxRate);
router.delete('/rates/:id', taxController.deleteTaxRate);
router.get('/reports', taxController.getTaxReports);
router.get('/summary', taxController.getTaxSummary);

module.exports = router;





