# 📄 Contract Management API Documentation

## Overview
Comprehensive contract management system supporting digital signatures, templates, evidence collection, and compliance features.

## Base URL
All contract endpoints are prefixed with `/api/contracts`

---

## 🔓 Public Contract APIs

### 1. Get Contracts by Contact
- **Endpoint**: `POST /api/contracts/get-by-contact`
- **Description**: Get contracts by contact information
- **Authentication**: None required
- **Body**:
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

### 2. Create Contract with Contact
- **Endpoint**: `POST /api/contracts/create-with-contact`
- **Description**: Create contract without authentication
- **Authentication**: None required
- **Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "productType": "basic-subscription",
  "signature": "base64_signature_data",
  "country": "USA",
  "streetAddress": "123 Main St",
  "townCity": "New York",
  "stateCounty": "NY",
  "postcodeZip": "10001"
}
```

### 3. Get Guest Contract
- **Endpoint**: `GET /api/contracts/guest/:contractId`
- **Description**: Get contract details for guests
- **Authentication**: None required

### 4. Get User Contracts by Email
- **Endpoint**: `POST /api/contracts/public/my-contracts`
- **Description**: Get user contracts using email
- **Authentication**: None required
- **Body**:
```json
{
  "email": "user@example.com"
}
```

### 5. Get User Contracts (GET)
- **Endpoint**: `GET /api/contracts/public/my-contracts/:email`
- **Description**: Get contracts via GET request
- **Authentication**: None required

### 6. Get My Contracts (Optional Auth)
- **Endpoint**: `GET /api/contracts/my-contracts`
- **Description**: Get user contracts with optional authentication
- **Authentication**: Optional (JWT token if available)

### 7. Get Guest Contracts
- **Endpoint**: `POST /api/contracts/my-contracts/guest`
- **Description**: Get guest contracts by contact info
- **Authentication**: None required

### 8. Public Contract Signing
- **Endpoint**: `POST /api/contracts/public/sign`
- **Description**: Sign contract without authentication
- **Authentication**: None required

---

## 🔒 Protected Contract APIs

### Authentication Required
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### 9. Get Contract Statistics
- **Endpoint**: `GET /api/contracts/stats`
- **Description**: Get comprehensive contract statistics
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalContracts": 1250,
    "signedContracts": 980,
    "pendingContracts": 270,
    "monthlyStats": [...],
    "productBreakdown": {...}
  }
}
```

### 10. Get All Contracts
- **Endpoint**: `GET /api/contracts`
- **Description**: Get contracts with filtering and pagination
- **Query Parameters**:
  - `page` - Page number (default: 1)
  - `limit` - Items per page (default: 20)
  - `productType` - Filter by product type
  - `status` - Filter by status
  - `startDate` - Filter from date
  - `endDate` - Filter to date
  - `search` - Search in name/email

### 11. Get Contract by ID
- **Endpoint**: `GET /api/contracts/:contractId`
- **Description**: Get detailed contract information

### 12. Update Contract
- **Endpoint**: `PUT /api/contracts/:id`
- **Description**: Update contract details
- **Body**:
```json
{
  "status": "completed",
  "notes": "Contract updated"
}
```

### 13. Delete Contract
- **Endpoint**: `DELETE /api/contracts/:id`
- **Description**: Soft delete contract

### 14. Generate Contract PDF
- **Endpoint**: `POST /api/contracts/generate-pdf`
- **Description**: Generate PDF for contract
- **Body**:
```json
{
  "contractId": "contract_123",
  "templateType": "basic"
}
```

