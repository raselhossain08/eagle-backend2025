const VisitorSession = require('../models/visitorSession.model');
const AnalyticsEvent = require('../models/analyticsEvent.model');
const PrivacyConsent = require('../models/privacyConsent.model');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const crypto = require('crypto');

class AnalyticsDataCaptureService {
  
  /**
   * Initialize a new visitor session
   */
  async initializeSession(req, customData = {}) {
    try {
      const userAgent = req.headers['user-agent'] || '';
      const ip = this.getClientIP(req);
      const parser = new UAParser(userAgent);
      const geo = geoip.lookup(ip);
      
      // Generate visitor ID if not provided
      const visitorId = customData.visitorId || this.generateVisitorId(req);
      const sessionId = this.generateSessionId(visitorId);
      
      // Extract UTM parameters
      const utm = this.extractUTMParameters(req);
      
      // Determine referrer type
      const referrer = this.parseReferrer(req.headers.referer, req.headers.host);
      
      // Parse device information
      const device = this.parseDeviceInfo(parser);
      
      // Parse geographic information
      const geoInfo = this.parseGeoInfo(geo, ip);
      
      // Check for existing consent
      const consent = await PrivacyConsent.findActiveConsent(visitorId, customData.userId);
      
      // Create session
      const session = new VisitorSession({
        sessionId,
        visitorId,
        userId: customData.userId || null,
        utm,
        referrer,
        device,
        geo: geoInfo,
        privacy: {
          ipAddress: consent && consent.privacySettings.ipAnonymization ? null : ip,
          ipAnonymized: consent ? consent.privacySettings.ipAnonymization : false,
          consentGiven: consent ? consent.status === 'active' : false,
          consentTimestamp: consent ? consent.timestamp : null,
          consentVersion: consent ? consent.consentVersion : null,
          cookiesEnabled: !consent || !consent.privacySettings.cookielessMode,
          doNotTrack: req.headers['dnt'] === '1' || (consent && consent.privacySettings.doNotTrack)
        },
        landingPage: {
          url: req.url,
          title: customData.pageTitle || null,
          timestamp: new Date()
        },
        ...customData
      });
      
      // Anonymize IP if needed
      if (session.privacy.ipAnonymized) {
        session.anonymizeIP();
      }
      
      await session.save();
      
      // Track session start event
      await this.trackEvent(req, {
        sessionId,
        visitorId,
        userId: customData.userId,
        name: 'session_start',
        category: 'system',
        action: 'start',
        page: {
          url: req.url,
          title: customData.pageTitle,
          path: req.path
        }
      });
      
      return session;
      
    } catch (error) {
      console.error('Error initializing session:', error);
      throw error;
    }
  }
  
  /**
   * Track an analytics event
   */
  async trackEvent(req, eventData) {
    try {
      // Check for consent first
      const consent = await PrivacyConsent.findActiveConsent(
        eventData.visitorId, 
        eventData.userId
      );
      
      // If no consent and tracking requires consent, skip
      if (!consent || !consent.hasConsentFor('analytics')) {
        if (eventData.category !== 'essential' && eventData.category !== 'system') {
          return null; // Skip non-essential tracking without consent
        }
      }
      
      const userAgent = req.headers['user-agent'] || '';
      const ip = this.getClientIP(req);
      const parser = new UAParser(userAgent);
      
      // Generate event ID
      const eventId = this.generateEventId();
      
      // Prepare event data
      const event = new AnalyticsEvent({
        eventId,
        sessionId: eventData.sessionId,
        visitorId: eventData.visitorId,
        userId: eventData.userId || null,
        name: eventData.name,
        category: eventData.category,
        action: eventData.action,
        label: eventData.label || null,
        value: eventData.value || null,
        currency: eventData.currency || 'USD',
        page: {
          url: eventData.page?.url || req.url,
          title: eventData.page?.title || null,
          path: eventData.page?.path || req.path,
          referrer: req.headers.referer || null,
          queryParams: req.query || {},
          hash: eventData.page?.hash || null
        },
        interaction: eventData.interaction || {},
        conversion: eventData.conversion || { isConversion: false },
        ecommerce: eventData.ecommerce || {},
        technical: {
          userAgent,
          ipAddress: consent && consent.privacySettings.ipAnonymization ? null : ip,
          ipAnonymized: consent ? consent.privacySettings.ipAnonymization : false,
          devicePixelRatio: eventData.technical?.devicePixelRatio || null,
          viewportSize: eventData.technical?.viewportSize || {},
          connectionType: eventData.technical?.connectionType || null,
          loadTime: eventData.technical?.loadTime || null
        },
        privacy: {
          consentGiven: consent ? consent.status === 'active' : false,
          consentTypes: {
            analytics: consent ? consent.hasConsentFor('analytics') : false,
            marketing: consent ? consent.hasConsentFor('marketing') : false,
            personalization: consent ? consent.hasConsentFor('personalization') : false
          },
          cookielessMode: consent ? consent.privacySettings.cookielessMode : false,
          doNotTrack: req.headers['dnt'] === '1' || (consent && consent.privacySettings.doNotTrack)
        },
        experiments: eventData.experiments || [],
        personalization: eventData.personalization || {},
        properties: eventData.properties || {},
        quality: this.assessEventQuality(eventData, req),
        attribution: eventData.attribution || {},
        metadata: eventData.metadata || {},
        serverTimestamp: new Date(),
        processingDelay: eventData.clientTimestamp ? 
          Date.now() - new Date(eventData.clientTimestamp).getTime() : 0
      });
      
      // Anonymize data if needed
      if (event.privacy.doNotTrack || 
          (consent && consent.privacySettings.ipAnonymization)) {
        event.anonymizeData();
      }
      
      await event.save();
      
      // Update session metrics
      await this.updateSessionMetrics(eventData.sessionId, event);
      
      // Process real-time analytics
      await this.processRealTimeAnalytics(event);
      
      return event;
      
    } catch (error) {
      console.error('Error tracking event:', error);
      throw error;
    }
  }
  
