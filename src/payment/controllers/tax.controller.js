const taxService = require('../services/tax.service');

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
}

module.exports = new TaxController();