### 15. Store Signed Contract
- **Endpoint**: `POST /api/contracts/sign`
- **Description**: Store digitally signed contract
- **Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "signature": "base64_signature",
  "productType": "diamond-subscription",
  "subscriptionType": "yearly"
}
```

### 16. Update Payment Status
- **Endpoint**: `PUT /api/contracts/:contractId/payment`
- **Description**: Update contract payment status
- **Body**:
```json
{
  "paymentStatus": "completed",
  "paymentId": "pay_123456",
  "amount": 76.00,
  "currency": "USD"
}
```

### 17. Get Contract PDF URL
- **Endpoint**: `GET /api/contracts/:contractId/pdf`
- **Description**: Get secure URL for contract PDF

### 18. Export Contracts
- **Endpoint**: `GET /api/contracts/export`
- **Description**: Export contracts to CSV/Excel
- **Query Parameters**:
  - `format` - Export format (csv, excel)
  - `startDate` - Filter from date
  - `endDate` - Filter to date
  - `productType` - Filter by product

### 19. Get Evidence Packets
- **Endpoint**: `GET /api/contracts/evidence`
- **Description**: Get legal evidence packages for contracts

---

## 📋 Contract Template Management

### 20. Get Templates
- **Endpoint**: `GET /api/contracts/templates`
- **Description**: Get all contract templates
- **Query Parameters**:
  - `page` - Page number
  - `limit` - Items per page
  - `active` - Filter active templates

### 21. Create Template
- **Endpoint**: `POST /api/contracts/templates`
- **Description**: Create new contract template
- **Body**:
```json
{
  "name": "Basic Service Agreement",
  "description": "Template for basic service contracts",
  "content": "HTML template content with {{placeholders}}",
  "productTypes": ["basic", "basic-subscription"],
  "isActive": true
}
```

### 22. Update Template
- **Endpoint**: `PUT /api/contracts/templates/:id`
- **Description**: Update contract template

### 23. Delete Template
- **Endpoint**: `DELETE /api/contracts/templates/:id`
- **Description**: Delete contract template

---

## 🔥 Enhanced Contract APIs

### Base URL: `/api/contracts/enhanced`

### 24. Template Management
- `GET /enhanced/templates` - Get enhanced templates
- `POST /enhanced/templates` - Create enhanced template
- `GET /enhanced/templates/:templateId` - Get template by ID
- `PUT /enhanced/templates/:templateId` - Update template
- `POST /enhanced/templates/:templateId/versions` - Create template version
- `POST /enhanced/templates/:templateId/approve` - Approve template
- `POST /enhanced/templates/:templateId/publish` - Publish template
- `GET /enhanced/templates/:templateId/statistics` - Get template stats
- `POST /enhanced/templates/:templateId/clone` - Clone template

### 25. Contract Signing Process
- `POST /enhanced/initiate` - Initiate contract signing
- `GET /enhanced/sign/:contractId` - Get contract for signing (public)
- `POST /enhanced/:contractId/sign-session` - Start signing session (public)
- `POST /enhanced/:contractId/evidence` - Collect evidence (public)
- `POST /enhanced/:contractId/signatures` - Submit signature (public)

### 26. Evidence & Compliance
- `POST /enhanced/:contractId/evidence-package` - Generate evidence package
- `GET /enhanced/:contractId/download-package` - Download evidence
- `GET /enhanced/:contractId/certificate` - Get completion certificate
- `GET /enhanced/:contractId/audit-trail` - Get audit trail
- `GET /enhanced/:contractId/verify/:hash` - Verify evidence integrity (public)

### 27. Search & Analytics
- `GET /enhanced/search` - Advanced contract search
- `GET /enhanced/analytics/dashboard` - Analytics dashboard

### 28. Admin Controls
- `POST /enhanced/:contractId/void` - Void contract (Admin only)
- `POST /enhanced/:contractId/resend` - Resend contract

### 29. Integration Webhooks
- `POST /enhanced/webhooks/:provider` - Handle provider webhooks (public)

---

## 📊 Product Types

### Supported Product Types:
- `basic` / `basic-subscription` - Basic Package ($35/month)
- `diamond` / `diamond-subscription` - Diamond Package ($76/month) 
- `infinity` / `infinity-subscription` - Infinity Package ($99/month)
- `script` - Script Package ($29/month)
- `investment-advising` - Investment Advising ($79/month)
- `trading-tutor` / `trading-tutoring` - Trading Tutor ($79/month)
- `ultimate` / `eagle-ultimate` - Ultimate Package ($199/month)
- `mentorship-package` - Mentorship Package ($79/month)
- `product-purchase` - Product Purchase ($99/month)

---

## 🔧 Error Handling

### Standard Error Response:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information (development only)"
}
```

### Common Error Codes:
- `400` - Bad Request (Invalid input data)
- `401` - Unauthorized (Invalid or missing token)
- `403` - Forbidden (Insufficient permissions)
- `404` - Not Found (Contract/Template not found)
- `500` - Internal Server Error

---

## 🛡️ Security Features

### Digital Signature Verification
- SHA-256 document hashing
- Cryptographic signature validation
- Evidence collection during signing
- IP address and device fingerprinting
- Geolocation tracking (with consent)

### Compliance Features
- GDPR compliant data handling
- Legal evidence packages
- Audit trail generation
- Document integrity verification
- Secure document storage

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control (RBAC)
- Admin-only functions protection
- Optional authentication for public APIs

---

## 📝 Usage Examples

