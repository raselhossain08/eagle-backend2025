const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  discounts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discount',
  }],
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft',
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
}, {
  timestamps: true,
});

campaignSchema.plugin(mongoosePaginate);

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;





