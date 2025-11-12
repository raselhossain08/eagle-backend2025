const express = require('express');
const campaignController = require('../controllers/campaign.controller');

const router = express.Router();
/**
 * @swagger
 * tags:
 *   - name: Analytics Campaigns
 *     description: Analytics Campaigns API endpoints
 */

router
    .route('/')
    .post(campaignController.createCampaign)
    .get(campaignController.getCampaigns);

router
    .route('/:campaignId')
    .get(campaignController.getCampaign)
    .patch(campaignController.updateCampaign)
    .delete(campaignController.deleteCampaign);

module.exports = router;





