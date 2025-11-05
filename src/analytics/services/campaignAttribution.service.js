const PromotionalCampaign = require('../models/promotionalCampaign.model');
const DiscountCode = require('../models/discountCode.model');
const DiscountRedemption = require('../models/discountRedemption.model');
const crypto = require('crypto');

class CampaignAttributionService {
  
  constructor() {
    this.attributionCache = new Map();
    this.linkTracker = new Map();
  }
  
  // =====================================
  // CAMPAIGN MANAGEMENT
  // =====================================
  
  /**
   * Create promotional campaign
   */
  async createCampaign(campaignData, createdBy) {
    try {
      // Validate campaign data
      this.validateCampaignData(campaignData);
      
      // Process and set defaults
      const processedData = this.processCampaignData(campaignData, createdBy);
      
      // Create campaign
      const campaign = new PromotionalCampaign(processedData);
      await campaign.save();
      
      // Generate tracking URLs for affiliated campaigns
      if (campaign.affiliateProgram?.enabled) {
        await this.generateAffiliateTrackingUrls(campaign);
      }
      
      // Create initial analytics tracking
      await this.initializeCampaignTracking(campaign);
      
      return {
        success: true,
        data: campaign,
        message: 'Campaign created successfully'
      };
      
    } catch (error) {
      console.error('Error creating campaign:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Update campaign
   */
  async updateCampaign(campaignId, updateData, updatedBy) {
    try {
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        };
      }
      
      // Record changes for audit
      const originalData = campaign.toObject();
      
      // Update campaign
      Object.assign(campaign, updateData);
      campaign.audit.updatedBy = updatedBy;
      
      // Add to change log
      await campaign.addToChangeLog(
        'update',
        'campaign_data',
        originalData,
        updateData,
        updatedBy,
        'Campaign updated via API'
      );
      
      await campaign.save();
      
      return {
        success: true,
        data: campaign,
        message: 'Campaign updated successfully'
      };
      
    } catch (error) {
      console.error('Error updating campaign:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Launch campaign
   */
  async launchCampaign(campaignId, launchedBy) {
    try {
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        };
      }
      
      if (campaign.status !== 'scheduled' && campaign.status !== 'draft') {
        return {
          success: false,
          error: 'Campaign cannot be launched in current status',
          code: 'INVALID_STATUS'
        };
      }
      
      // Check if all required approvals are in place
      const approvalCheck = this.checkCampaignApprovals(campaign);
      if (!approvalCheck.approved) {
        return {
          success: false,
          error: 'Campaign requires additional approvals',
          code: 'APPROVALS_PENDING',
          data: approvalCheck
        };
      }
      
      // Activate associated discount codes
      await this.activateCampaignDiscountCodes(campaign);
      
      // Update campaign status
      campaign.status = 'active';
      campaign.timeline.actualStartDate = new Date();
      campaign.workflow.currentStage = 'launched';
      
      // Add to change log
      await campaign.addToChangeLog(
        'launch',
        'status',
        'scheduled',
        'active',
        launchedBy,
        'Campaign launched'
      );
      
      await campaign.save();
      
      // Initialize real-time tracking
      await this.startCampaignTracking(campaign);
      
      // Send launch notifications
      await this.sendCampaignLaunchNotifications(campaign);
      
      return {
        success: true,
        data: campaign,
        message: 'Campaign launched successfully'
      };
      
    } catch (error) {
      console.error('Error launching campaign:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Pause campaign
   */
  async pauseCampaign(campaignId, pausedBy, reason = '') {
    try {
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        };
      }
      
      if (campaign.status !== 'active') {
        return {
          success: false,
          error: 'Only active campaigns can be paused',
          code: 'INVALID_STATUS'
        };
      }
      
      // Pause associated discount codes
      await this.pauseCampaignDiscountCodes(campaign);
      
      // Update campaign status
      campaign.status = 'paused';
      campaign.workflow.currentStage = 'paused';
      
      // Add to change log
      await campaign.addToChangeLog(
        'pause',
        'status',
        'active',
        'paused',
        pausedBy,
        reason || 'Campaign paused'
      );
      
      await campaign.save();
      
      return {
        success: true,
        data: campaign,
        message: 'Campaign paused successfully'
      };
      
    } catch (error) {
      console.error('Error pausing campaign:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Complete campaign
   */
  async completeCampaign(campaignId, completedBy) {
    try {
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        };
      }
      
      // Generate final analytics report
      const finalReport = await this.generateCampaignReport(campaign);
      
      // Deactivate associated discount codes
      await this.deactivateCampaignDiscountCodes(campaign);
      
      // Update campaign status
      campaign.status = 'completed';
      campaign.timeline.actualEndDate = new Date();
      campaign.workflow.currentStage = 'analysis';
      
      // Calculate actual duration
      if (campaign.timeline.actualStartDate) {
        const diffTime = campaign.timeline.actualEndDate - campaign.timeline.actualStartDate;
        campaign.timeline.duration.actual = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      
      // Add to change log
      await campaign.addToChangeLog(
        'complete',
        'status',
        campaign.status,
        'completed',
        completedBy,
        'Campaign completed'
      );
      
      await campaign.save();
      
      // Send completion notifications
      await this.sendCampaignCompletionNotifications(campaign, finalReport);
      
      return {
        success: true,
        data: {
          campaign,
          finalReport
        },
        message: 'Campaign completed successfully'
      };
      
    } catch (error) {
      console.error('Error completing campaign:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  // =====================================
  // AFFILIATE & REFERRAL TRACKING
  // =====================================
  
  /**
   * Create affiliate tracking link
   */
  async createAffiliateLink(campaignId, affiliateData) {
    try {
      const {
        affiliateId,
        affiliateName,
        commissionRate,
        commissionType = 'percentage',
        customCode = null
      } = affiliateData;
      
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return {
          success: false,
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        };
      }
      
      // Generate unique tracking code
      const trackingCode = customCode || this.generateTrackingCode(affiliateId, campaignId);
      
      // Generate unique tracking URL
      const trackingUrl = this.generateTrackingUrl(campaignId, trackingCode);
      
      // Add affiliate to campaign
      const affiliateInfo = {
        affiliateId,
        affiliateName,
        commissionRate,
        commissionType,
        trackingCode,
        uniqueLink: trackingUrl,
        payoutTerms: 'Net 30'
      };
      
      campaign.affiliateProgram.affiliates.push(affiliateInfo);
      await campaign.save();
      
      // Initialize tracking
      this.initializeAffiliateTracking(trackingCode, {
        campaignId,
        affiliateId,
        affiliateName
      });
      
      return {
        success: true,
        data: {
          trackingCode,
          trackingUrl,
          affiliate: affiliateInfo
        },
        message: 'Affiliate link created successfully'
      };
      
    } catch (error) {
      console.error('Error creating affiliate link:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Track affiliate click
   */
  async trackAffiliateClick(trackingCode, clickData) {
    try {
      const {
        ipAddress,
        userAgent,
        referrer,
        country,
        deviceType
      } = clickData;
      
      // Get tracking info
      const trackingInfo = this.linkTracker.get(trackingCode);
      
      if (!trackingInfo) {
        return {
          success: false,
          error: 'Invalid tracking code',
          code: 'INVALID_TRACKING_CODE'
        };
      }
      
      // Record click
      const clickRecord = {
        trackingCode,
        campaignId: trackingInfo.campaignId,
        affiliateId: trackingInfo.affiliateId,
        timestamp: new Date(),
        ipAddress,
        userAgent,
        referrer,
        country,
        deviceType,
        clickId: this.generateClickId()
      };
      
      // Store click (in production, use database)
      this.storeAffiliateClick(clickRecord);
      
      // Update campaign analytics
      await this.updateCampaignAnalytics(trackingInfo.campaignId, {
        clicks: 1
      });
      
      return {
        success: true,
        data: {
          clickId: clickRecord.clickId,
          redirectUrl: await this.getRedirectUrl(trackingInfo.campaignId)
        },
        message: 'Click tracked successfully'
      };
      
    } catch (error) {
      console.error('Error tracking affiliate click:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Track affiliate conversion
   */
  async trackAffiliateConversion(trackingCode, conversionData) {
    try {
      const {
        userId,
        transactionId,
        revenue,
        discountCode
      } = conversionData;
      
      // Get tracking info
      const trackingInfo = this.linkTracker.get(trackingCode);
      
      if (!trackingInfo) {
        return {
          success: false,
          error: 'Invalid tracking code',
          code: 'INVALID_TRACKING_CODE'
        };
      }
      
      // Calculate commission
      const affiliate = await this.getAffiliateInfo(trackingInfo.campaignId, trackingInfo.affiliateId);
      
      let commissionAmount = 0;
      if (affiliate.commissionType === 'percentage') {
        commissionAmount = (revenue * affiliate.commissionRate) / 100;
      } else {
        commissionAmount = affiliate.commissionRate;
      }
      
      // Record conversion
      const conversionRecord = {
        trackingCode,
        campaignId: trackingInfo.campaignId,
        affiliateId: trackingInfo.affiliateId,
        userId,
        transactionId,
        revenue,
        commissionAmount,
        commissionRate: affiliate.commissionRate,
        commissionType: affiliate.commissionType,
        discountCode,
        timestamp: new Date(),
        status: 'pending_validation'
      };
      
      // Store conversion
      await this.storeAffiliateConversion(conversionRecord);
      
      // Update campaign analytics
      await this.updateCampaignAnalytics(trackingInfo.campaignId, {
        conversions: 1,
        revenue: revenue
      });
      
      return {
        success: true,
        data: {
          conversionId: conversionRecord.conversionId,
          commissionAmount,
          status: conversionRecord.status
        },
        message: 'Conversion tracked successfully'
      };
      
    } catch (error) {
      console.error('Error tracking affiliate conversion:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  // =====================================
  // ATTRIBUTION ANALYSIS
  // =====================================
  
  /**
   * Analyze attribution path
   */
  async analyzeAttributionPath(userId, transactionId) {
    try {
      // Get user's journey touchpoints
      const touchpoints = await this.getUserTouchpoints(userId);
      
      // Get attribution settings from campaigns
      const attributionModels = await this.getAttributionModels();
      
      // Apply different attribution models
      const attributionResults = {};
      
      for (const model of ['first_click', 'last_click', 'linear', 'time_decay']) {
        attributionResults[model] = this.applyAttributionModel(touchpoints, model);
      }
      
      // Determine winning attribution
      const finalAttribution = this.determineWinningAttribution(attributionResults);
      
      // Store attribution results
      await this.storeAttributionAnalysis({
        userId,
        transactionId,
        touchpoints,
        attributionResults,
        finalAttribution,
        timestamp: new Date()
      });
      
      return {
        success: true,
        data: {
          touchpoints,
          attributionResults,
          finalAttribution
        },
        message: 'Attribution analysis completed'
      };
      
    } catch (error) {
      console.error('Error analyzing attribution:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  /**
   * Apply attribution model
   */
  applyAttributionModel(touchpoints, model) {
    const totalTouchpoints = touchpoints.length;
    
    if (totalTouchpoints === 0) {
      return [];
    }
    
    const attributedTouchpoints = touchpoints.map((touchpoint, index) => {
      let weight = 0;
      
      switch (model) {
        case 'first_click':
          weight = index === 0 ? 1 : 0;
          break;
          
        case 'last_click':
          weight = index === totalTouchpoints - 1 ? 1 : 0;
          break;
          
        case 'linear':
          weight = 1 / totalTouchpoints;
          break;
          
        case 'time_decay':
          // Give more weight to recent touchpoints
          const decayFactor = 0.7;
          const position = totalTouchpoints - index;
          weight = Math.pow(decayFactor, position - 1);
          break;
          
        default:
          weight = 1 / totalTouchpoints;
      }
      
      return {
        ...touchpoint,
        attributionWeight: weight,
        attributionModel: model
      };
    });
    
    // Normalize weights to sum to 1
    const totalWeight = attributedTouchpoints.reduce((sum, tp) => sum + tp.attributionWeight, 0);
    
    if (totalWeight > 0) {
      attributedTouchpoints.forEach(tp => {
        tp.attributionWeight = tp.attributionWeight / totalWeight;
      });
    }
    
    return attributedTouchpoints;
  }
  
  /**
   * Track UTM parameters
   */
  async trackUtmParameters(utmData, sessionData) {
    try {
      const {
        utm_source,
        utm_medium,
        utm_campaign,
        utm_term,
        utm_content
      } = utmData;
      
      // Find matching campaign
      const campaign = await PromotionalCampaign.findOne({
        'attribution.utmCampaign': utm_campaign
      });
      
      if (campaign) {
        // Track campaign interaction
        await this.trackCampaignInteraction(campaign.campaignId, {
          type: 'utm_visit',
          source: utm_source,
          medium: utm_medium,
          term: utm_term,
          content: utm_content,
          sessionData
        });
      }
      
      // Store UTM touchpoint
      const touchpoint = {
        type: 'utm_visit',
        campaignId: campaign?.campaignId,
        utmParameters: {
          source: utm_source,
          medium: utm_medium,
          campaign: utm_campaign,
          term: utm_term,
          content: utm_content
        },
        sessionData,
        timestamp: new Date()
      };
      
      await this.storeTouchpoint(sessionData.userId || sessionData.sessionId, touchpoint);
      
      return {
        success: true,
        data: {
          campaignFound: !!campaign,
          campaignId: campaign?.campaignId,
          touchpoint
        },
        message: 'UTM parameters tracked successfully'
      };
      
    } catch (error) {
      console.error('Error tracking UTM parameters:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
  
  // =====================================
  // PERFORMANCE TRACKING
  // =====================================
  
  /**
   * Update campaign analytics
   */
  async updateCampaignAnalytics(campaignId, updateData) {
    try {
      const campaign = await PromotionalCampaign.findOne({ campaignId });
      
      if (!campaign) {
        return { success: false, error: 'Campaign not found' };
      }
      
      // Update analytics
      await campaign.updateAnalytics(updateData);
      
      // Check if campaign objectives are met
      await this.checkCampaignObjectives(campaign);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error updating campaign analytics:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate campaign report
   */
  async generateCampaignReport(campaign) {
    try {
      // Get redemption data
      const redemptions = await DiscountRedemption.find({
        'attribution.campaignId': campaign._id,
        status: 'applied'
      });
      
      // Calculate metrics
      const totalRedemptions = redemptions.length;
      const totalRevenue = redemptions.reduce((sum, r) => sum + r.transaction.finalAmount.amount, 0);
      const totalDiscount = redemptions.reduce((sum, r) => sum + r.transaction.discountAmount.amount, 0);
      const uniqueCustomers = new Set(redemptions.map(r => r.user.userId)).size;
      
      // Calculate ROI
      const totalSpent = campaign.budget.spent.amount || 0;
      const roi = totalSpent > 0 ? ((totalRevenue - totalSpent) / totalSpent) * 100 : 0;
      
      // Generate channel breakdown
      const channelBreakdown = await this.generateChannelBreakdown(redemptions);
      
      // Generate cohort analysis
      const cohortAnalysis = await this.generateCohortAnalysis(redemptions);
      
      const report = {
        campaignId: campaign.campaignId,
        campaignName: campaign.name,
        period: {
          startDate: campaign.timeline.actualStartDate || campaign.timeline.startDate,
          endDate: campaign.timeline.actualEndDate || new Date(),
          duration: campaign.timeline.duration.actual || campaign.daysRemaining
        },
        performance: {
          totalRedemptions,
          uniqueCustomers,
          totalRevenue,
          totalDiscount,
          averageOrderValue: totalRedemptions > 0 ? totalRevenue / totalRedemptions : 0,
          discountRate: totalRevenue > 0 ? (totalDiscount / (totalRevenue + totalDiscount)) * 100 : 0
        },
        financials: {
          totalSpent,
          roi,
          costPerAcquisition: uniqueCustomers > 0 ? totalSpent / uniqueCustomers : 0,
          revenuePerCustomer: uniqueCustomers > 0 ? totalRevenue / uniqueCustomers : 0
        },
        objectives: {
          primary: {
            metric: campaign.objectives.primary.metric,
            target: campaign.objectives.primary.target.value,
            actual: campaign.objectives.primary.actual.value,
            achievement: campaign.objectives.primary.target.value > 0 ? 
              (campaign.objectives.primary.actual.value / campaign.objectives.primary.target.value) * 100 : 0
          }
        },
        channelBreakdown,
        cohortAnalysis,
        topPerformingCodes: await this.getTopPerformingCodes(campaign._id),
        fraudAnalysis: await this.generateFraudAnalysis(redemptions),
        recommendations: this.generateRecommendations(campaign, {
          totalRedemptions,
          totalRevenue,
          roi,
          channelBreakdown
        })
      };
      
      return report;
      
    } catch (error) {
      console.error('Error generating campaign report:', error);
      throw error;
    }
  }
  
  // =====================================
  // HELPER METHODS
  // =====================================
  
  /**
   * Validate campaign data
   */
  validateCampaignData(campaignData) {
    const required = ['name', 'type', 'timeline', 'channels'];
    
    for (const field of required) {
      if (!campaignData[field]) {
        throw new Error(`${field} is required`);
      }
    }
    
    if (campaignData.timeline?.startDate && campaignData.timeline?.endDate) {
      if (new Date(campaignData.timeline.startDate) >= new Date(campaignData.timeline.endDate)) {
        throw new Error('End date must be after start date');
      }
    }
    
    if (campaignData.budget?.total?.amount && campaignData.budget.total.amount < 0) {
      throw new Error('Budget amount cannot be negative');
    }
  }
  
  /**
   * Process campaign data
   */
  processCampaignData(campaignData, createdBy) {
    return {
      ...campaignData,
      audit: {
        createdBy,
        changeLog: []
      },
      analytics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: { amount: 0, currency: campaignData.budget?.total?.currency || 'USD' },
        discountAmount: { amount: 0, currency: campaignData.budget?.total?.currency || 'USD' },
        incrementalRevenue: { amount: 0, currency: campaignData.budget?.total?.currency || 'USD' },
        metrics: {
          ctr: 0,
          cpm: 0,
          cpc: 0,
          cpa: 0,
          roas: 0,
          roi: 0,
          conversionRate: 0,
          bounceRate: 0,
          avgSessionDuration: 0
        }
      }
    };
  }
  
  /**
   * Generate tracking code
   */
  generateTrackingCode(affiliateId, campaignId) {
    const hash = crypto.createHash('md5').update(`${affiliateId}-${campaignId}-${Date.now()}`).digest('hex');
    return `AFF_${hash.substring(0, 8).toUpperCase()}`;
  }
  
  /**
   * Generate tracking URL
   */
  generateTrackingUrl(campaignId, trackingCode) {
    const baseUrl = process.env.TRACKING_BASE_URL || 'https://track.example.com';
    return `${baseUrl}/c/${campaignId}?ref=${trackingCode}`;
  }
  
  /**
   * Generate click ID
   */
  generateClickId() {
    return `CLK_${Date.now()}_${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }
  
  /**
   * Initialize affiliate tracking
   */
  initializeAffiliateTracking(trackingCode, trackingInfo) {
    this.linkTracker.set(trackingCode, {
      ...trackingInfo,
      createdAt: new Date(),
      clicks: 0,
      conversions: 0
    });
  }
  
  /**
   * Additional helper methods would be implemented here...
   */
  
}

module.exports = CampaignAttributionService;