  /**
   * Track page view
   */
  async trackPageView(req, pageData) {
    const eventData = {
      name: 'page_view',
      category: 'page_view',
      action: 'view',
      page: pageData.page,
      interaction: {
        timeOnPage: pageData.timeOnPage || null,
        scrollDepth: pageData.scrollDepth || null
      },
      technical: pageData.technical || {},
      properties: pageData.properties || {},
      ...pageData
    };
    
    return await this.trackEvent(req, eventData);
  }
  
  /**
   * Track conversion event
   */
  async trackConversion(req, conversionData) {
    const eventData = {
      name: conversionData.name || 'conversion',
      category: 'conversion',
      action: conversionData.action || 'convert',
      value: conversionData.value || 0,
      currency: conversionData.currency || 'USD',
      conversion: {
        isConversion: true,
        conversionType: conversionData.type,
        conversionValue: conversionData.value || 0,
        funnelStep: conversionData.funnelStep || null,
        goalId: conversionData.goalId || null
      },
      ecommerce: conversionData.ecommerce || {},
      properties: conversionData.properties || {},
      ...conversionData
    };
    
    const event = await this.trackEvent(req, eventData);
    
    // Update session conversion status
    if (event) {
      await VisitorSession.findOneAndUpdate(
        { sessionId: conversionData.sessionId },
        { 
          $set: { 'metrics.converted': true },
          $inc: { 'metrics.revenue': conversionData.value || 0 },
          $push: {
            conversions: {
              type: conversionData.type,
              timestamp: new Date(),
              value: conversionData.value || 0,
              currency: conversionData.currency || 'USD',
              metadata: conversionData.metadata || {}
            }
          }
        }
      );
    }
    
    return event;
  }
  
  /**
   * Track user interaction
   */
  async trackInteraction(req, interactionData) {
    const eventData = {
      name: interactionData.name || 'interaction',
      category: 'user_interaction',
      action: interactionData.action,
      label: interactionData.label || null,
      interaction: {
        elementId: interactionData.elementId || null,
        elementClass: interactionData.elementClass || null,
        elementText: interactionData.elementText || null,
        elementType: interactionData.elementType || null,
        coordinates: interactionData.coordinates || {},
        scrollDepth: interactionData.scrollDepth || null,
        timeOnPage: interactionData.timeOnPage || null
      },
      properties: interactionData.properties || {},
      ...interactionData
    };
    
    return await this.trackEvent(req, eventData);
  }
  
