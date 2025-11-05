/**
 * Payment Token Migration Service
 * Handle payment token migration with customer re-collection system
 * via secure links, email campaigns, and in-app prompts
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const User = require('../models/user.model');
const PaymentMethod = require('../models/paymentMethod.model');
const Subscription = require('../models/subscription.model');
const Notification = require('../models/Notification');

class PaymentTokenMigrationService {
  constructor() {
    this.migrationId = null;
    this.campaignId = null;
    this.tokenInventory = {};
    this.recollectionStats = {};
    this.emailCampaigns = {};
  }

  /**
   * Initialize payment token migration service
   */
  async initialize(options = {}) {
    try {
      this.migrationId = crypto.randomUUID();
      this.campaignId = crypto.randomUUID();
      
      console.log(`💳 Payment token migration service initialized - ID: ${this.migrationId}`);
      return { success: true, migrationId: this.migrationId, campaignId: this.campaignId };
    } catch (error) {
      console.error('Payment token migration initialization failed:', error.message);
      throw new Error(`Payment token migration initialization failed: ${error.message}`);
    }
  }

  /**
   * Analyze existing payment tokens
   */
  async analyzePaymentTokens(tokenData) {
    console.log('🔍 Analyzing existing payment tokens...');

    this.tokenInventory = {
      migrationId: this.migrationId,
      analysisDate: new Date(),
      totalTokens: tokenData.length,
      byGateway: {},
      byTokenType: {},
      userTokenCounts: {},
      expiredTokens: 0,
      activeSubscriptions: 0,
      criticalUsers: [],
      migrationStrategy: {}
    };

    // Analyze tokens
    for (const token of tokenData) {
      // Gateway analysis
      if (!this.tokenInventory.byGateway[token.gateway_id]) {
        this.tokenInventory.byGateway[token.gateway_id] = {
          count: 0,
          users: new Set(),
          canMigrate: this.canMigrateGateway(token.gateway_id),
          migrationMethod: this.getGatewayMigrationMethod(token.gateway_id)
        };
      }
      this.tokenInventory.byGateway[token.gateway_id].count++;
      this.tokenInventory.byGateway[token.gateway_id].users.add(token.user_id);

      // Token type analysis
      if (!this.tokenInventory.byTokenType[token.type]) {
        this.tokenInventory.byTokenType[token.type] = 0;
      }
      this.tokenInventory.byTokenType[token.type]++;

      // User token counts
      if (!this.tokenInventory.userTokenCounts[token.user_id]) {
        this.tokenInventory.userTokenCounts[token.user_id] = 0;
      }
      this.tokenInventory.userTokenCounts[token.user_id]++;

      // Check for expired tokens
      if (this.isTokenExpired(token)) {
        this.tokenInventory.expiredTokens++;
      }

      // Check if user has active subscriptions
      const hasActiveSubscriptions = await this.checkUserActiveSubscriptions(token.user_id);
      if (hasActiveSubscriptions) {
        this.tokenInventory.activeSubscriptions++;
        this.tokenInventory.criticalUsers.push({
          userId: token.user_id,
          tokenId: token.token_id,
          gateway: token.gateway_id,
          priority: 'high',
          reason: 'Active subscriptions'
        });
      }
    }

    // Convert Sets to arrays for serialization
    Object.values(this.tokenInventory.byGateway).forEach(gateway => {
      gateway.users = Array.from(gateway.users);
    });

    // Determine migration strategy
    this.tokenInventory.migrationStrategy = this.determineMigrationStrategy();

    console.log(`✅ Token analysis completed: ${this.tokenInventory.totalTokens} tokens, ${this.tokenInventory.criticalUsers.length} critical users`);
    return this.tokenInventory;
  }

  /**
   * Check if gateway tokens can be migrated
   */
  canMigrateGateway(gatewayId) {
    // Define which gateways support token migration
    const migratableGateways = {
      'stripe': true,
      'paypal': false, // PayPal tokens typically can't be migrated
      'square': true,
      'authorize_net': false,
      'braintree': true
    };

    return migratableGateways[gatewayId] || false;
  }

  /**
   * Get gateway migration method
   */
  getGatewayMigrationMethod(gatewayId) {
    const migrationMethods = {
      'stripe': 'api_migration', // Use Stripe API to migrate customer tokens
      'paypal': 'reauthorization', // Require customer reauthorization
      'square': 'api_migration',
      'authorize_net': 'reauthorization',
      'braintree': 'api_migration'
    };

    return migrationMethods[gatewayId] || 'reauthorization';
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    // Check if token has expiry information
    if (token.expiry_date) {
      return new Date(token.expiry_date) < new Date();
    }
    
    // Check if token is too old (assume 3 years for cards)
    if (token.date_created) {
      const tokenAge = new Date() - new Date(token.date_created);
      const threeYears = 3 * 365 * 24 * 60 * 60 * 1000;
      return tokenAge > threeYears;
    }

    return false;
  }

  /**
   * Check if user has active subscriptions
   */
  async checkUserActiveSubscriptions(legacyUserId) {
    try {
      const user = await User.findOne({ legacyId: legacyUserId });
      if (!user) return false;

      const activeSubscriptions = await Subscription.countDocuments({
        user: user._id,
        status: { $in: ['active', 'trial', 'pending_cancellation'] }
      });

      return activeSubscriptions > 0;
    } catch (error) {
      console.error(`Error checking subscriptions for user ${legacyUserId}:`, error.message);
      return false;
    }
  }

  /**
   * Determine migration strategy
   */
  determineMigrationStrategy() {
    const strategy = {
      approach: 'hybrid',
      phases: [],
      estimatedDuration: '2-4 weeks',
      riskLevel: 'medium'
    };

    // Phase 1: API Migration for supported gateways
    const apiMigratableTokens = Object.entries(this.tokenInventory.byGateway)
      .filter(([gateway, info]) => info.canMigrate && info.migrationMethod === 'api_migration')
      .reduce((sum, [gateway, info]) => sum + info.count, 0);

    if (apiMigratableTokens > 0) {
      strategy.phases.push({
        phase: 1,
        name: 'API Migration',
        description: 'Migrate tokens via payment gateway APIs',
        tokenCount: apiMigratableTokens,
        duration: '1-2 days',
        risk: 'low'
      });
    }

    // Phase 2: Customer Re-collection
    const reauthorizationTokens = this.tokenInventory.totalTokens - apiMigratableTokens;
    if (reauthorizationTokens > 0) {
      strategy.phases.push({
        phase: 2,
        name: 'Customer Re-collection',
        description: 'Secure customer re-authorization via email campaigns and in-app prompts',
        tokenCount: reauthorizationTokens,
        duration: '2-3 weeks',
        risk: 'medium'
      });
    }

    // Adjust risk level based on critical users
    if (this.tokenInventory.criticalUsers.length > this.tokenInventory.totalTokens * 0.3) {
      strategy.riskLevel = 'high';
      strategy.estimatedDuration = '3-6 weeks';
    }

    return strategy;
  }

  /**
   * Start payment token migration
   */
  async startTokenMigration(options = {}) {
    console.log('🚀 Starting payment token migration...');

    const migrationPlan = {
      migrationId: this.migrationId,
      startTime: new Date(),
      phases: [],
      results: {
        apiMigrated: 0,
        requiresRecollection: 0,
        failed: 0,
        errors: []
      }
    };

    try {
      // Phase 1: API Migration
      console.log('📡 Phase 1: API Migration...');
      const apiMigrationResult = await this.performAPIMigration();
      migrationPlan.phases.push(apiMigrationResult);
      migrationPlan.results.apiMigrated = apiMigrationResult.migrated;

      // Phase 2: Prepare re-collection campaigns
      console.log('📧 Phase 2: Preparing re-collection campaigns...');
      const campaignResult = await this.setupReCollectionCampaigns();
      migrationPlan.phases.push(campaignResult);
      migrationPlan.results.requiresRecollection = campaignResult.usersTargeted;

      // Phase 3: Send notifications
      console.log('📱 Phase 3: Sending notifications...');
      const notificationResult = await this.sendMigrationNotifications();
      migrationPlan.phases.push(notificationResult);

      migrationPlan.endTime = new Date();
      migrationPlan.duration = migrationPlan.endTime - migrationPlan.startTime;

      console.log(`✅ Payment token migration initiated successfully`);
      return migrationPlan;

    } catch (error) {
      console.error('❌ Payment token migration failed:', error.message);
      migrationPlan.error = error.message;
      throw error;
    }
  }

  /**
   * Perform API migration for supported gateways
   */
  async performAPIMigration() {
    const result = {
      phase: 'api_migration',
      startTime: new Date(),
      migrated: 0,
      failed: 0,
      errors: []
    };

    const migratableGateways = Object.entries(this.tokenInventory.byGateway)
      .filter(([gateway, info]) => info.canMigrate && info.migrationMethod === 'api_migration');

    for (const [gatewayId, gatewayInfo] of migratableGateways) {
      try {
        console.log(`🔄 Migrating ${gatewayId} tokens...`);
        
        const gatewayResult = await this.migrateGatewayTokens(gatewayId, gatewayInfo);
        result.migrated += gatewayResult.migrated;
        result.failed += gatewayResult.failed;
        
        if (gatewayResult.errors.length > 0) {
          result.errors.push(...gatewayResult.errors);
        }
      } catch (error) {
        console.error(`❌ Failed to migrate ${gatewayId} tokens:`, error.message);
        result.errors.push({
          gateway: gatewayId,
          error: error.message
        });
      }
    }

    result.endTime = new Date();
    console.log(`✅ API migration completed: ${result.migrated} migrated, ${result.failed} failed`);
    return result;
  }

  /**
   * Migrate tokens for specific gateway
   */
  async migrateGatewayTokens(gatewayId, gatewayInfo) {
    const result = { migrated: 0, failed: 0, errors: [] };

    // This would integrate with actual payment gateway APIs
    // For now, we'll simulate the process
    for (const userId of gatewayInfo.users) {
      try {
        // Simulate API migration
        const migrationSuccess = await this.simulateGatewayMigration(gatewayId, userId);
        
        if (migrationSuccess) {
          result.migrated++;
          // Update user's payment method status
          await this.updateUserPaymentMethodStatus(userId, 'migrated');
        } else {
          result.failed++;
          // Mark for re-collection
          await this.markUserForReCollection(userId, gatewayId);
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          userId,
          gateway: gatewayId,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Simulate gateway migration (replace with actual API calls)
   */
  async simulateGatewayMigration(gatewayId, userId) {
    // Simulate 80% success rate for API migrations
    return Math.random() > 0.2;
  }

  /**
   * Update user payment method status
   */
  async updateUserPaymentMethodStatus(legacyUserId, status) {
    try {
      const user = await User.findOne({ legacyId: legacyUserId });
      if (user) {
        // Update or create payment method record
        await PaymentMethod.findOneAndUpdate(
          { user: user._id, isDefault: true },
          { 
            migrationStatus: status,
            migrationDate: new Date(),
            migrationId: this.migrationId
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error(`Error updating payment method status for user ${legacyUserId}:`, error.message);
    }
  }

  /**
   * Mark user for re-collection
   */
  async markUserForReCollection(legacyUserId, gatewayId) {
    try {
      const user = await User.findOne({ legacyId: legacyUserId });
      if (user) {
        await PaymentMethod.findOneAndUpdate(
          { user: user._id, isDefault: true },
          { 
            migrationStatus: 'requires_recollection',
            originalGateway: gatewayId,
            migrationId: this.migrationId,
            recollectionToken: this.generateSecureToken(user._id)
          },
          { upsert: true }
        );
      }
    } catch (error) {
      console.error(`Error marking user for re-collection ${legacyUserId}:`, error.message);
    }
  }

  /**
   * Setup re-collection campaigns
   */
  async setupReCollectionCampaigns() {
    const result = {
      phase: 'recollection_setup',
      startTime: new Date(),
      campaignsCreated: 0,
      usersTargeted: 0,
      campaigns: []
    };

    // Critical users campaign (active subscriptions)
    const criticalCampaign = await this.createReCollectionCampaign({
      name: 'Critical Users - Active Subscriptions',
      priority: 'high',
      targetUsers: this.tokenInventory.criticalUsers,
      emailTemplate: 'critical_payment_update',
      reminderSchedule: [1, 3, 7, 14], // Days
      urgentNotifications: true
    });

    result.campaigns.push(criticalCampaign);
    result.campaignsCreated++;
    result.usersTargeted += criticalCampaign.targetCount;

    // General users campaign
    const generalUsers = await this.identifyGeneralReCollectionUsers();
    if (generalUsers.length > 0) {
      const generalCampaign = await this.createReCollectionCampaign({
        name: 'General Users - Payment Update',
        priority: 'medium',
        targetUsers: generalUsers,
        emailTemplate: 'payment_update_required',
        reminderSchedule: [3, 7, 14, 21],
        urgentNotifications: false
      });

      result.campaigns.push(generalCampaign);
      result.campaignsCreated++;
      result.usersTargeted += generalCampaign.targetCount;
    }

    // Inactive users campaign
    const inactiveUsers = await this.identifyInactiveUsers();
    if (inactiveUsers.length > 0) {
      const inactiveCampaign = await this.createReCollectionCampaign({
        name: 'Inactive Users - Optional Update',
        priority: 'low',
        targetUsers: inactiveUsers,
        emailTemplate: 'optional_payment_update',
        reminderSchedule: [7, 21],
        urgentNotifications: false
      });

      result.campaigns.push(inactiveCampaign);
      result.campaignsCreated++;
      result.usersTargeted += inactiveCampaign.targetCount;
    }

    this.emailCampaigns = result.campaigns.reduce((acc, campaign) => {
      acc[campaign.id] = campaign;
      return acc;
    }, {});

    result.endTime = new Date();
    console.log(`✅ Re-collection campaigns setup: ${result.campaignsCreated} campaigns, ${result.usersTargeted} users targeted`);
    return result;
  }

  /**
   * Create re-collection campaign
   */
  async createReCollectionCampaign(campaignConfig) {
    const campaign = {
      id: crypto.randomUUID(),
      migrationId: this.migrationId,
      name: campaignConfig.name,
      priority: campaignConfig.priority,
      emailTemplate: campaignConfig.emailTemplate,
      reminderSchedule: campaignConfig.reminderSchedule,
      urgentNotifications: campaignConfig.urgentNotifications,
      targetCount: campaignConfig.targetUsers.length,
      targetUsers: campaignConfig.targetUsers,
      status: 'ready',
      createdAt: new Date(),
      statistics: {
        emailsSent: 0,
        emailsOpened: 0,
        linksClicked: 0,
        tokensCollected: 0,
        bounced: 0
      }
    };

    // Generate secure links for each user
    for (const user of campaign.targetUsers) {
      user.secureLink = await this.generateSecureReCollectionLink(user.userId || user.user_id);
      user.token = this.generateSecureToken(user.userId || user.user_id);
      user.linkExpiry = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    }

    return campaign;
  }

  /**
   * Generate secure re-collection link
   */
  async generateSecureReCollectionLink(userId) {
    const token = this.generateSecureToken(userId);
    const baseUrl = process.env.FRONTEND_URL || 'https://app.example.com';
    
    return `${baseUrl}/payment-update?token=${token}&migration=${this.migrationId}`;
  }

  /**
   * Generate secure token
   */
  generateSecureToken(userId) {
    const payload = {
      userId,
      migrationId: this.migrationId,
      purpose: 'payment_recollection',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', { algorithm: 'HS256' });
  }

  /**
   * Identify general re-collection users
   */
  async identifyGeneralReCollectionUsers() {
    // Users who need re-collection but don't have active subscriptions
    const criticalUserIds = new Set(this.tokenInventory.criticalUsers.map(u => u.userId));
    
    return Object.keys(this.tokenInventory.userTokenCounts)
      .filter(userId => !criticalUserIds.has(userId))
      .map(userId => ({
        userId,
        reason: 'Token migration required',
        priority: 'medium'
      }));
  }

  /**
   * Identify inactive users
   */
  async identifyInactiveUsers() {
    // Users who haven't been active recently
    const sixMonthsAgo = new Date(Date.now() - (6 * 30 * 24 * 60 * 60 * 1000));
    
    try {
      const inactiveUsers = await User.find({
        lastLoginAt: { $lt: sixMonthsAgo },
        legacyId: { $exists: true }
      }).select('legacyId').lean();

      return inactiveUsers.map(user => ({
        userId: user.legacyId,
        reason: 'Inactive user',
        priority: 'low'
      }));
    } catch (error) {
      console.error('Error identifying inactive users:', error.message);
      return [];
    }
  }

  /**
   * Send migration notifications
   */
  async sendMigrationNotifications() {
    const result = {
      phase: 'notifications',
      startTime: new Date(),
      emailsSent: 0,
      inAppNotifications: 0,
      errors: []
    };

    for (const campaign of Object.values(this.emailCampaigns)) {
      try {
        console.log(`📧 Sending notifications for campaign: ${campaign.name}`);
        
        const campaignResult = await this.sendCampaignNotifications(campaign);
        result.emailsSent += campaignResult.emailsSent;
        result.inAppNotifications += campaignResult.inAppNotifications;
        
        if (campaignResult.errors.length > 0) {
          result.errors.push(...campaignResult.errors);
        }
      } catch (error) {
        console.error(`❌ Failed to send notifications for campaign ${campaign.name}:`, error.message);
        result.errors.push({
          campaign: campaign.name,
          error: error.message
        });
      }
    }

    result.endTime = new Date();
    console.log(`✅ Notifications sent: ${result.emailsSent} emails, ${result.inAppNotifications} in-app`);
    return result;
  }

  /**
   * Send campaign notifications
   */
  async sendCampaignNotifications(campaign) {
    const result = {
      emailsSent: 0,
      inAppNotifications: 0,
      errors: []
    };

    for (const targetUser of campaign.targetUsers) {
      try {
        // Find user in new system
        const user = await User.findOne({ legacyId: targetUser.userId || targetUser.user_id });
        if (!user) {
          result.errors.push({
            userId: targetUser.userId || targetUser.user_id,
            error: 'User not found in new system'
          });
          continue;
        }

        // Send email notification
        await this.sendPaymentUpdateEmail(user, campaign, targetUser);
        result.emailsSent++;

        // Create in-app notification
        await this.createInAppNotification(user, campaign, targetUser);
        result.inAppNotifications++;

        // Update campaign statistics
        campaign.statistics.emailsSent++;

      } catch (error) {
        result.errors.push({
          userId: targetUser.userId || targetUser.user_id,
          error: error.message
        });
      }
    }

    return result;
  }

  /**
   * Send payment update email
   */
  async sendPaymentUpdateEmail(user, campaign, targetUser) {
    // This would integrate with your email service
    const emailData = {
      to: user.email,
      subject: this.getEmailSubject(campaign),
      template: campaign.emailTemplate,
      data: {
        firstName: user.firstName,
        secureLink: targetUser.secureLink,
        expiryDate: targetUser.linkExpiry,
        priority: campaign.priority,
        supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com'
      }
    };

    // Simulate email sending
    console.log(`📧 Email sent to ${user.email} for campaign ${campaign.name}`);
    
    // In production, use your email service here
    // await emailService.send(emailData);
  }

  /**
   * Create in-app notification
   */
  async createInAppNotification(user, campaign, targetUser) {
    const notification = {
      user: user._id,
      type: 'payment_update_required',
      title: 'Payment Method Update Required',
      message: this.getInAppMessage(campaign),
      priority: campaign.priority,
      actionUrl: targetUser.secureLink,
      metadata: {
        migrationId: this.migrationId,
        campaignId: campaign.id,
        expiryDate: targetUser.linkExpiry
      },
      expiresAt: targetUser.linkExpiry
    };

    await Notification.create(notification);
  }

  /**
   * Get email subject based on campaign
   */
  getEmailSubject(campaign) {
    const subjects = {
      'critical_payment_update': '🚨 Urgent: Update Your Payment Method to Continue Service',
      'payment_update_required': '💳 Action Required: Update Your Payment Information',
      'optional_payment_update': '💡 Optional: Update Your Payment Method'
    };

    return subjects[campaign.emailTemplate] || 'Payment Method Update';
  }

  /**
   * Get in-app message based on campaign
   */
  getInAppMessage(campaign) {
    const messages = {
      'high': 'Your payment method needs to be updated to continue your active subscription. Please update it as soon as possible to avoid service interruption.',
      'medium': 'We need you to update your payment information due to system migration. Please update your payment method at your convenience.',
      'low': 'You can optionally update your payment method to ensure seamless future transactions.'
    };

    return messages[campaign.priority] || 'Please update your payment method.';
  }

  /**
   * Verify secure token
   */
  verifySecureToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
      
      if (decoded.migrationId !== this.migrationId) {
        throw new Error('Invalid migration ID');
      }
      
      if (decoded.purpose !== 'payment_recollection') {
        throw new Error('Invalid token purpose');
      }

      return decoded;
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Process payment re-collection
   */
  async processPaymentReCollection(token, paymentData) {
    try {
      const decoded = this.verifySecureToken(token);
      const user = await User.findOne({ legacyId: decoded.userId });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Create new payment method
      const paymentMethod = await PaymentMethod.create({
        user: user._id,
        type: paymentData.type,
        provider: paymentData.provider,
        token: paymentData.token,
        last4: paymentData.last4,
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
        isDefault: true,
        migrationStatus: 'recollected',
        migrationId: this.migrationId,
        recollectionDate: new Date()
      });

      // Update campaign statistics
      await this.updateCampaignStatistics(decoded.userId, 'collected');

      // Create success notification
      await Notification.create({
        user: user._id,
        type: 'payment_update_success',
        title: 'Payment Method Updated Successfully',
        message: 'Your payment method has been updated successfully. Thank you!',
        priority: 'low'
      });

      console.log(`✅ Payment re-collection successful for user: ${user.email}`);
      return { success: true, paymentMethodId: paymentMethod._id };

    } catch (error) {
      console.error('❌ Payment re-collection failed:', error.message);
      throw error;
    }
  }

  /**
   * Update campaign statistics
   */
  async updateCampaignStatistics(userId, action) {
    for (const campaign of Object.values(this.emailCampaigns)) {
      const user = campaign.targetUsers.find(u => (u.userId || u.user_id) === userId);
      if (user) {
        switch (action) {
          case 'opened':
            campaign.statistics.emailsOpened++;
            break;
          case 'clicked':
            campaign.statistics.linksClicked++;
            break;
          case 'collected':
            campaign.statistics.tokensCollected++;
            break;
        }
        break;
      }
    }
  }

  /**
   * Get migration progress
   */
  async getMigrationProgress() {
    const progress = {
      migrationId: this.migrationId,
      status: 'in_progress',
      totalUsers: Object.keys(this.tokenInventory.userTokenCounts || {}).length,
      apiMigrated: 0,
      awaitingRecollection: 0,
      recollected: 0,
      failed: 0,
      campaigns: {}
    };

    try {
      // Count migration statuses
      const migrationStatuses = await PaymentMethod.aggregate([
        { $match: { migrationId: this.migrationId } },
        { $group: { _id: '$migrationStatus', count: { $sum: 1 } } }
      ]);

      migrationStatuses.forEach(status => {
        switch (status._id) {
          case 'migrated':
            progress.apiMigrated = status.count;
            break;
          case 'requires_recollection':
            progress.awaitingRecollection = status.count;
            break;
          case 'recollected':
            progress.recollected = status.count;
            break;
          case 'failed':
            progress.failed = status.count;
            break;
        }
      });

      // Add campaign progress
      for (const [campaignId, campaign] of Object.entries(this.emailCampaigns)) {
        progress.campaigns[campaignId] = {
          name: campaign.name,
          statistics: campaign.statistics,
          conversionRate: campaign.statistics.emailsSent > 0 
            ? (campaign.statistics.tokensCollected / campaign.statistics.emailsSent * 100).toFixed(2) + '%'
            : '0%'
        };
      }

      progress.completionRate = progress.totalUsers > 0 
        ? ((progress.apiMigrated + progress.recollected) / progress.totalUsers * 100).toFixed(2) + '%'
        : '0%';

    } catch (error) {
      console.error('Error calculating migration progress:', error.message);
    }

    return progress;
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport() {
    const report = {
      migrationId: this.migrationId,
      generatedAt: new Date(),
      tokenInventory: this.tokenInventory,
      progress: await this.getMigrationProgress(),
      campaigns: this.emailCampaigns,
      recommendations: this.generateMigrationRecommendations()
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'migration-data', `payment-token-migration-report-${this.migrationId}.json`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Payment token migration report saved: ${reportPath}`);
    return report;
  }

  /**
   * Generate migration recommendations
   */
  generateMigrationRecommendations() {
    const recommendations = [];
    const progress = this.recollectionStats;

    // Low completion rate recommendations
    if (progress.completionRate && parseFloat(progress.completionRate) < 50) {
      recommendations.push({
        priority: 'high',
        category: 'completion_rate',
        message: 'Low completion rate detected',
        action: 'Consider additional outreach or incentives for payment method updates'
      });
    }

    // Critical users recommendations
    if (this.tokenInventory.criticalUsers && this.tokenInventory.criticalUsers.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'critical_users',
        message: 'Active subscription users need immediate attention',
        action: 'Prioritize direct outreach to users with active subscriptions'
      });
    }

    // Campaign performance recommendations
    for (const campaign of Object.values(this.emailCampaigns)) {
      const conversionRate = campaign.statistics.emailsSent > 0 
        ? (campaign.statistics.tokensCollected / campaign.statistics.emailsSent * 100)
        : 0;

      if (conversionRate < 20) {
        recommendations.push({
          priority: 'medium',
          category: 'campaign_performance',
          message: `Low conversion rate for campaign: ${campaign.name}`,
          action: 'Review email content and consider alternative communication channels'
        });
      }
    }

    // General recommendations
    recommendations.push({
      priority: 'medium',
      category: 'monitoring',
      message: 'Continue monitoring migration progress',
      action: 'Set up automated reminders for users who haven\'t completed the update'
    });

    return recommendations;
  }
}

module.exports = PaymentTokenMigrationService;





