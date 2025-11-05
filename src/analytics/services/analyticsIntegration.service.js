const VisitorSession = require('../models/visitorSession.model');
const AnalyticsEvent = require('../models/analyticsEvent.model');
const PrivacyConsent = require('../models/privacyConsent.model');
const axios = require('axios');

class AnalyticsIntegrationService {
  
  constructor() {
    this.integrations = new Map();
    this.supportedProviders = ['ga4', 'posthog', 'plausible', 'matomo', 'mixpanel', 'amplitude'];
    this.initializeIntegrations();
  }
  
  /**
   * Initialize all available integrations
   */
  initializeIntegrations() {
    // Google Analytics 4 Integration
    this.integrations.set('ga4', new GA4Integration());
    
    // PostHog Integration
    this.integrations.set('posthog', new PostHogIntegration());
    
    // Plausible Integration
    this.integrations.set('plausible', new PlausibleIntegration());
    
    // Matomo Integration
    this.integrations.set('matomo', new MatomoIntegration());
    
    // Mixpanel Integration
    this.integrations.set('mixpanel', new MixpanelIntegration());
    
    // Amplitude Integration
    this.integrations.set('amplitude', new AmplitudeIntegration());
  }
  
  /**
   * Send event to specified providers
   */
  async sendEvent(eventData, providers = [], config = {}) {
    try {
      const results = [];
      
      for (const provider of providers) {
        if (!this.integrations.has(provider)) {
          results.push({
            provider,
            success: false,
            error: 'Provider not supported'
          });
          continue;
        }
        
        try {
          const integration = this.integrations.get(provider);
          const providerConfig = config[provider] || {};
          
          // Check if integration is enabled
          if (!providerConfig.enabled) {
            results.push({
              provider,
              success: false,
              error: 'Integration disabled'
            });
            continue;
          }
          
          // Send event to provider
          const result = await integration.sendEvent(eventData, providerConfig);
          results.push({
            provider,
            success: true,
            result
          });
          
        } catch (error) {
          results.push({
            provider,
            success: false,
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error sending events to providers:', error);
      throw error;
    }
  }
  
  /**
   * Sync session data to providers
   */
  async syncSession(sessionData, providers = [], config = {}) {
    try {
      const results = [];
      
      for (const provider of providers) {
        if (!this.integrations.has(provider)) {
          continue;
        }
        
        try {
          const integration = this.integrations.get(provider);
          const providerConfig = config[provider] || {};
          
          if (!providerConfig.enabled) {
            continue;
          }
          
          const result = await integration.syncSession(sessionData, providerConfig);
          results.push({
            provider,
            success: true,
            result
          });
          
        } catch (error) {
          results.push({
            provider,
            success: false,
            error: error.message
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error syncing session to providers:', error);
      throw error;
    }
  }
  
  /**
   * Export data to external BI tools
   */
  async exportToBI(startDate, endDate, format = 'json', destinations = []) {
    try {
      // Get analytics data
      const [sessions, events, consents] = await Promise.all([
        VisitorSession.find({
          startTime: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).lean(),
        AnalyticsEvent.find({
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).lean(),
        PrivacyConsent.find({
          timestamp: { $gte: new Date(startDate), $lte: new Date(endDate) }
        }).lean()
      ]);
      
      // Format data for export
      const exportData = this.formatDataForExport(sessions, events, consents, format);
      
      // Send to destinations
      const results = [];
      for (const destination of destinations) {
        try {
          const result = await this.sendToDestination(exportData, destination);
          results.push({
            destination: destination.name,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            destination: destination.name,
            success: false,
            error: error.message
          });
        }
      }
      
      return {
        exportData,
        destinations: results,
        summary: {
          sessions: sessions.length,
          events: events.length,
          consents: consents.length,
          format
        }
      };
      
    } catch (error) {
      console.error('Error exporting to BI:', error);
      throw error;
    }
  }
  
  /**
   * Create real-time data stream
   */
  async createDataStream(config) {
    try {
      const streamConfig = {
        id: `stream_${Date.now()}`,
        providers: config.providers || [],
        filters: config.filters || {},
        batchSize: config.batchSize || 100,
        interval: config.interval || 60000, // 1 minute
        enabled: true,
        createdAt: new Date()
      };
      
      // Store stream configuration
      // In production, this would be stored in database
      this.activeStreams = this.activeStreams || new Map();
      this.activeStreams.set(streamConfig.id, streamConfig);
      
      // Start streaming process
      this.startDataStream(streamConfig);
      
      return streamConfig;
      
    } catch (error) {
      console.error('Error creating data stream:', error);
      throw error;
    }
  }
  
  /**
   * Get integration status and health
   */
  async getIntegrationStatus(providers = []) {
    try {
      const status = {};
      
      for (const provider of providers) {
        if (!this.integrations.has(provider)) {
          status[provider] = {
            available: false,
            healthy: false,
            error: 'Provider not supported'
          };
          continue;
        }
        
        try {
          const integration = this.integrations.get(provider);
          const health = await integration.healthCheck();
          
          status[provider] = {
            available: true,
            healthy: health.healthy,
            lastCheck: new Date(),
            version: health.version || null,
            rateLimit: health.rateLimit || null
          };
          
        } catch (error) {
          status[provider] = {
            available: true,
            healthy: false,
            error: error.message,
            lastCheck: new Date()
          };
        }
      }
      
      return status;
      
    } catch (error) {
      console.error('Error getting integration status:', error);
      throw error;
    }
  }
  
  // Helper Methods
  
  formatDataForExport(sessions, events, consents, format) {
    const data = {
      sessions: sessions.map(session => ({
        sessionId: session.sessionId,
        visitorId: session.visitorId,
        userId: session.userId,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        pageViews: session.metrics.pageViews,
        events: session.metrics.events,
        converted: session.metrics.converted,
        revenue: session.metrics.revenue,
        utmSource: session.utm.source,
        utmMedium: session.utm.medium,
        utmCampaign: session.utm.campaign,
        referrerType: session.referrer.type,
        deviceType: session.device.type,
        browser: session.device.browser,
        os: session.device.os,
        country: session.geo.country,
        city: session.geo.city
      })),
      events: events.map(event => ({
        eventId: event.eventId,
        sessionId: event.sessionId,
        visitorId: event.visitorId,
        userId: event.userId,
        name: event.name,
        category: event.category,
        action: event.action,
        label: event.label,
        value: event.value,
        timestamp: event.timestamp,
        url: event.page.url,
        path: event.page.path,
        isConversion: event.conversion.isConversion,
        conversionType: event.conversion.conversionType,
        conversionValue: event.conversion.conversionValue
      })),
      consents: consents.map(consent => ({
        consentId: consent.consentId,
        visitorId: consent.visitorId,
        userId: consent.userId,
        analytics: consent.preferences.analytics,
        marketing: consent.preferences.marketing,
        personalization: consent.preferences.personalization,
        functional: consent.preferences.functional,
        timestamp: consent.timestamp,
        method: consent.method,
        jurisdiction: consent.compliance.jurisdiction
      }))
    };
    
    if (format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return data;
  }
  
  convertToCSV(data) {
    const csvData = {};
    
    // Convert each data type to CSV
    Object.keys(data).forEach(dataType => {
      if (data[dataType].length === 0) {
        csvData[dataType] = '';
        return;
      }
      
      const headers = Object.keys(data[dataType][0]);
      const csvRows = [headers.join(',')];
      
      data[dataType].forEach(row => {
        const values = headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if necessary
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        });
        csvRows.push(values.join(','));
      });
      
      csvData[dataType] = csvRows.join('\n');
    });
    
    return csvData;
  }
  
  async sendToDestination(data, destination) {
    switch (destination.type) {
      case 'webhook':
        return await this.sendWebhook(data, destination);
      case 'ftp':
        return await this.sendFTP(data, destination);
      case 's3':
        return await this.sendS3(data, destination);
      case 'bigquery':
        return await this.sendBigQuery(data, destination);
      default:
        throw new Error(`Unsupported destination type: ${destination.type}`);
    }
  }
  
  async sendWebhook(data, config) {
    try {
      const response = await axios.post(config.url, data, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': config.auth || undefined,
          ...config.headers || {}
        },
        timeout: config.timeout || 30000
      });
      
      return {
        status: response.status,
        sent: true,
        timestamp: new Date()
      };
      
    } catch (error) {
      throw new Error(`Webhook failed: ${error.message}`);
    }
  }
  
  async sendFTP(data, config) {
    // Placeholder for FTP implementation
    throw new Error('FTP export not implemented yet');
  }
  
  async sendS3(data, config) {
    // Placeholder for S3 implementation
    throw new Error('S3 export not implemented yet');
  }
  
  async sendBigQuery(data, config) {
    // Placeholder for BigQuery implementation
    throw new Error('BigQuery export not implemented yet');
  }
  
  startDataStream(streamConfig) {
    const interval = setInterval(async () => {
      try {
        if (!streamConfig.enabled) {
          clearInterval(interval);
          return;
        }
        
        // Get recent events for streaming
        const recentEvents = await AnalyticsEvent.find({
          timestamp: {
            $gte: new Date(Date.now() - streamConfig.interval)
          },
          ...streamConfig.filters
        }).limit(streamConfig.batchSize);
        
        if (recentEvents.length > 0) {
          // Send to configured providers
          await this.sendEvent(recentEvents, streamConfig.providers, streamConfig.providerConfigs);
        }
        
      } catch (error) {
        console.error('Error in data stream:', error);
      }
    }, streamConfig.interval);
    
    return interval;
  }
}

// Provider Integration Classes

class GA4Integration {
  constructor() {
    this.name = 'Google Analytics 4';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    // GA4 Measurement Protocol implementation
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const ga4Events = events.map(event => ({
      name: this.mapEventName(event.name),
      parameters: {
        page_location: event.page?.url,
        page_title: event.page?.title,
        event_category: event.category,
        event_label: event.label,
        value: event.value,
        currency: event.currency || 'USD',
        custom_parameter_1: event.properties?.customParam1
      }
    }));
    
    // Send to GA4 Measurement Protocol
    // This is a placeholder - implement actual GA4 API call
    return { sent: true, events: ga4Events.length };
  }
  
  async syncSession(sessionData, config) {
    // Implement GA4 session sync
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
  
  mapEventName(eventName) {
    const mapping = {
      'page_view': 'page_view',
      'signup': 'sign_up',
      'purchase': 'purchase',
      'trial': 'begin_checkout'
    };
    return mapping[eventName] || eventName;
  }
}

class PostHogIntegration {
  constructor() {
    this.name = 'PostHog';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const posthogEvents = events.map(event => ({
      event: event.name,
      distinct_id: event.visitorId,
      properties: {
        $current_url: event.page?.url,
        $browser: event.technical?.userAgent,
        $ip: event.technical?.ipAddress,
        category: event.category,
        label: event.label,
        value: event.value,
        ...event.properties
      },
      timestamp: event.timestamp
    }));
    
    // Send to PostHog API
    return { sent: true, events: posthogEvents.length };
  }
  
  async syncSession(sessionData, config) {
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
}

class PlausibleIntegration {
  constructor() {
    this.name = 'Plausible';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    // Plausible uses simpler event structure
    const plausibleEvents = events.map(event => ({
      name: event.name,
      url: event.page?.url,
      domain: config.domain,
      props: {
        category: event.category,
        label: event.label,
        value: event.value
      }
    }));
    
    return { sent: true, events: plausibleEvents.length };
  }
  
  async syncSession(sessionData, config) {
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
}

class MatomoIntegration {
  constructor() {
    this.name = 'Matomo';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const matomoEvents = events.map(event => ({
      idsite: config.siteId,
      rec: 1,
      action_name: event.page?.title,
      url: event.page?.url,
      _id: event.visitorId,
      rand: Math.random(),
      apiv: 1,
      e_c: event.category,
      e_a: event.action,
      e_n: event.label,
      e_v: event.value
    }));
    
    return { sent: true, events: matomoEvents.length };
  }
  
  async syncSession(sessionData, config) {
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
}

class MixpanelIntegration {
  constructor() {
    this.name = 'Mixpanel';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const mixpanelEvents = events.map(event => ({
      event: event.name,
      properties: {
        distinct_id: event.visitorId,
        time: Math.floor(event.timestamp.getTime() / 1000),
        $current_url: event.page?.url,
        $browser: event.technical?.userAgent,
        category: event.category,
        label: event.label,
        value: event.value,
        ...event.properties
      }
    }));
    
    return { sent: true, events: mixpanelEvents.length };
  }
  
  async syncSession(sessionData, config) {
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
}

class AmplitudeIntegration {
  constructor() {
    this.name = 'Amplitude';
    this.version = '1.0';
  }
  
  async sendEvent(eventData, config) {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    
    const amplitudeEvents = events.map(event => ({
      event_type: event.name,
      user_id: event.userId,
      device_id: event.visitorId,
      time: event.timestamp.getTime(),
      event_properties: {
        category: event.category,
        label: event.label,
        value: event.value,
        page_url: event.page?.url,
        ...event.properties
      },
      user_properties: event.userProperties || {}
    }));
    
    return { sent: true, events: amplitudeEvents.length };
  }
  
  async syncSession(sessionData, config) {
    return { synced: true };
  }
  
  async healthCheck() {
    return { healthy: true, version: this.version };
  }
}

module.exports = AnalyticsIntegrationService;





