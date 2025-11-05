const AnalyticsService = require('../../services/analytics.service');

/**
 * @desc    Track a page view
 * @route   POST /api/analytics/track/pageview
 * @access  Public
 */
const trackPageView = async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      page,
      referrer,
      userAgent,
      deviceType,
      trafficSource,
      duration = 0
    } = req.body;

    // Validate required fields
    if (!sessionId || !page || !deviceType || !trafficSource) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId, page, deviceType, trafficSource'
      });
    }

    // Get IP address
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    const pageViewData = {
      sessionId,
      userId,
      page,
      referrer,
      userAgent,
      ipAddress,
      deviceType,
      trafficSource,
      duration,
      timestamp: new Date()
    };

    const pageView = await AnalyticsService.trackPageView(pageViewData);

    res.status(201).json({
      success: true,
      message: 'Page view tracked successfully',
      data: {
        id: pageView._id,
        sessionId: pageView.sessionId,
        page: pageView.page,
        timestamp: pageView.timestamp
      }
    });

  } catch (error) {
    console.error('Error tracking page view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track page view',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Track an event
 * @route   POST /api/analytics/track/event
 * @access  Public
 */
const trackEvent = async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      page,
      properties
    } = req.body;

    // Validate required fields
    if (!sessionId || !eventType || !eventCategory || !eventAction) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sessionId, eventType, eventCategory, eventAction'
      });
    }

    const eventData = {
      sessionId,
      userId,
      eventType,
      eventCategory,
      eventAction,
      eventLabel,
      eventValue,
      page,
      properties,
      timestamp: new Date()
    };

    const event = await AnalyticsService.trackEvent(eventData);

    res.status(201).json({
      success: true,
      message: 'Event tracked successfully',
      data: {
        id: event._id,
        sessionId: event.sessionId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        eventAction: event.eventAction,
        timestamp: event.timestamp
      }
    });

  } catch (error) {
    console.error('Error tracking event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track event',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Update user session
 * @route   POST /api/analytics/track/session
 * @access  Public
 */
const updateSession = async (req, res) => {
  try {
    const {
      sessionId,
      userId,
      startTime,
      endTime,
      duration,
      deviceInfo,
      location,
      trafficSource
    } = req.body;

    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: sessionId'
      });
    }

    const sessionData = {
      sessionId,
      userId,
      startTime,
      endTime,
      duration,
      deviceInfo,
      location,
      trafficSource,
      isActive: !endTime // Session is active if no end time
    };

    // Remove undefined values
    Object.keys(sessionData).forEach(key => {
      if (sessionData[key] === undefined) {
        delete sessionData[key];
      }
    });

    const session = await AnalyticsService.updateSession(sessionId, sessionData);

    res.json({
      success: true,
      message: 'Session updated successfully',
      data: {
        sessionId: session.sessionId,
        userId: session.userId,
        startTime: session.startTime,
        duration: session.duration,
        isActive: session.isActive
      }
    });

  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Generate sample analytics data (development only)
 * @route   POST /api/analytics/generate-sample-data
 * @access  Private
 */
const generateSampleData = async (req, res) => {
  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        message: 'Sample data generation is only available in development mode'
      });
    }

    const count = await AnalyticsService.generateSampleData();

    res.json({
      success: true,
      message: `Generated ${count} sample analytics records`,
      data: { count }
    });

  } catch (error) {
    console.error('Error generating sample data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate sample data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  trackPageView,
  trackEvent,
  updateSession,
  generateSampleData
};





