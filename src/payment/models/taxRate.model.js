
const mongoose = require('mongoose');

const taxRateSchema = new mongoose.Schema({
    country: { type: String, required: true },
    rate: { type: Number, required: true },
    type: { type: String, enum: ['Sales Tax', 'VAT', 'GST', 'HST'], required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    transactions: { type: Number, default: 0 }
}, { timestamps: true });

const TaxRate = mongoose.models.TaxRate || mongoose.model('TaxRate', taxRateSchema);

module.exports = TaxRate;





