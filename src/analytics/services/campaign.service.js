const Campaign = require('../models/campaign.model');
const ApiError = require('../../../utils/ApiError');
const httpStatus = require('http-status');

/**
 * Create a campaign
 * @param {Object} campaignBody
 * @returns {Promise<Campaign>}
 */
const createCampaign = async (campaignBody) => {
  return Campaign.create(campaignBody);
};

/**
 * Query for campaigns
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @returns {Promise<QueryResult>}
 */
const queryCampaigns = async (filter, options) => {
  const campaigns = await Campaign.paginate(filter, options);
  return campaigns;
};

/**
 * Get campaign by id
 * @param {ObjectId} id
 * @returns {Promise<Campaign>}
 */
const getCampaignById = async (id) => {
  return Campaign.findById(id).populate('discounts');
};

/**
 * Update campaign by id
 * @param {ObjectId} campaignId
 * @param {Object} updateBody
 * @returns {Promise<Campaign>}
 */
const updateCampaignById = async (campaignId, updateBody) => {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Campaign not found');
  }
  Object.assign(campaign, updateBody);
  await campaign.save();
  return campaign;
};

/**
 * Delete campaign by id
 * @param {ObjectId} campaignId
 * @returns {Promise<Campaign>}
 */
const deleteCampaignById = async (campaignId) => {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Campaign not found');
  }
  await campaign.remove();
  return campaign;
};

module.exports = {
  createCampaign,
  queryCampaigns,
  getCampaignById,
  updateCampaignById,
  deleteCampaignById,
};





