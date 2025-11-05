const mongoose = require('mongoose');

const dunningStepSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['email_reminder', 'email_sms', 'personal_email', 'phone_call', 'final_notice', 'suspend_service', 'account_manager_outreach'],
  },
  template: {
    type: String, // Could be an ID to an email/SMS template collection later
  },
});

const dunningCampaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  steps: [dunningStepSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  isDefault: {
    type: Boolean,
    default: false,
  }
}, {
  timestamps: true,
});

// Pagination support would be added when mongoose-paginate-v2 is available

const DunningCampaign = mongoose.model('DunningCampaign', dunningCampaignSchema);

module.exports = DunningCampaign;





