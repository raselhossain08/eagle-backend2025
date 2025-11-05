# 📊 Analytics System Documentation

## 🔍 System Overview

The Eagle Backend 2025 Analytics System is a comprehensive, privacy-first web analytics platform that provides:

- **Real-time Analytics** - Live visitor tracking and engagement metrics
- **Conversion Funnels** - Multi-step conversion tracking and optimization
- **Privacy Compliance** - GDPR-compliant data collection with consent management
- **Advanced Segmentation** - User behavior analysis and audience insights
- **Custom Events** - Flexible event tracking for any user interaction
- **Dashboard APIs** - Complete REST API for analytics dashboard integration

---

## 📁 Analytics Module Structure

```
src/analytics/
├── index.js                           # Main module exports
├── controllers/
│   ├── analytics/                     # Analytics controllers
│   │   ├── getMetrics.js             # Dashboard metrics
│   │   ├── getTrafficSources.js      # Traffic source analysis
│   │   ├── getTopPages.js            # Page performance
│   │   ├── getDeviceBreakdown.js     # Device/browser stats
│   │   ├── getConversionFunnel.js    # Funnel analytics
│   │   ├── getEvents.js              # Custom events
│   │   └── trackingController.js     # Public tracking endpoints
│   ├── campaign.controller.js         # Campaign management
│   ├── reporting.controller.js        # Report generation
│   └── visitorAnalytics.controller.js # Visitor insights
├── models/
│   ├── analytics.model.js            # Core analytics schemas
│   ├── analyticsEvent.model.js       # Event tracking
│   ├── campaign.model.js             # Campaign data
│   ├── promotionalCampaign.model.js  # Marketing campaigns
│   ├── reporting.model.js            # Report configurations
│   └── visitorSession.model.js       # Session management
├── routes/
│   ├── analytics.routes.js           # Main analytics routes
│   ├── campaign.routes.js            # Campaign routes
│   ├── reporting.routes.js           # Reporting routes
│   └── visitorAnalytics.routes.js    # Visitor routes
└── services/
    ├── analytics.service.js          # Core analytics logic
    ├── analyticsCapture.service.js   # Data collection
    ├── analyticsDashboard.service.js # Dashboard data
    ├── analyticsIntegration.service.js # Third-party integrations
    ├── campaign.service.js           # Campaign management
    ├── campaignAttribution.service.js # Attribution modeling
    └── reporting.service.js          # Report generation
```

---

## 🗄️ Database Schema Overview

### AnalyticsEvent
Primary event tracking model for all user interactions:

```javascript
{
  id: String,                    # Unique event ID
  sessionId: String,             # Session identifier
  userId: String,                # User ID (if authenticated)
  visitorId: String,             # Anonymous visitor ID
  
  event: {
    name: String,                # Event name (page_view, button_click, etc.)
    category: String,            # Event category (navigation, engagement, etc.)
    action: String,              # Action taken (click, submit, view, etc.)
    label: String,               # Additional context
    value: Number,               # Numeric value
    properties: Map              # Custom event properties
  },
  
  page: {
    url: String,                 # Full page URL
    path: String,                # URL path
    title: String,               # Page title
    referrer: String,            # Referring URL
    loadTime: Number,            # Page load performance metrics
    // ... other performance metrics
  },
  
  utm: {
    source: String,              # UTM source
    medium: String,              # UTM medium
    campaign: String,            # UTM campaign
    term: String,                # UTM term
    content: String              # UTM content
  },
  
  technical: {
    device: {
      type: String,              # desktop, mobile, tablet
      brand: String,             # Device manufacturer
      screenResolution: String,  # Screen size
      // ... other device info
    },
    browser: { /* browser details */ },
    os: { /* operating system info */ },
    network: { /* network conditions */ }
  },
  
  location: {
    ipAddress: String,           # User IP (anonymized)
    country: String,             # Country
    region: String,              # State/region
    city: String,                # City
    timezone: String,            # User timezone
    coordinates: {               # GPS (if consented)
      latitude: Number,
      longitude: Number
    }
  },
  
  privacy: {
    consentMode: String,         # granted, denied, unknown
    analyticsConsent: Boolean,   # Analytics tracking consent
    advertisingConsent: Boolean, # Advertising consent
    gdprApplies: Boolean,        # GDPR compliance flag
    // ... other privacy settings
  },
  
  conversion: {
    isConversion: Boolean,       # Is this a conversion event?
    conversionType: String,      # Type of conversion
    conversionValue: Number,     # Monetary value
    funnelStep: String,          # Which funnel step
    // ... other conversion data
  },
  
  engagement: {
    timeOnPage: Number,          # Time spent on page (seconds)
    scrollDepth: Number,         # Scroll percentage
    clickDepth: Number,          # Number of clicks
    formInteractions: Number,    # Form interactions
    // ... other engagement metrics
  },
  
  timestamp: Date,               # Event timestamp
  serverTimestamp: Date          # Server processing time
}
```

