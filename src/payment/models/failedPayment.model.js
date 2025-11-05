const mongoose = require('mongoose');

const failedPaymentSchema = new mongoose.Schema({
    customer: { type: String, required: true },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    attempts: { type: Number, default: 1 },
    nextRetry: { type: Date },
    status: { type: String, enum: ['retrying', 'failed', 'pending'], default: 'pending' },
}, { timestamps: true });

// Pagination support would be added when mongoose-paginate-v2 is available

const FailedPayment = mongoose.model('FailedPayment', failedPaymentSchema);

module.exports = FailedPayment;





