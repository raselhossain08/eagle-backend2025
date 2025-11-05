
const mongoose = require('mongoose');

const taxReportSchema = new mongoose.Schema({
    period: { type: String, required: true },
    country: { type: String, required: true },
    collected: { type: Number, required: true },
    remitted: { type: Number, required: true },
    status: { type: String, enum: ['filed', 'pending', 'due'], required: true },
    due: { type: Date, required: true }
}, { timestamps: true });

const TaxReport = mongoose.models.TaxReport || mongoose.model('TaxReport', taxReportSchema);

module.exports = TaxReport;