  /**
   * End a session
   */
  async endSession(sessionId, endData = {}) {
    try {
      const session = await VisitorSession.findOne({ sessionId });
      if (!session) {
        throw new Error('Session not found');
      }
      
      // Set exit page
      if (endData.exitPage) {
        session.exitPage = {
          url: endData.exitPage.url,
          title: endData.exitPage.title || null,
          timestamp: new Date()
        };
      }
      
      // Calculate final metrics
      session.metrics.bounced = session.metrics.pageViews <= 1;
      
      // Calculate engagement score
      session.quality.engagementScore = this.calculateEngagementScore(session);
      
      await session.endSession();
      
      // Track session end event
      await this.trackEvent({ url: session.exitPage?.url || '', path: '/' }, {
        sessionId,
        visitorId: session.visitorId,
        userId: session.userId,
        name: 'session_end',
        category: 'system',
        action: 'end',
        value: session.duration,
        properties: {
          duration: session.duration,
          pageViews: session.metrics.pageViews,
          events: session.metrics.events,
          bounced: session.metrics.bounced,
          converted: session.metrics.converted,
          engagementScore: session.quality.engagementScore
        }
      });
      
      return session;
      
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }
  
  /**
   * Process consent update
   */
  async updateConsent(req, consentData) {
    try {
      const visitorId = consentData.visitorId;
      const userId = consentData.userId || null;
      
      // Find existing consent
      let consent = await PrivacyConsent.findActiveConsent(visitorId, userId);
      
      if (consent) {
        // Update existing consent
        await consent.updatePreferences(consentData.preferences, consentData.method);
      } else {
        // Create new consent
        const ip = this.getClientIP(req);
        const geo = geoip.lookup(ip);
        
        consent = new PrivacyConsent({
          visitorId,
          userId,
          sessionId: consentData.sessionId,
          preferences: {
            essential: true,
            analytics: consentData.preferences.analytics || false,
            marketing: consentData.preferences.marketing || false,
            personalization: consentData.preferences.personalization || false,
            functional: consentData.preferences.functional || false
          },
          method: consentData.method || 'banner',
          source: consentData.source || 'website',
          context: {
            url: req.url,
            userAgent: req.headers['user-agent'],
            ipAddress: ip,
            language: req.headers['accept-language']?.split(',')[0] || 'en',
            country: geo?.country || null,
            region: geo?.region || null
          },
          privacySettings: consentData.privacySettings || {},
          compliance: consentData.compliance || {}
        });
        
        // Anonymize IP if requested
        if (consent.privacySettings.ipAnonymization) {
          consent.anonymizePersonalData();
        }
        
        await consent.save();
      }
      
      // Track consent event
      await this.trackEvent(req, {
        sessionId: consentData.sessionId,
        visitorId,
        userId,
        name: 'consent_updated',
        category: 'system',
        action: 'consent',
        properties: {
          analytics: consent.preferences.analytics,
          marketing: consent.preferences.marketing,
          personalization: consent.preferences.personalization,
          functional: consent.preferences.functional,
          method: consentData.method
        }
      });
      
      return consent;
      
    } catch (error) {
      console.error('Error updating consent:', error);
      throw error;
    }
  }
  
  /**
   * Batch process events for high-volume scenarios
   */
  async batchTrackEvents(req, events) {
    try {
      const results = [];
      
      for (const eventData of events) {
        try {
          const event = await this.trackEvent(req, eventData);
          results.push({ success: true, event });
        } catch (error) {
          results.push({ success: false, error: error.message, eventData });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('Error batch tracking events:', error);
      throw error;
    }
  }
  
  // Helper Methods
  
  generateVisitorId(req) {
    const userAgent = req.headers['user-agent'] || '';
    const ip = this.getClientIP(req);
    const timestamp = Date.now();
    
    return crypto
      .createHash('sha256')
      .update(`${ip}-${userAgent}-${timestamp}`)
      .digest('hex')
      .substring(0, 32);
  }
  
  generateSessionId(visitorId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${visitorId.substring(0, 8)}-${timestamp}-${random}`;
  }
  
  generateEventId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `evt_${timestamp}_${random}`;
  }
  
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }
  
  extractUTMParameters(req) {
    const query = req.query || {};
    return {
      source: query.utm_source || null,
      medium: query.utm_medium || null,
      campaign: query.utm_campaign || null,
      term: query.utm_term || null,
      content: query.utm_content || null
    };
  }
  
  parseReferrer(referrerUrl, currentHost) {
    if (!referrerUrl) {
      return { url: null, domain: null, type: 'direct' };
    }
    
    try {
      const referrerDomain = new URL(referrerUrl).hostname;
      
      // Same domain = internal
      if (referrerDomain === currentHost) {
        return { url: referrerUrl, domain: referrerDomain, type: 'internal' };
      }
      
      // Determine referrer type
      let type = 'referral';
      if (this.isSearchEngine(referrerDomain)) {
        type = 'organic';
      } else if (this.isSocialMedia(referrerDomain)) {
        type = 'social';
      }
      
      return { url: referrerUrl, domain: referrerDomain, type };
      
    } catch (error) {
      return { url: referrerUrl, domain: null, type: 'unknown' };
    }
  }
  
  parseDeviceInfo(parser) {
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    
    let deviceType = 'unknown';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';
    else if (!device.type || device.type === 'undefined') deviceType = 'desktop';
    else deviceType = device.type;
    
    return {
      type: deviceType,
      browser: browser.name || null,
      browserVersion: browser.version || null,
      os: os.name || null,
      osVersion: os.version || null,
      userAgent: parser.getUA()
    };
  }
  
  parseGeoInfo(geo, ip) {
    if (!geo) {
      return {
        country: null,
        countryCode: null,
        region: null,
        city: null,
        latitude: null,
        longitude: null,
        timezone: null
      };
    }
    
    return {
      country: geo.country || null,
      countryCode: geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      latitude: geo.ll ? geo.ll[0] : null,
      longitude: geo.ll ? geo.ll[1] : null,
      timezone: geo.timezone || null
    };
  }
  
  isSearchEngine(domain) {
    const searchEngines = [
      'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com',
      'baidu.com', 'yandex.com', 'ask.com', 'aol.com'
    ];
    return searchEngines.some(engine => domain.includes(engine));
  }
  
  isSocialMedia(domain) {
    const socialSites = [
      'facebook.com', 'twitter.com', 'instagram.com', 'linkedin.com',
      'youtube.com', 'tiktok.com', 'snapchat.com', 'pinterest.com',
      'reddit.com', 'tumblr.com'
    ];
    return socialSites.some(site => domain.includes(site));
  }
  
  assessEventQuality(eventData, req) {
    let qualityScore = 100;
    const validationErrors = [];
    
    // Check for bot-like behavior
    const userAgent = req.headers['user-agent'] || '';
    const isBot = this.isLikelyBot(userAgent);
    
    if (isBot) {
      qualityScore -= 50;
      validationErrors.push('Potential bot detected');
    }
    
    // Check for suspicious patterns
    const isSuspicious = this.isSuspiciousActivity(eventData, req);
    
    if (isSuspicious) {
      qualityScore -= 30;
      validationErrors.push('Suspicious activity pattern');
    }
    
    // Validate required fields
    if (!eventData.name || !eventData.category || !eventData.action) {
      qualityScore -= 20;
      validationErrors.push('Missing required event fields');
    }
    
    return {
      isValid: qualityScore > 50,
      isBot,
      isSuspicious,
      qualityScore: Math.max(0, qualityScore),
      validationErrors
    };
  }
  
  isLikelyBot(userAgent) {
    const botPatterns = [
      /bot/i, /spider/i, /crawler/i, /scraper/i,
      /googlebot/i, /bingbot/i, /facebookexternalhit/i,
      /twitterbot/i, /linkedinbot/i
    ];
    
    return botPatterns.some(pattern => pattern.test(userAgent));
  }
  
  isSuspiciousActivity(eventData, req) {
    // Implement suspicious activity detection logic
    // This is a simplified example
    
    const ip = this.getClientIP(req);
    
    // Check for rapid-fire events (would need session context)
    // Check for unusual geographic patterns
    // Check for impossible user behavior
    
    return false; // Simplified
  }
  
  calculateEngagementScore(session) {
    let score = 0;
    
    // Time on site (max 40 points)
    const durationMinutes = session.duration / 60;
    score += Math.min(40, durationMinutes * 2);
    
    // Page views (max 30 points)
    score += Math.min(30, session.metrics.pageViews * 5);
    
    // Events (max 20 points)
    score += Math.min(20, session.metrics.events * 2);
    
    // Conversion (10 points)
    if (session.metrics.converted) {
      score += 10;
    }
    
    return Math.min(100, score);
  }
  
  async updateSessionMetrics(sessionId, event) {
    const updateData = {
      $inc: { 'metrics.events': 1 },
      $set: { lastActivity: new Date() }
    };
    
    if (event.category === 'page_view') {
      updateData.$inc['metrics.pageViews'] = 1;
      
      // Check if it's a unique page view
      const existingPageView = await AnalyticsEvent.findOne({
        sessionId,
        category: 'page_view',
        'page.path': event.page.path
      });
      
      if (!existingPageView) {
        updateData.$inc['metrics.uniquePageViews'] = 1;
      }
    }
    
    await VisitorSession.findOneAndUpdate({ sessionId }, updateData);
  }
  
  async processRealTimeAnalytics(event) {
    // Implement real-time analytics processing
    // This could include:
    // - Updating real-time dashboards
    // - Triggering alerts
    // - Updating counters
    // - Publishing to real-time streams
    
    // For now, just mark as processed
    await event.markAsProcessed();
  }
}

module.exports = AnalyticsDataCaptureService;