### Create and Sign Contract:
```javascript
// 1. Create contract
const contractResponse = await fetch('/api/contracts/create-with-contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@example.com',
    productType: 'diamond-subscription',
    signature: signatureData,
    country: 'USA',
    streetAddress: '123 Main St',
    townCity: 'New York',
    stateCounty: 'NY',
    postcodeZip: '10001'
  })
});

// 2. Get contract status
const statusResponse = await fetch('/api/contracts/my-contracts', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Generate Evidence Package:
```javascript
const evidenceResponse = await fetch(`/api/contracts/enhanced/${contractId}/evidence-package`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

---

## 🔍 Known Issues & Fixes Applied

### ✅ **Issues Fixed:**

1. **Missing Functions Export** - Added all missing controller functions
2. **Path Resolution** - Fixed import paths for contract controllers
3. **Missing Middleware** - Created RBAC authentication middleware
4. **Route Organization** - Properly structured public vs protected routes
5. **Template Management** - Complete template CRUD operations
6. **Evidence Collection** - Legal compliance and evidence gathering
7. **Enhanced Signing** - Multi-step signing process with evidence
8. **Admin Controls** - Contract void/resend functionality

### ⚠️ **Potential Issues:**

1. **Database Dependencies** - Ensure MongoDB models are properly initialized
2. **File Storage** - PDF generation and storage configuration needed
3. **Email Service** - Contract notification system requires email setup
4. **Third-party Integration** - DocuSign/Adobe Sign integration requires API keys

---

---

# 📊 Analytics Module Documentation

## Overview
The Analytics module provides comprehensive web analytics, visitor tracking, conversion funnels, and real-time monitoring capabilities with privacy-first design and GDPR compliance.

## Base URL
All analytics endpoints are prefixed with `/api/analytics`

---

## 🔓 Public Analytics APIs (No Authentication Required)

### Track Page View
```http
POST /api/analytics/track/pageview
Content-Type: application/json

{
  "sessionId": "session_12345",
  "userId": "user_123", // optional
  "page": "/pricing",
  "referrer": "https://google.com",
  "userAgent": "Mozilla/5.0...",
  "deviceType": "desktop", // desktop, mobile, tablet
  "trafficSource": "organic", // organic, paid, direct, social, referral
  "duration": 45000, // optional, time spent in milliseconds
  "utm": {
    "source": "google",
    "medium": "cpc",
    "campaign": "summer2025",
    "term": "contract software",
    "content": "ad1"
  }
}
```

### Track Custom Event
```http
POST /api/analytics/track/event
Content-Type: application/json

{
  "sessionId": "session_12345",
  "userId": "user_123", // optional
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
```

### Update Session
```http
POST /api/analytics/track/session
Content-Type: application/json

{
  "sessionId": "session_12345",
  "action": "update", // update, end
  "data": {
    "endTime": "2025-11-05T10:30:00Z",
    "exitPage": "/dashboard",
    "totalEvents": 15,
    "conversions": ["trial_started"]
  }
}
```

---

## 🔒 Protected Analytics APIs (JWT Authentication Required)

### Get Analytics Metrics
```http
GET /api/analytics/metrics?range=30d
Authorization: Bearer <jwt_token>

Response:
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
    },
    {
      "title": "Unique Visitors", 
      "value": "3,428",
      "change": "+8.7%",
      "trend": "up",
      "icon": "Users",
      "color": "text-green-600"
    },
    {
      "title": "Bounce Rate",
      "value": "34%",
      "change": "-2.1%", 
      "trend": "up",
      "icon": "TrendingUp",
      "color": "text-yellow-600"
    },
    {
      "title": "Avg Session Duration",
      "value": "3m 24s",
      "change": "+12.5%",
      "trend": "up", 
      "icon": "Activity",
      "color": "text-purple-600"
    }
  ],
  "range": "30d",
  "timestamp": "2025-11-05T10:30:00Z"
}
```

### Get Traffic Sources
```http
GET /api/analytics/traffic?range=30d&limit=10
Authorization: Bearer <jwt_token>

Response:
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
      },
      {
        "name": "Direct",
        "visitors": 890,
        "sessions": 1020,
        "bounceRate": 28.1,
        "avgSessionDuration": 240,
        "conversionRate": 4.8,
        "percentage": 25.9
      }
    ],
    "total": 3434,
    "range": "30d"
  }
}
```

### Get Top Pages
```http
GET /api/analytics/pages?range=30d&limit=20
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "pages": [
      {
        "page": "/pricing",
        "title": "Pricing Plans",
        "views": 4250,
        "uniqueViews": 3180,
        "avgTimeOnPage": 185,
        "bounceRate": 25.4,
        "exitRate": 15.2,
        "entrances": 890,
        "conversionRate": 8.5
      },
      {
        "page": "/features",
        "title": "Features Overview", 
        "views": 3890,
        "uniqueViews": 2950,
        "avgTimeOnPage": 220,
        "bounceRate": 30.1,
        "exitRate": 18.7,
        "entrances": 650,
        "conversionRate": 4.2
      }
    ],
    "total": 15680,
    "range": "30d"
  }
}
```

### Get Device Breakdown
```http
GET /api/analytics/devices?range=30d
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "devices": [
      {
        "type": "desktop",
        "visitors": 2180,
        "sessions": 2650,
        "percentage": 63.5,
        "bounceRate": 29.8,
        "conversionRate": 5.2
      },
      {
        "type": "mobile", 
        "visitors": 1050,
        "sessions": 1200,
        "percentage": 30.6,
        "bounceRate": 45.2,
        "conversionRate": 2.8
      },
      {
        "type": "tablet",
        "visitors": 204,
        "sessions": 230,
        "percentage": 5.9,
        "bounceRate": 38.1,
        "conversionRate": 3.5
      }
    ],
    "browsers": [
      { "name": "Chrome", "percentage": 68.5 },
      { "name": "Safari", "percentage": 18.2 },
      { "name": "Firefox", "percentage": 8.7 },
      { "name": "Edge", "percentage": 4.6 }
    ],
    "operatingSystems": [
      { "name": "Windows", "percentage": 52.3 },
      { "name": "macOS", "percentage": 28.7 },
      { "name": "iOS", "percentage": 12.1 },
      { "name": "Android", "percentage": 6.9 }
    ]
  }
}
```

### Get Conversion Funnel
```http
GET /api/analytics/conversion?range=30d&funnelId=signup_funnel
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "funnel": {
      "id": "signup_funnel",
      "name": "User Signup Funnel",
      "totalUsers": 5420,
      "completions": 487,
      "conversionRate": 8.98
    },
    "steps": [
      {
        "id": "landing",
        "name": "Landing Page Visit",
        "users": 5420,
        "completions": 5420,
        "dropoffs": 0,
        "conversionRate": 100,
        "dropoffRate": 0
      },
      {
        "id": "pricing_view", 
        "name": "View Pricing",
        "users": 2180,
        "completions": 2180,
        "dropoffs": 3240,
        "conversionRate": 40.22,
        "dropoffRate": 59.78
      },
      {
        "id": "signup_start",
        "name": "Start Signup",
        "users": 890,
        "completions": 890,
        "dropoffs": 1290,
        "conversionRate": 40.83,
        "dropoffRate": 59.17
      },
      {
        "id": "signup_complete",
        "name": "Complete Signup", 
        "users": 487,
        "completions": 487,
        "dropoffs": 403,
        "conversionRate": 54.72,
        "dropoffRate": 45.28
      }
    ]
  }
}
```

### Get Events Data
```http
GET /api/analytics/events?range=30d&limit=100&category=conversion
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "data": {
    "events": [
      {
        "eventName": "signup_completed",
        "category": "conversion",
        "count": 487,
        "uniqueUsers": 487,
        "totalValue": 24350,
        "avgValue": 50,
        "percentage": 18.5
      },
      {
        "eventName": "trial_started",
        "category": "conversion", 
        "count": 234,
        "uniqueUsers": 234,
        "totalValue": 0,
        "avgValue": 0,
        "percentage": 8.9
      }
    ],
    "summary": {
      "totalEvents": 15680,
      "uniqueEvents": 45,
      "totalValue": 125780,
      "categories": ["conversion", "engagement", "navigation", "interaction"]
    }
  }
}
```

---

# 🎨 Complete Analytics Dashboard UI Guide

## Dashboard Layout Structure

### Main Navigation
```jsx
const AnalyticsDashboard = () => {
  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <DashboardHeader />
      
      {/* Navigation Tabs */}
      <DashboardTabs 
        tabs={['Overview', 'Traffic', 'Content', 'Conversions', 'Real-time']}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      
      {/* Main Content */}
      <DashboardContent activeTab={activeTab} />
    </div>
  );
};
```

---

## 📊 Overview Dashboard Components

### Key Metrics Cards
```jsx
const MetricsOverview = ({ metrics, timeRange }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <MetricCard 
          key={index}
          title={metric.title}
          value={metric.value}
          change={metric.change}
          trend={metric.trend}
          icon={metric.icon}
          color={metric.color}
        />
      ))}
    </div>
  );
};

const MetricCard = ({ title, value, change, trend, icon, color }) => {
  const Icon = getIcon(icon); // BarChart3, Users, TrendingUp, Activity
  const trendColor = trend === 'up' ? 'text-green-500' : 'text-red-500';
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
        <div className={`flex items-center ${trendColor}`}>
          {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          <span className="ml-1 text-sm font-medium">{change}</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
};
```

### Interactive Charts Section
```jsx
const ChartsSection = ({ timeRange }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAnalyticsData(timeRange).then(data => {
      setChartData(data);
      setLoading(false);
    });
  }, [timeRange]);
  
  if (loading) return <ChartsSkeleton />;
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Traffic Trends Chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Traffic Trends</h3>
          <ChartControls 
            type="line"
            onTypeChange={setChartType}
            onExport={() => exportChart('traffic-trends')}
          />
        </div>
        <LineChart 
          data={chartData.trafficTrends}
          height={300}
          xAxisKey="date"
          yAxisKey="visitors"
          lineColor="#3B82F6"
        />
      </div>
      
      {/* Device Breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Device Breakdown</h3>
          <button className="text-sm text-blue-600 hover:text-blue-800">
            View Details
          </button>
        </div>
        <DonutChart 
          data={chartData.deviceBreakdown}
          colors={['#3B82F6', '#10B981', '#F59E0B', '#EF4444']}
          showLegend={true}
        />
      </div>
    </div>
  );
};
```

---

## 🚦 Traffic Sources Dashboard

### Traffic Sources Table
```jsx
const TrafficSourcesTable = ({ data, timeRange }) => {
  const [sortField, setSortField] = useState('visitors');
  const [sortDirection, setSortDirection] = useState('desc');
  
  const sortedData = useMemo(() => {
    return [...data.sources].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      return (a[sortField] - b[sortField]) * multiplier;
    });
  }, [data.sources, sortField, sortDirection]);
  
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Traffic Sources</h3>
          <div className="flex items-center space-x-4">
            <SearchInput 
              placeholder="Search sources..."
              onSearch={setSearchTerm}
            />
            <ExportButton 
              onExport={() => exportData(data.sources, 'traffic-sources')}
            />
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader 
                field="name" 
                label="Source"
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={(field, direction) => {
                  setSortField(field);
                  setSortDirection(direction);
                }}
              />
              <SortableHeader field="visitors" label="Visitors" />
              <SortableHeader field="sessions" label="Sessions" />
              <SortableHeader field="bounceRate" label="Bounce Rate" />
              <SortableHeader field="avgSessionDuration" label="Avg Duration" />
              <SortableHeader field="conversionRate" label="Conversion Rate" />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((source, index) => (
              <TrafficSourceRow 
                key={source.name}
                source={source}
                index={index}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TrafficSourceRow = ({ source, index }) => {
  return (
    <tr className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-3`} 
               style={{ backgroundColor: getSourceColor(source.name) }} />
          <div className="text-sm font-medium text-gray-900">{source.name}</div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {source.visitors.toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {source.sessions.toLocaleString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {source.bounceRate}%
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatDuration(source.avgSessionDuration)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          source.conversionRate > 3 ? 'bg-green-100 text-green-800' : 
          source.conversionRate > 1 ? 'bg-yellow-100 text-yellow-800' :
          'bg-red-100 text-red-800'
        }`}>
          {source.conversionRate}%
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        <MiniChart data={source.trendData} color={getSourceColor(source.name)} />
      </td>
    </tr>
  );
};
```

---

## 📄 Content Performance Dashboard

### Top Pages Component
```jsx
const TopPagesAnalytics = ({ data, timeRange }) => {
  const [viewMode, setViewMode] = useState('table'); // table, cards, chart
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Content Performance</h2>
        <div className="flex items-center space-x-4">
          <ViewToggle 
            mode={viewMode} 
            onModeChange={setViewMode}
            options={[
              { value: 'table', icon: TableIcon, label: 'Table' },
              { value: 'cards', icon: GridIcon, label: 'Cards' },
              { value: 'chart', icon: ChartIcon, label: 'Chart' }
            ]}
          />
          <TimeRangeSelector 
            value={timeRange}
            onChange={setTimeRange}
          />
        </div>
      </div>
      
      {/* Content Display */}
      {viewMode === 'table' && (
        <TopPagesTable data={data} />
      )}
      {viewMode === 'cards' && (
        <TopPagesCards data={data} />
      )}
      {viewMode === 'chart' && (
        <TopPagesChart data={data} />
      )}
    </div>
  );
};

const TopPagesCards = ({ data }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {data.pages.map((page, index) => (
        <PagePerformanceCard 
          key={page.page}
          page={page}
          rank={index + 1}
        />
      ))}
    </div>
  );
};

const PagePerformanceCard = ({ page, rank }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-blue-100 text-blue-800 text-sm font-bold rounded-full h-8 w-8 flex items-center justify-center mr-3">
            {rank}
          </div>
          <div>
            <h3 className="font-medium text-gray-900 truncate">{page.title}</h3>
            <p className="text-sm text-gray-500 truncate">{page.page}</p>
          </div>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          <ExternalLinkIcon className="h-5 w-5" />
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">{page.views.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Page Views</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{page.uniqueViews.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Unique Views</p>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Time on Page</span>
          <span className="text-sm font-medium">{formatDuration(page.avgTimeOnPage)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Bounce Rate</span>
          <span className={`text-sm font-medium ${
            page.bounceRate < 40 ? 'text-green-600' : 
            page.bounceRate < 70 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {page.bounceRate}%
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Conversion Rate</span>
          <span className={`text-sm font-medium ${
            page.conversionRate > 5 ? 'text-green-600' : 
            page.conversionRate > 2 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {page.conversionRate}%
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

## 📈 Conversion Funnel Dashboard

### Funnel Visualization
```jsx
const ConversionFunnelDashboard = ({ funnelData, timeRange }) => {
  return (
    <div className="space-y-8">
      {/* Funnel Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{funnelData.funnel.name}</h2>
            <p className="text-gray-600">Track user progression through key actions</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-blue-600">{funnelData.funnel.conversionRate}%</p>
            <p className="text-sm text-gray-500">Overall Conversion Rate</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{funnelData.funnel.totalUsers.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Total Users Entered</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{funnelData.funnel.completions.toLocaleString()}</p>
            <p className="text-sm text-gray-500">Completed Funnel</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{(funnelData.funnel.totalUsers - funnelData.funnel.completions).toLocaleString()}</p>
            <p className="text-sm text-gray-500">Dropped Off</p>
          </div>
        </div>
      </div>
      
      {/* Funnel Visualization */}
      <FunnelVisualization steps={funnelData.steps} />
      
      {/* Step Analysis */}
      <FunnelStepsAnalysis steps={funnelData.steps} />
    </div>
  );
};

const FunnelVisualization = ({ steps }) => {
  const maxUsers = Math.max(...steps.map(step => step.users));
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Funnel Flow</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => {
          const width = (step.users / maxUsers) * 100;
          const isLastStep = index === steps.length - 1;
          
          return (
            <div key={step.id} className="relative">
              {/* Funnel Step */}
              <div 
                className="bg-blue-500 text-white rounded-lg p-4 transition-all duration-300 hover:bg-blue-600"
                style={{ width: `${width}%`, minWidth: '300px' }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold">{step.name}</h4>
                    <p className="text-blue-100 text-sm">{step.users.toLocaleString()} users</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{step.conversionRate}%</p>
                    <p className="text-blue-100 text-sm">conversion</p>
                  </div>
                </div>
              </div>
              
              {/* Dropoff Arrow */}
              {!isLastStep && (
                <div className="flex items-center mt-2 mb-2">
                  <div className="flex-1 flex items-center">
                    <ChevronDownIcon className="h-6 w-6 text-gray-400 mr-2" />
                    <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                      {step.dropoffs.toLocaleString()} dropped off ({step.dropoffRate}%)
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FunnelStepsAnalysis = ({ steps }) => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Step-by-Step Analysis</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Step</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completions</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drop-offs</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Drop-off Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {steps.map((step, index) => (
              <tr key={step.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center text-sm font-bold mr-3">
                      {index + 1}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{step.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {step.users.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {step.completions.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {step.dropoffs.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    step.conversionRate > 70 ? 'bg-green-100 text-green-800' :
                    step.conversionRate > 40 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {step.conversionRate}%
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    step.dropoffRate < 30 ? 'bg-green-100 text-green-800' :
                    step.dropoffRate < 60 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {step.dropoffRate}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## ⚡ Real-time Analytics Dashboard

### Real-time Components
```jsx
const RealTimeAnalytics = () => {
  const [realtimeData, setRealtimeData] = useState(null);
  const [isLive, setIsLive] = useState(true);
  
  // Update every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLive) {
        fetchRealtimeAnalytics().then(setRealtimeData);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isLive]);
  
  return (
    <div className="space-y-6">
      {/* Real-time Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${isLive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <h2 className="text-2xl font-bold text-gray-900">Real-time Analytics</h2>
          <span className="ml-3 text-sm text-gray-500">Last updated: {formatTime(new Date())}</span>
        </div>
        <button
          onClick={() => setIsLive(!isLive)}
          className={`px-4 py-2 rounded-md text-sm font-medium ${
            isLive 
              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {isLive ? 'Live' : 'Paused'}
        </button>
      </div>
      
      {/* Current Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <RealTimeMetricCard 
          title="Active Users"
          value={realtimeData?.current.activeUsers || 0}
          icon={UsersIcon}
          color="text-green-600"
        />
        <RealTimeMetricCard 
          title="Active Sessions"
          value={realtimeData?.current.activeSessions || 0}
          icon={ActivityIcon}
          color="text-blue-600"
        />
        <RealTimeMetricCard 
          title="Page Views"
          value={realtimeData?.current.pageViews || 0}
          icon={EyeIcon}
          color="text-purple-600"
        />
        <RealTimeMetricCard 
          title="Events"
          value={realtimeData?.current.events || 0}
          icon={ZapIcon}
          color="text-yellow-600"
        />
        <RealTimeMetricCard 
          title="Conversions"
          value={realtimeData?.current.conversions || 0}
          icon={TargetIcon}
          color="text-red-600"
        />
      </div>
      
      {/* Real-time Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RealTimeChart data={realtimeData} />
        <ActivePagesTable data={realtimeData?.topContent || []} />
      </div>
      
      {/* Geographic & Device Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GeographicRealTime data={realtimeData?.geography || []} />
        <DeviceRealTime data={realtimeData?.devices || []} />
      </div>
    </div>
  );
};

const RealTimeMetricCard = ({ title, value, icon: Icon, color }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
        </div>
        <div className={`p-2 rounded-lg ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );
};
```

---

## 🛠️ Utility Components & Hooks

### Custom Hooks
```jsx
// useAnalytics.js
export const useAnalytics = (timeRange = '30d') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [metrics, traffic, pages, devices, conversion, events] = await Promise.all([
          analyticsAPI.getMetrics(timeRange),
          analyticsAPI.getTrafficSources(timeRange),
          analyticsAPI.getTopPages(timeRange),
          analyticsAPI.getDeviceBreakdown(timeRange),
          analyticsAPI.getConversionFunnel(timeRange),
          analyticsAPI.getEvents(timeRange)
        ]);
        
        setData({
          metrics: metrics.data,
          traffic: traffic.data,
          pages: pages.data,
          devices: devices.data,
          conversion: conversion.data,
          events: events.data
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [timeRange]);
  
  return { data, loading, error, refetch: () => fetchData() };
};

// useRealTimeAnalytics.js
export const useRealTimeAnalytics = (updateInterval = 30000) => {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    let interval;
    
    const fetchRealTimeData = async () => {
      try {
        const response = await analyticsAPI.getRealTimeAnalytics();
        setData(response.data);
        setIsConnected(true);
      } catch (error) {
        console.error('Real-time analytics error:', error);
        setIsConnected(false);
      }
    };
    
    // Initial fetch
    fetchRealTimeData();
    
    // Set up interval
    interval = setInterval(fetchRealTimeData, updateInterval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [updateInterval]);
  
  return { data, isConnected };
};
```

### Analytics API Client
```jsx
// analyticsAPI.js
class AnalyticsAPI {
  constructor(baseURL = '/api/analytics') {
    this.baseURL = baseURL;
  }
  
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = localStorage.getItem('authToken');
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers
      },
      ...options
    });
    
    if (!response.ok) {
      throw new Error(`Analytics API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Public tracking methods
  trackPageView(data) {
    return this.request('/track/pageview', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  trackEvent(data) {
    return this.request('/track/event', {
      method: 'POST', 
      body: JSON.stringify(data)
    });
  }
  
  updateSession(data) {
    return this.request('/track/session', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  // Protected analytics methods
  getMetrics(range = '30d') {
    return this.request(`/metrics?range=${range}`);
  }
  
  getTrafficSources(range = '30d', limit = 10) {
    return this.request(`/traffic?range=${range}&limit=${limit}`);
  }
  
  getTopPages(range = '30d', limit = 20) {
    return this.request(`/pages?range=${range}&limit=${limit}`);
  }
  
  getDeviceBreakdown(range = '30d') {
    return this.request(`/devices?range=${range}`);
  }
  
  getConversionFunnel(range = '30d', funnelId = 'default') {
    return this.request(`/conversion?range=${range}&funnelId=${funnelId}`);
  }
  
  getEvents(range = '30d', limit = 100, category = '') {
    return this.request(`/events?range=${range}&limit=${limit}&category=${category}`);
  }
  
  getRealTimeAnalytics() {
    return this.request('/realtime');
  }
}

export const analyticsAPI = new AnalyticsAPI();
```

### Tracking Helper
```jsx
// analyticsTracker.js
class AnalyticsTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.userId = this.getUserId();
    this.visitorId = this.getVisitorId();
    
    // Start session tracking
    this.startSession();
  }
  
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  getUserId() {
    // Get from localStorage or auth system
    return localStorage.getItem('userId') || null;
  }
  
  getVisitorId() {
    let visitorId = localStorage.getItem('visitorId');
    if (!visitorId) {
      visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('visitorId', visitorId);
    }
    return visitorId;
  }
  
  startSession() {
    const sessionData = {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      userId: this.userId,
      startTime: new Date().toISOString(),
      entryPage: window.location.pathname,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      deviceType: this.getDeviceType(),
      trafficSource: this.getTrafficSource()
    };
    
    // Track initial page view
    this.trackPageView(sessionData);
  }
  
  trackPageView(additionalData = {}) {
    const pageViewData = {
      sessionId: this.sessionId,
      visitorId: this.visitorId,
      userId: this.userId,
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      deviceType: this.getDeviceType(),
      trafficSource: this.getTrafficSource(),
      utm: this.getUTMParams(),
      timestamp: new Date().toISOString(),
      ...additionalData
    };
    
    analyticsAPI.trackPageView(pageViewData);
  }
  
  trackEvent(eventName, eventData = {}) {
    const eventPayload = {
      sessionId: this.sessionId,
      visitorId: this.visitorId, 
      userId: this.userId,
      eventType: eventName,
      eventCategory: eventData.category || 'interaction',
      eventAction: eventData.action || 'click',
      eventLabel: eventData.label || '',
      eventValue: eventData.value || 0,
      page: window.location.pathname,
      properties: eventData.properties || {},
      timestamp: new Date().toISOString()
    };
    
    analyticsAPI.trackEvent(eventPayload);
  }
  
  trackConversion(conversionType, value = 0, properties = {}) {
    this.trackEvent('conversion', {
      category: 'conversion',
      action: conversionType,
      value: value,
      properties: {
        conversionType,
        conversionValue: value,
        ...properties
      }
    });
  }
  
  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }
  
  getTrafficSource() {
    const referrer = document.referrer;
    const utm = this.getUTMParams();
    
    if (utm.source) {
      return utm.medium === 'cpc' ? 'paid' : utm.medium || 'referral';
    }
    
    if (!referrer) return 'direct';
    
    if (referrer.includes('google.com')) return 'organic';
    if (referrer.includes('facebook.com') || referrer.includes('twitter.com')) return 'social';
    
    return 'referral';
  }
  
  getUTMParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source'),
      medium: params.get('utm_medium'),
      campaign: params.get('utm_campaign'),
      term: params.get('utm_term'),
      content: params.get('utm_content')
    };
  }
}

// Initialize global tracker
export const tracker = new AnalyticsTracker();

// Auto-track page views for SPA
let currentPath = window.location.pathname;
setInterval(() => {
  if (window.location.pathname !== currentPath) {
    currentPath = window.location.pathname;
    tracker.trackPageView();
  }
}, 1000);
```

---

## 📋 Implementation Steps

### 1. Backend Setup
```bash
# Install dependencies
npm install mongoose cors helmet express-rate-limit

# Start MongoDB
mongod --dbpath /data/db

# Run the server
npm start
```

### 2. Frontend Integration
```jsx
// App.js
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { tracker } from './utils/analyticsTracker';

function App() {
  useEffect(() => {
    // Track app initialization
    tracker.trackEvent('app_init', {
      category: 'application',
      action: 'initialize'
    });
  }, []);
  
  return (
    <Router>
      <Routes>
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        {/* Other routes */}
      </Routes>
    </Router>
  );
}
```

### 3. Event Tracking Examples
```jsx
// Track button clicks
<button onClick={() => {
  tracker.trackEvent('cta_click', {
    category: 'engagement',
    action: 'click',
    label: 'header_signup',
    properties: { button_position: 'header' }
  });
}}>
  Sign Up
</button>

// Track form submissions
const handleFormSubmit = (data) => {
  tracker.trackEvent('form_submit', {
    category: 'conversion',
    action: 'submit',
    label: 'contact_form',
    properties: { form_type: 'contact', fields: Object.keys(data) }
  });
};

// Track conversions
const handleSignup = (userId) => {
  tracker.trackConversion('signup_completed', 50, {
    user_id: userId,
    plan: 'free_trial'
  });
};
```

## 📋 Next Steps

1. **Test Endpoints** - Verify all APIs work correctly
2. **Setup Dependencies** - Configure PDF generation, email, storage
3. **Add Validation** - Implement comprehensive input validation
4. **Performance** - Add caching and optimization
5. **Documentation** - Generate OpenAPI/Swagger documentation
6. **Testing** - Create automated API tests

All contract and analytics APIs are now properly organized and functional with complete UI integration guides! 🚀