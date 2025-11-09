const TaxService = require('../services/tax.service');
const taxService = new TaxService();

class TaxController {
    async getTaxRates(req, res, next) {
        try {
            const result = await taxService.getTaxRates(req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getTaxReports(req, res, next) {
        try {
            const result = await taxService.getTaxReports(req.query);
            res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getTaxSummary(req, res, next) {
        try {
            const summary = await taxService.getTaxSummary();
            res.json(summary);
        } catch (error) {
            next(error);
        }
    }

    async addTaxRate(req, res, next) {
        try {
            const newRate = await taxService.addTaxRate(req.body);
            res.status(201).json(newRate);
        } catch (error) {
            next(error);
        }
    }

    async updateTaxRate(req, res, next) {
        try {
            const updatedRate = await taxService.updateTaxRate(req.params.id, req.body);
            if (!updatedRate) {
                return res.status(404).json({ message: 'Tax rate not found' });
            }
            res.json(updatedRate);
        } catch (error) {
            next(error);
        }
    }

    async deleteTaxRate(req, res, next) {
        try {
            const deletedRate = await taxService.deleteTaxRate(req.params.id);
            if (!deletedRate) {
                return res.status(404).json({ message: 'Tax rate not found' });
            }
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    // Tax Calculation
    async calculateTax(req, res, next) {
        try {
            const result = await taxService.calculateTax(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    async bulkCalculateTax(req, res, next) {
        try {
            const result = await taxService.bulkCalculateTax(req.body.transactions);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Tax Validation
    async validateTaxId(req, res, next) {
        try {
            const result = await taxService.validateTaxId(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    async bulkValidateTaxIds(req, res, next) {
        try {
            const result = await taxService.bulkValidateTaxIds(req.body.validations);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Compliance
    async getComplianceStatus(req, res, next) {
        try {
            const result = await taxService.getComplianceStatus(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    async updateComplianceStatus(req, res, next) {
        try {
            const { country, state } = req.params;
            const result = await taxService.updateComplianceStatus(country, state, req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Analytics
    async getTaxAnalytics(req, res, next) {
        try {
            const result = await taxService.getTaxAnalytics(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Jurisdictions
    async getJurisdictions(req, res, next) {
        try {
            const result = await taxService.getJurisdictions(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Exemptions
    async getExemptions(req, res, next) {
        try {
            const result = await taxService.getExemptions(req.query);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    async createExemption(req, res, next) {
        try {
            const result = await taxService.createExemption(req.body);
            res.status(201).json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Settings
    async getTaxSettings(req, res, next) {
        try {
            const result = await taxService.getTaxSettings();
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    async updateTaxSettings(req, res, next) {
        try {
            const result = await taxService.updateTaxSettings(req.body);
            res.json({ success: true, data: result });
        } catch (error) {
            next(error);
        }
    }

    // Export
    async exportTaxRates(req, res, next) {
        try {
            const { format } = req.params;
            const result = await taxService.exportTaxRates(format, req.query);
            res.setHeader('Content-Type', taxService.getExportContentType(format));
            res.setHeader('Content-Disposition', `attachment; filename=tax-rates.${format}`);
            res.send(result);
        } catch (error) {
            next(error);
        }
    }

    async exportTaxReport(req, res, next) {
        try {
            const { format } = req.params;
            const result = await taxService.exportTaxReport(format, req.query);
            res.setHeader('Content-Type', taxService.getExportContentType(format));
            res.setHeader('Content-Disposition', `attachment; filename=tax-report.${format}`);
            res.send(result);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TaxController();





