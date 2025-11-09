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
            filterType,
            country,
            state,
            taxType,
            active
        } = queryParams;

        let query = {};

        if (searchTerm) {
            query.$or = [
                { country: { $regex: searchTerm, $options: 'i' } },
                { state: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } }
            ];
        }

        if (country) {
            query.country = { $regex: country, $options: 'i' };
        }

        if (state) {
            query.state = { $regex: state, $options: 'i' };
        }

        if (taxType) {
            const typeRegex = new RegExp(`^${taxType.replace(' ', '')}`, 'i');
            query.taxType = typeRegex;
        }

        if (filterType && filterType !== 'all') {
            const typeRegex = new RegExp(`^${filterType.replace(' ', '')}`, 'i');
            query.type = typeRegex;
        }

        if (active !== undefined) {
            query.active = active === 'true' || active === true;
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
            page: parseInt(page),
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
        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            // Get tax rates statistics
            const totalTaxRates = await TaxRate.countDocuments();
            const activeTaxRates = await TaxRate.countDocuments({ active: true });
            const inactiveTaxRates = totalTaxRates - activeTaxRates;

            // Get unique countries and states
            const countries = await TaxRate.distinct('country');
            const states = await TaxRate.distinct('state');

            // Get recent activity (mock data - replace with real transaction data)
            const last30DaysData = {
                taxCollected: 5000,
                transactionCount: 150
            };

            const last7DaysData = {
                taxCollected: 1500,
                transactionCount: 45
            };

            return {
                data: {
                    overview: {
                        totalTaxRates,
                        activeTaxRates,
                        inactiveTaxRates,
                        countries: countries.length,
                        states: states.length
                    },
                    recentActivity: {
                        last30Days: last30DaysData,
                        last7Days: last7DaysData
                    }
                }
            };
        } catch (error) {
            console.error('Error in getTaxSummary:', error);
            throw error;
        }
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

    // Tax Calculation
    async calculateTax(data) {
        const { amount, country, state, taxType, productType, customerType } = data;

        // Find applicable tax rate
        let query = { country, active: true };
        if (state) query.state = state;
        if (taxType) query.taxType = taxType;

        const taxRate = await TaxRate.findOne(query).sort({ rate: -1 });

        if (!taxRate) {
            return {
                originalAmount: amount,
                taxRate: 0,
                taxAmount: 0,
                totalAmount: amount,
                breakdown: [],
                appliedRate: null
            };
        }

        const taxAmount = (amount * taxRate.rate) / 100;
        const totalAmount = amount + taxAmount;

        return {
            originalAmount: amount,
            taxRate: taxRate.rate,
            taxAmount,
            totalAmount,
            breakdown: [{
                name: taxRate.name || `${taxRate.taxType} - ${taxRate.country}`,
                rate: taxRate.rate,
                amount: taxAmount
            }],
            appliedRate: {
                id: taxRate._id,
                name: taxRate.name,
                country: taxRate.country,
                state: taxRate.state,
                type: taxRate.taxType
            }
        };
    }

    async bulkCalculateTax(transactions) {
        return Promise.all(transactions.map(tx => this.calculateTax(tx)));
    }

    // Tax Validation
    async validateTaxId(data) {
        const { taxId, country, state } = data;

        // Basic validation logic - can be extended with real API integrations
        const patterns = {
            US: /^\d{2}-\d{7}$/,  // EIN format
            GB: /^GB\d{9}$/,       // UK VAT
            CA: /^\d{9}RT\d{4}$/,  // Canadian BN
            AU: /^\d{11}$/         // Australian ABN
        };

        const pattern = patterns[country];
        if (!pattern) {
            return {
                valid: false,
                message: `Tax ID validation not supported for ${country}`,
                taxId,
                country,
                state
            };
        }

        const valid = pattern.test(taxId);

        return {
            valid,
            message: valid ? 'Tax ID is valid' : 'Tax ID format is invalid',
            taxId,
            formattedTaxId: valid ? taxId : null,
            country,
            state,
            jurisdiction: state || country,
            type: this.getTaxIdType(country)
        };
    }

    getTaxIdType(country) {
        const types = {
            US: 'EIN (Employer Identification Number)',
            GB: 'VAT Registration Number',
            CA: 'Business Number (BN)',
            AU: 'Australian Business Number (ABN)'
        };
        return types[country] || 'Tax Identification Number';
    }

    async bulkValidateTaxIds(validations) {
        return Promise.all(validations.map(v => this.validateTaxId(v)));
    }

    // Compliance Status
    async getComplianceStatus(params) {
        const { country, state, status } = params;

        // Mock compliance data - replace with real DB queries
        const mockCompliance = [
            {
                country: 'US',
                state: 'CA',
                status: 'COMPLIANT',
                filingFrequency: 'MONTHLY',
                lastFiled: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
                nextDue: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                registrationNumber: 'CA-123456'
            },
            {
                country: 'US',
                state: 'NY',
                status: 'PENDING',
                filingFrequency: 'QUARTERLY',
                lastFiled: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                nextDue: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                registrationNumber: 'NY-789012'
            }
        ];

        let filtered = mockCompliance;
        if (country) filtered = filtered.filter(c => c.country === country);
        if (state) filtered = filtered.filter(c => c.state === state);
        if (status) filtered = filtered.filter(c => c.status === status);

        return filtered;
    }

    async updateComplianceStatus(country, state, data) {
        // Mock update - implement real DB logic
        return {
            country,
            state,
            ...data,
            updatedAt: new Date()
        };
    }

    // Tax Analytics
    async getTaxAnalytics(params) {
        const { period, metric, groupBy } = params;

        // Mock analytics data
        return {
            period,
            metric,
            groupBy,
            data: [
                { label: 'Week 1', value: 1250.50 },
                { label: 'Week 2', value: 1890.75 },
                { label: 'Week 3', value: 2100.00 },
                { label: 'Week 4', value: 1750.25 }
            ]
        };
    }

    // Jurisdictions
    async getJurisdictions(params) {
        const { country, type } = params;

        const jurisdictions = [
            { code: 'CA', name: 'California', type: 'state', country: 'US' },
            { code: 'NY', name: 'New York', type: 'state', country: 'US' },
            { code: 'TX', name: 'Texas', type: 'state', country: 'US' },
            { code: 'FL', name: 'Florida', type: 'state', country: 'US' },
            { code: 'ON', name: 'Ontario', type: 'state', country: 'CA' },
            { code: 'BC', name: 'British Columbia', type: 'state', country: 'CA' }
        ];

        let filtered = jurisdictions;
        if (country) filtered = filtered.filter(j => j.country === country);
        if (type) filtered = filtered.filter(j => j.type === type);

        return filtered;
    }

    // Tax Exemptions
    async getExemptions(params) {
        const { customerId, country, state } = params;

        // Mock exemptions - implement real DB
        return [];
    }

    async createExemption(data) {
        // Mock creation - implement real DB
        return {
            id: Date.now().toString(),
            ...data,
            createdAt: new Date()
        };
    }

    // Tax Settings
    async getTaxSettings() {
        // Mock settings - implement real DB/config
        return {
            automaticCalculations: true,
            taxInclusivePricing: false,
            roundTax: true,
            defaultCountry: 'US',
            fallbackTaxRate: 0,
            complianceAlerts: true
        };
    }

    async updateTaxSettings(data) {
        // Mock update - implement real DB/config
        return {
            ...data,
            updatedAt: new Date()
        };
    }

    // Export Functions
    getExportContentType(format) {
        const types = {
            csv: 'text/csv',
            json: 'application/json',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        return types[format] || 'text/plain';
    }

    async exportTaxRates(format, params) {
        const { data: rates } = await this.getTaxRates({ ...params, limit: 1000 });

        if (format === 'json') {
            return JSON.stringify(rates, null, 2);
        }

        if (format === 'csv') {
            const headers = ['ID', 'Name', 'Country', 'State', 'Tax Type', 'Rate', 'Active'];
            const rows = rates.map(r => [
                r._id,
                r.name || '',
                r.country,
                r.state || '',
                r.taxType,
                r.rate,
                r.active
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        throw new Error('Export format not supported');
    }

    async exportTaxReport(format, params) {
        const { data: reports } = await this.getTaxReports({ ...params, limit: 1000 });

        if (format === 'json') {
            return JSON.stringify(reports, null, 2);
        }

        if (format === 'csv') {
            const headers = ['ID', 'Period', 'Country', 'State', 'Status', 'Collected', 'Due Date'];
            const rows = reports.map(r => [
                r._id,
                r.period,
                r.country,
                r.state || '',
                r.status,
                r.collected,
                r.due
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        throw new Error('Export format not supported');
    }
}

module.exports = TaxService;





