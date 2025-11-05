# Analytics API Documentation

## Overview
The Analytics API provides comprehensive event tracking and reporting capabilities for the Eagle Investors platform. It supports batch and single event recording, detailed reporting, and data export functionality.

## Base URL
All analytics endpoints are prefixed with `/api/analytics`

---

## 📊 Analytics Events

### 1. `POST /api/analytics/events/batch`
**Purpose**: Record multiple analytics events in a single request  
**Authentication**: Not required (for tracking flexibility)  
**Body**:
```json
{
  "events": [
    {
      "type": "page_view",
      "userId": "user_id_123", // Optional
      "sessionId": "session_abc", // Optional
      "timestamp": "2025-11-05T10:30:00Z", // Optional, defaults to now
      "properties": {
        "page": "/dashboard",
        "title": "User Dashboard",
        "source": "direct"
      },
      "metadata": {
        "customField": "value"
      }
    },
    {
      "type": "feature_usage",
      "userId": "user_id_123",
      "sessionId": "session_abc",
      "properties": {
        "feature": "investment_calculator",
        "duration": 120
      }
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully processed 2 events",
  "data": {
    "processed": 2,
    "eventIds": ["event_id_1", "event_id_2"]
  }
}
```

### 2. `POST /api/analytics/events/single`
**Purpose**: Record a single analytics event  
**Authentication**: Not required  
**Body**:
```json
{
  "type": "signup_completed",
  "userId": "user_id_123",
  "sessionId": "session_abc",
  "properties": {
    "package": "diamond",
    "source": "marketing_campaign_1"
  }
}
```

### 3. `GET /api/analytics/events`
**Purpose**: Retrieve analytics events with filtering  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `type` - Filter by event type
- `userId` - Filter by user ID
- `sessionId` - Filter by session ID
- `startDate` - Filter events after date (ISO format)
- `endDate` - Filter events before date (ISO format)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)

**Example**: `GET /api/analytics/events?type=page_view&startDate=2025-11-01&limit=25`

---

## 📈 Analytics Reports

### 4. `GET /api/analytics/dashboard`
**Purpose**: Get dashboard statistics and metrics  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `timeRange` - Time range for data (`24h`, `7d`, `30d`, default: `7d`)

**Response**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEvents": 15420,
      "uniqueUsers": 1250,
      "timeRange": "7d"
    },
    "topEvents": [
      {
        "_id": "page_view",
        "count": 8500
      },
      {
        "_id": "feature_usage", 
        "count": 3200
      }
    ],
    "hourlyDistribution": [
      {
        "_id": 9,
        "count": 420
      }
    ],
    "generatedAt": "2025-11-05T15:30:00Z"
  }
}
```

### 5. `GET /api/analytics/user-activity`
**Purpose**: Get specific user's activity  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `userId` - Required: User ID to analyze
- `startDate` - Optional: Start date for analysis
- `endDate` - Optional: End date for analysis

### 6. `GET /api/analytics/popular-content`
**Purpose**: Analyze popular content and features  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `timeRange` - Time range (`24h`, `7d`, `30d`, default: `7d`)

### 7. `GET /api/analytics/conversion-funnel`
**Purpose**: Analyze user conversion funnel  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `timeRange` - Time range (`7d`, `30d`, `90d`, default: `30d`)

---

## 📤 Data Export

### 8. `GET /api/analytics/export/events`
**Purpose**: Export analytics events  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `format` - Export format (`json`, `csv`, default: `json`)
- `startDate` - Optional: Filter start date
- `endDate` - Optional: Filter end date
- `type` - Optional: Filter by event type

**CSV Export**: Returns CSV file with headers
**JSON Export**: Returns JSON with events array

### 9. `GET /api/analytics/export/report`
**Purpose**: Export comprehensive analytics report  
**Authentication**: Required (JWT)  
**Query Parameters**:
- `timeRange` - Time range (`7d`, `30d`, `90d`, default: `30d`)
- `format` - Export format (`json`, `csv`, default: `json`)

---

## ⚙️ Configuration

### 10. `GET /api/analytics/config`
**Purpose**: Get analytics configuration  
**Authentication**: Required (JWT)

### 11. `PUT /api/analytics/config`
**Purpose**: Update analytics configuration  
**Authentication**: Required (JWT)  
**Body**:
```json
{
  "config": {
    "enabledEvents": ["page_view", "user_action", "signup_completed"],
    "retentionPeriod": "90d",
    "batchSize": 100,
    "enableRealTimeAnalytics": true
  }
}
```

---

## 📋 Event Types

### Standard Event Types:
- `page_view` - Page/route views
- `user_action` - Generic user actions
- `signup_started` - User began signup process
- `signup_completed` - User completed signup
- `login` - User logged in
- `logout` - User logged out
- `subscription_viewed` - User viewed subscription page
- `payment_started` - User began payment process
- `payment_completed` - Payment was completed
- `feature_usage` - User used a specific feature
- `error_occurred` - Error tracking
- `download` - File downloads
- `video_play` - Video playback started
- `video_pause` - Video playback paused
- `form_submit` - Form submissions
- `search` - Search queries
- `share` - Content sharing
- `custom` - Custom events

---

## 🏷️ Event Properties

### Common Properties:
- `page` - Current page/route
- `source` - Traffic source
- `campaign` - Marketing campaign
- `feature` - Feature name
- `duration` - Time spent (seconds)
- `value` - Numeric value
- `category` - Event category
- `label` - Event label

### Automatically Added Metadata:
- `userAgent` - Browser user agent
- `ip` - Client IP address (anonymized in responses)
- `referer` - Referring page
- `device` - Device type (desktop/mobile/tablet)
- `browser` - Browser name
- `os` - Operating system

---

## 🔒 Security & Privacy

### Data Retention:
- Events are automatically deleted after 90 days
- IP addresses are anonymized in API responses
- User data is only stored if explicitly provided

### Rate Limiting:
- Batch events: 100 events per request maximum
- API calls: Standard rate limiting applies (100 requests/15 minutes)

### Authentication:
- Event recording endpoints: No authentication required
- Reporting endpoints: JWT authentication required
- Export endpoints: JWT authentication required

---

## 💡 Usage Examples

### Frontend Integration:
```javascript
// Track page view
fetch('/api/analytics/events/single', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'page_view',
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    properties: {
      page: window.location.pathname,
      title: document.title,
      source: 'direct'
    }
  })
});

// Batch multiple events
fetch('/api/analytics/events/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    events: [
      {
        type: 'feature_usage',
        userId: getCurrentUserId(),
        properties: { feature: 'calculator' }
      },
      {
        type: 'user_action',
        userId: getCurrentUserId(), 
        properties: { action: 'button_click', target: 'subscribe_now' }
      }
    ]
  })
});
```

### Dashboard Data Fetching:
```javascript
// Get dashboard stats
const response = await fetch('/api/analytics/dashboard?timeRange=7d', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const stats = await response.json();

// Export events as CSV
window.open('/api/analytics/export/events?format=csv&startDate=2025-11-01');
```

---

## 🚀 Performance Notes

### Optimizations:
- Database indexes on `type`, `userId`, `sessionId`, and `timestamp`
- Automatic data purging after 90 days
- Batch processing for high-volume events
- Efficient aggregation queries for reports

### Recommendations:
- Use batch endpoint for multiple events
- Implement client-side queuing for offline scenarios
- Cache dashboard data for 5-10 minutes
- Use appropriate time ranges for reports

All analytics endpoints are now fully implemented and ready for use!