### AnalyticsSession
Session-level aggregation and tracking:

```javascript
{
  id: String,                    # Session ID
  visitorId: String,             # Visitor identifier
  userId: String,                # User ID (if authenticated)
  
  session: {
    startTime: Date,             # Session start
    endTime: Date,               # Session end
    duration: Number,            # Total duration (seconds)
    isActive: Boolean,           # Is session active?
    
    entryPage: String,           # First page visited
    exitPage: String,            # Last page visited
    pageViews: Number,           # Total page views
    events: Number,              # Total events
    interactions: Number,        # User interactions
    
    isBounce: Boolean,           # Single-page session?
    hasConversion: Boolean,      # Did session convert?
    conversions: [String],       # Types of conversions
    conversionValue: Number      # Total conversion value
  },
  
  attribution: {
    firstTouch: {                # First-touch attribution
      source: String,
      medium: String,
      campaign: String,
      timestamp: Date
    },
    lastTouch: { /* last-touch data */ },
    channel: String,             # Marketing channel
    touchpoints: [{ /* multi-touch data */ }]
  },
  
  technology: {                  # Session technology info
    device: String,
    browser: String,
    os: String,
    language: String
  },
  
  geography: {                   # Geographic data
    country: String,
    region: String,
    city: String,
    timezone: String
  }
}
```

### AnalyticsVisitor
Visitor-level data and segmentation:

```javascript
{
  id: String,                    # Visitor ID
  userId: String,                # User ID (if linked)
  
  identity: {
    isAuthenticated: Boolean,    # Is visitor authenticated?
    email: String,               # Email (if available)
    fingerprint: String,         # Device fingerprint
    crossDeviceId: String        # Cross-device identifier
  },
  
  firstVisit: {
    timestamp: Date,             # First visit time
    page: String,                # Landing page
    referrer: String,            # Original referrer
    utm: { /* UTM parameters */ },
    location: { /* geographic data */ }
  },
  
  metrics: {
    totalSessions: Number,       # Total sessions
    totalPageViews: Number,      # Total page views
    totalEvents: Number,         # Total events
    totalTimeOnSite: Number,     # Total time (seconds)
    
    averageSessionDuration: Number,
    bounceRate: Number,
    conversions: Number,
    conversionRate: Number,
    totalConversionValue: Number,
    
    engagementScore: Number      # 0-100 engagement score
  },
  
  segments: [String],            # Behavioral segments
  technology: { /* preferred tech */ },
  privacy: { /* privacy settings */ }
}
```

---

## 🔄 API Endpoints Reference

### 🔓 Public Tracking APIs

#### Track Page View
```http
POST /api/analytics/track/pageview
Content-Type: application/json

{
  "sessionId": "session_12345",
  "userId": "user_123",           // optional
  "page": "/pricing",
  "referrer": "https://google.com",
  "userAgent": "Mozilla/5.0...",
  "deviceType": "desktop",        // desktop, mobile, tablet
  "trafficSource": "organic",     // organic, paid, direct, social, referral
  "duration": 45000,              // time spent (ms)
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "summer2025"
  }
}

Response: 201 Created
{
  "success": true,
  "eventId": "evt_789",
  "message": "Page view tracked successfully"
}
```

