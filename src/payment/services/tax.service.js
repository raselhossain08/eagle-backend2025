const TaxRate = require('../models/taxRate.model');
const TaxReport = require('../models/taxReport.model');

class TaxService {
    async getTaxRates(queryParams) {
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'country', 
            sortOrder = 'asc', 
            searchTerm, 
            filterType 
        } = queryParams;

        let query = {};

        if (searchTerm) {
            query.country = { $regex: searchTerm, $options: 'i' };
        }

        if (filterType && filterType !== 'all') {
            // Make the filter more robust for different tax types
            const typeRegex = new RegExp(`^${filterType.replace(' ', '')}`, 'i');
            query.type = typeRegex;
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const rates = await TaxRate.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));

        const total = await TaxRate.countDocuments(query);

        return {
            data: rates,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }

    async getTaxReports(queryParams) {
        const { 
            page = 1, 
            limit = 10, 
            sortBy = 'due', 
            sortOrder = 'desc', 
            status, 
            country 
        } = queryParams;

        let query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (country) {
            query.country = { $regex: country, $options: 'i' };
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const reports = await TaxReport.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await TaxReport.countDocuments(query);

        return {
            data: reports,
            total,
            page,
            pages: Math.ceil(total / limit)
        };
    }

    async getTaxSummary() {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const taxCollectedMTDResult = await TaxReport.aggregate([
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$collected' } } }
        ]);

        const activeJurisdictions = await TaxRate.countDocuments({ status: 'active' });

        const totalReports = await TaxReport.countDocuments();
        const filedReports = await TaxReport.countDocuments({ status: 'filed' });
        const complianceRate = totalReports > 0 ? (filedReports / totalReports) * 100 : 100;

        const pendingRemittanceResult = await TaxReport.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$collected' } } }
        ]);

        return {
            taxCollectedMTD: taxCollectedMTDResult.length > 0 ? taxCollectedMTDResult[0].total : 0,
            activeJurisdictions,
            complianceRate: parseFloat(complianceRate.toFixed(1)),
            pendingRemittance: pendingRemittanceResult.length > 0 ? pendingRemittanceResult[0].total : 0,
        };
    }

    async addTaxRate(rateData) {
        const newRate = new TaxRate({
            ...rateData,
            transactions: 0 // Default transactions to 0
        });
        await newRate.save();
        return newRate;
    }

    async updateTaxRate(id, updateData) {
        return await TaxRate.findByIdAndUpdate(id, updateData, { new: true });
    }

    async deleteTaxRate(id) {
        return await TaxRate.findByIdAndDelete(id);
    }
}

module.exports = new TaxService();





