const express = require('express');
const campaignController = require('../controllers/campaign.controller');

const router = express.Router();

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