#### Track Custom Event
```http
POST /api/analytics/track/event
Content-Type: application/json

{
  "sessionId": "session_12345",
  "eventType": "button_click",
  "eventCategory": "engagement",
  "eventAction": "click",
  "eventLabel": "signup_button",
  "eventValue": 1,
  "page": "/pricing",
  "properties": {
    "button_id": "cta-signup",
    "button_text": "Start Free Trial",
    "position": "header"
  }
}

Response: 201 Created
{
  "success": true,
  "eventId": "evt_790",
  "message": "Event tracked successfully"
}
```

### 🔒 Protected Analytics APIs

#### Get Dashboard Metrics
```http
GET /api/analytics/metrics?range=30d
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "title": "Total Page Views",
      "value": "12,456",
      "change": "+15.2%",
      "trend": "up",
      "icon": "BarChart3",
      "color": "text-blue-600"
    }
    // ... more metrics
  ],
  "range": "30d",
  "timestamp": "2025-11-05T10:30:00Z"
}
```

#### Get Traffic Sources
```http
GET /api/analytics/traffic?range=30d&limit=10
Authorization: Bearer <jwt_token>

Response: 200 OK
{
  "success": true,
  "data": {
    "sources": [
      {
        "name": "Google Organic",
        "visitors": 1250,
        "sessions": 1580,
        "bounceRate": 32.5,
        "avgSessionDuration": 205,
        "conversionRate": 3.2,
        "percentage": 36.4
      }
      // ... more sources
    ],
    "total": 3434
  }
}
```

---

## 🎨 Frontend Integration Guide

### React Analytics Dashboard
```jsx
import React, { useState, useEffect } from 'react';
import { AnalyticsAPI } from './api/analytics';

const AnalyticsDashboard = () => {
  const [metrics, setMetrics] = useState([]);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await AnalyticsAPI.getMetrics(timeRange);
        setMetrics(response.data);
      } catch (error) {
        console.error('Analytics fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [timeRange]);

  if (loading) return <AnalyticsLoader />;

  return (
    <div className="analytics-dashboard">
      <DashboardHeader 
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
      />
      
      <MetricsGrid metrics={metrics} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <TrafficSourcesChart timeRange={timeRange} />
        <DeviceBreakdownChart timeRange={timeRange} />
        <TopPagesTable timeRange={timeRange} />
        <ConversionFunnel timeRange={timeRange} />
      </div>
    </div>
  );
};

// Metrics Grid Component
const MetricsGrid = ({ metrics }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {metrics.map((metric, index) => (
      <MetricCard key={index} {...metric} />
    ))}
  </div>
);

const MetricCard = ({ title, value, change, trend, icon, color }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div className={`flex items-center ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
        {trend === 'up' ? <TrendingUp /> : <TrendingDown />}
        <span className="ml-1 text-sm font-medium">{change}</span>
      </div>
    </div>
    <div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);
```

### Analytics Tracking Hook
```jsx
import { useEffect, useCallback } from 'react';
import { AnalyticsTracker } from './analytics-tracker';

export const useAnalyticsTracking = () => {
  const tracker = new AnalyticsTracker();

  const trackPageView = useCallback((additionalData = {}) => {
    tracker.trackPageView(additionalData);
  }, [tracker]);

  const trackEvent = useCallback((eventName, eventData = {}) => {
    tracker.trackEvent(eventName, eventData);
  }, [tracker]);

  const trackConversion = useCallback((conversionType, value = 0, properties = {}) => {
    tracker.trackConversion(conversionType, value, properties);
  }, [tracker]);

  // Auto-track page views on route changes
  useEffect(() => {
    trackPageView();
  }, [trackPageView]);

  return {
    trackPageView,
    trackEvent,
    trackConversion
  };
};

