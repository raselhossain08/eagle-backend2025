const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    customer: { type: String, required: true },
    type: { type: String, enum: ['card', 'bank'], required: true },
    last4: { type: String, required: true },
    brand: { type: String, required: true },
    status: { type: String, enum: ['active', 'expired', 'failed'], default: 'active' },
}, { timestamps: true });

// Pagination support would be added when mongoose-paginate-v2 is available

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod;