// Usage in components
const HomePage = () => {
  const { trackEvent, trackConversion } = useAnalyticsTracking();

  const handleSignupClick = () => {
    trackEvent('signup_click', {
      category: 'conversion',
      action: 'click',
      label: 'hero_cta'
    });
  };

  const handleSignupComplete = (userId) => {
    trackConversion('signup_completed', 0, {
      user_id: userId,
      signup_method: 'email'
    });
  };

  return (
    <div>
      <button onClick={handleSignupClick}>
        Sign Up Now
      </button>
    </div>
  );
};
```

---

## 🔧 Configuration & Setup

### Environment Variables
```bash
# Analytics Configuration
ANALYTICS_ENABLED=true
ANALYTICS_SAMPLE_RATE=1.0
ANALYTICS_RETENTION_DAYS=365

# Privacy & Compliance
GDPR_ENABLED=true
ANONYMIZE_IPS=true
COOKIE_CONSENT_REQUIRED=true

# Third-party Integrations
GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
MIXPANEL_TOKEN=your_mixpanel_token
AMPLITUDE_API_KEY=your_amplitude_key

# Database
MONGODB_URI=mongodb://localhost:27017/eagle_analytics
REDIS_URL=redis://localhost:6379

# Performance
ANALYTICS_BATCH_SIZE=100
ANALYTICS_FLUSH_INTERVAL=30000
```

### MongoDB Indexes
```javascript
// Create required indexes for performance
db.analytics_events.createIndex({ "sessionId": 1 });
db.analytics_events.createIndex({ "visitorId": 1 });
db.analytics_events.createIndex({ "timestamp": -1 });
db.analytics_events.createIndex({ "event.name": 1 });
db.analytics_events.createIndex({ "page.path": 1 });
db.analytics_events.createIndex({ "conversion.isConversion": 1 });

db.analytics_sessions.createIndex({ "visitorId": 1 });
db.analytics_sessions.createIndex({ "session.startTime": -1 });
db.analytics_sessions.createIndex({ "attribution.channel": 1 });

db.analytics_visitors.createIndex({ "userId": 1 });
db.analytics_visitors.createIndex({ "firstVisit.timestamp": -1 });
```

---

## 📈 Performance Optimization

### Data Aggregation Strategy
```javascript
// Daily aggregation for improved query performance
const AnalyticsDailyAggregate = new mongoose.Schema({
  date: Date,
  metrics: {
    totalPageViews: Number,
    uniqueVisitors: Number,
    sessions: Number,
    bounceRate: Number,
    avgSessionDuration: Number,
    conversions: Number,
    conversionRate: Number
  },
  breakdowns: {
    sources: [{ name: String, visitors: Number }],
    pages: [{ path: String, views: Number }],
    devices: [{ type: String, count: Number }],
    countries: [{ code: String, visitors: Number }]
  }
});

// Batch processing for real-time updates
class AnalyticsBatchProcessor {
  constructor() {
    this.batch = [];
    this.batchSize = 100;
    this.flushInterval = 30000; // 30 seconds
    
    setInterval(() => this.flush(), this.flushInterval);
  }

  addEvent(event) {
    this.batch.push(event);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.batch.length === 0) return;
    
    const events = [...this.batch];
    this.batch = [];
    
    try {
      await AnalyticsEvent.insertMany(events);
      await this.updateAggregates(events);
    } catch (error) {
      console.error('Batch processing error:', error);
      // Re-add failed events to batch
      this.batch.unshift(...events);
    }
  }
}
```

### Caching Strategy
```javascript
const Redis = require('redis');
const client = Redis.createClient(process.env.REDIS_URL);

class AnalyticsCache {
  static async getCachedMetrics(range) {
    const key = `analytics:metrics:${range}`;
    const cached = await client.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  static async setCachedMetrics(range, data, ttl = 300) {
    const key = `analytics:metrics:${range}`;
    await client.setex(key, ttl, JSON.stringify(data));
  }
}
```

---

## 🛡️ Privacy & Compliance

### GDPR Compliance Features
```javascript
// Privacy-first data collection
const PrivacyManager = {
  // Check if user has given consent
  hasConsent(visitorId, consentType) {
    // Implementation for checking consent status
  },

  // Anonymize IP addresses
  anonymizeIP(ip) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  },

  // Handle data deletion requests
  async handleDataDeletion(visitorId) {
    await AnalyticsEvent.deleteMany({ visitorId });
    await AnalyticsSession.deleteMany({ visitorId });
    await AnalyticsVisitor.deleteOne({ id: visitorId });
  },

  // Export user data
  async exportUserData(visitorId) {
    const events = await AnalyticsEvent.find({ visitorId });
    const sessions = await AnalyticsSession.find({ visitorId });
    const visitor = await AnalyticsVisitor.findOne({ id: visitorId });
    
    return { events, sessions, visitor };
  }
};
```

### Consent Management
```javascript
// Consent banner component
const ConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(true);

  const handleAcceptAll = () => {
    tracker.setConsent({
      analytics: true,
      advertising: true,
      functional: true
    });
    setShowBanner(false);
  };

  const handleRejectAll = () => {
    tracker.setConsent({
      analytics: false,
      advertising: false,
      functional: true
    });
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="consent-banner">
      <p>We use cookies to improve your experience...</p>
      <button onClick={handleAcceptAll}>Accept All</button>
      <button onClick={handleRejectAll}>Reject All</button>
      <button onClick={() => setShowSettings(true)}>Settings</button>
    </div>
  );
};
```

---

## 🧪 Testing & Quality Assurance

### Automated Testing Suite
```bash
# Run analytics API tests
npm run test:analytics

# Run load testing
npm run test:analytics:load

# Run privacy compliance tests
npm run test:analytics:privacy
```

### Test Coverage Areas
1. **API Endpoints** - All tracking and analytics APIs
2. **Data Validation** - Input sanitization and validation
3. **Performance** - Load testing and response times
4. **Privacy** - GDPR compliance and consent handling
5. **Accuracy** - Data integrity and calculation correctness

---

## 📊 Monitoring & Alerting

### Key Metrics to Monitor
```javascript
const AlertingRules = {
  // High error rate
  errorRate: {
    threshold: 0.05, // 5%
    window: '5m'
  },

  // Low data quality
  dataQuality: {
    duplicateEvents: 0.01, // 1%
    missingFields: 0.02    // 2%
  },

  // Performance degradation
  performance: {
    responseTime: 500,     // 500ms
    throughput: 100        // 100 requests/second
  }
};

const HealthCheck = {
  async checkDataPipeline() {
    // Verify data is flowing correctly
    const recentEvents = await AnalyticsEvent.countDocuments({
      timestamp: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });
    
    return recentEvents > 0;
  },

  async checkDatabaseConnection() {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      return false;
    }
  }
};
```

---

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] Database indexes created
- [ ] Redis connection established
- [ ] SSL certificates installed
- [ ] Privacy policy updated
- [ ] Consent management implemented

### Post-deployment
- [ ] API endpoints tested
- [ ] Real-time tracking verified
- [ ] Dashboard functionality confirmed
- [ ] Performance metrics baseline established
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested

### Maintenance
- [ ] Weekly data quality checks
- [ ] Monthly performance reviews
- [ ] Quarterly compliance audits
- [ ] Annual privacy impact assessments

---

## 📚 Additional Resources

### Documentation Links
- [Analytics API Reference](./api-reference.md)
- [Frontend Integration Guide](./frontend-guide.md)
- [Privacy Implementation](./privacy-guide.md)
- [Performance Optimization](./performance-guide.md)

### Support & Community
- **GitHub Issues**: [Report bugs and request features]
- **Documentation**: [Comprehensive guides and tutorials]
- **Examples**: [Sample implementations and use cases]

---

**The analytics system is now fully documented and ready for production use!** 🎉

This comprehensive system provides enterprise-grade analytics capabilities while maintaining user privacy and ensuring GDPR compliance. The modular architecture allows for easy customization and scaling as your application grows.