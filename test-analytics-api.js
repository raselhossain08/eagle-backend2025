/**
 * Analytics API Testing Suite
 * Tests all analytics endpoints including tracking and dashboard APIs
 * 
 * Usage: node test-analytics-api.js
 */

const axios = require('axios');

class AnalyticsAPITester {
  constructor(baseURL = 'http://localhost:5000') {
    this.baseURL = baseURL;
    this.authToken = null;
    this.sessionId = `test_session_${Date.now()}`;
    this.visitorId = `test_visitor_${Date.now()}`;
    this.userId = `test_user_${Date.now()}`;
  }

  async request(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (this.authToken && !endpoint.includes('/track/')) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      const response = await axios({
        url,
        method: options.method || 'GET',
        headers,
        data: options.body,
        validateStatus: () => true // Don't throw on any status code
      });

      return {
        status: response.status,
        data: response.data,
        headers: response.headers
      };
    } catch (error) {
      return {
        status: error.response?.status || 500,
        error: error.message
      };
    }
  }

  async authenticate() {
    console.log('\n🔐 Authenticating...');
    
    // Try to get auth token (replace with your actual auth endpoint)
    const authResponse = await this.request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@eagle.com',
        password: 'admin123'
      }
    });

    if (authResponse.status === 200 && authResponse.data.token) {
      this.authToken = authResponse.data.token;
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.log('⚠️  Authentication failed, testing public endpoints only');
      return false;
    }
  }

  async testTrackingEndpoints() {
    console.log('\n📊 Testing Public Tracking APIs...');
    const results = [];

    // Test 1: Track Page View
    console.log('\n1️⃣ Testing Track Page View');
    const pageViewData = {
      sessionId: this.sessionId,
      userId: this.userId,
      page: '/test-page',
      referrer: 'https://google.com',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      deviceType: 'desktop',
      trafficSource: 'organic',
      duration: 45000,
      utm: {
        source: 'google',
        medium: 'cpc',
        campaign: 'test_campaign',
        term: 'test_term',
        content: 'test_content'
      }
    };

    const pageViewResponse = await this.request('/api/analytics/track/pageview', {
      method: 'POST',
      body: pageViewData
    });

    results.push({
      test: 'Track Page View',
      endpoint: '/api/analytics/track/pageview',
      status: pageViewResponse.status,
      success: pageViewResponse.status === 201,
      data: pageViewResponse.data
    });

    console.log(`Status: ${pageViewResponse.status}`, pageViewResponse.status === 201 ? '✅' : '❌');

    // Test 2: Track Event
    console.log('\n2️⃣ Testing Track Event');
    const eventData = {
      sessionId: this.sessionId,
      userId: this.userId,
      eventType: 'button_click',
      eventCategory: 'engagement',
      eventAction: 'click',
      eventLabel: 'test_button',
      eventValue: 1,
      page: '/test-page',
      properties: {
        button_id: 'test-btn',
        button_text: 'Test Button',
        position: 'header'
      }
    };

    const eventResponse = await this.request('/api/analytics/track/event', {
      method: 'POST',
      body: eventData
    });

    results.push({
      test: 'Track Event',
      endpoint: '/api/analytics/track/event',
      status: eventResponse.status,
      success: eventResponse.status === 201,
      data: eventResponse.data
    });

    console.log(`Status: ${eventResponse.status}`, eventResponse.status === 201 ? '✅' : '❌');

    // Test 3: Update Session
    console.log('\n3️⃣ Testing Update Session');
    const sessionData = {
      sessionId: this.sessionId,
      action: 'update',
      data: {
        endTime: new Date().toISOString(),
        exitPage: '/test-page',
        totalEvents: 5,
        conversions: ['test_conversion']
      }
    };

    const sessionResponse = await this.request('/api/analytics/track/session', {
      method: 'POST',
      body: sessionData
    });

    results.push({
      test: 'Update Session',
      endpoint: '/api/analytics/track/session',
      status: sessionResponse.status,
      success: sessionResponse.status === 200,
      data: sessionResponse.data
    });

    console.log(`Status: ${sessionResponse.status}`, sessionResponse.status === 200 ? '✅' : '❌');

    return results;
  }

  async testAnalyticsEndpoints() {
    console.log('\n📈 Testing Protected Analytics APIs...');
    
    if (!this.authToken) {
      console.log('❌ Skipping protected endpoints - no authentication');
      return [];
    }

    const results = [];
    const ranges = ['7d', '30d', '90d'];

    // Test 1: Get Metrics
    console.log('\n1️⃣ Testing Get Metrics');
    for (const range of ranges) {
      const metricsResponse = await this.request(`/api/analytics/metrics?range=${range}`);
      
      results.push({
        test: `Get Metrics (${range})`,
        endpoint: `/api/analytics/metrics?range=${range}`,
        status: metricsResponse.status,
        success: metricsResponse.status === 200,
        data: metricsResponse.data
      });

      console.log(`${range} Range: ${metricsResponse.status}`, metricsResponse.status === 200 ? '✅' : '❌');
    }

    // Test 2: Get Traffic Sources
    console.log('\n2️⃣ Testing Get Traffic Sources');
    const trafficResponse = await this.request('/api/analytics/traffic?range=30d&limit=10');
    
    results.push({
      test: 'Get Traffic Sources',
      endpoint: '/api/analytics/traffic?range=30d&limit=10',
      status: trafficResponse.status,
      success: trafficResponse.status === 200,
      data: trafficResponse.data
    });

    console.log(`Status: ${trafficResponse.status}`, trafficResponse.status === 200 ? '✅' : '❌');

    // Test 3: Get Top Pages
    console.log('\n3️⃣ Testing Get Top Pages');
    const pagesResponse = await this.request('/api/analytics/pages?range=30d&limit=20');
    
    results.push({
      test: 'Get Top Pages',
      endpoint: '/api/analytics/pages?range=30d&limit=20',
      status: pagesResponse.status,
      success: pagesResponse.status === 200,
      data: pagesResponse.data
    });

    console.log(`Status: ${pagesResponse.status}`, pagesResponse.status === 200 ? '✅' : '❌');

    // Test 4: Get Device Breakdown
    console.log('\n4️⃣ Testing Get Device Breakdown');
    const devicesResponse = await this.request('/api/analytics/devices?range=30d');
    
    results.push({
      test: 'Get Device Breakdown',
      endpoint: '/api/analytics/devices?range=30d',
      status: devicesResponse.status,
      success: devicesResponse.status === 200,
      data: devicesResponse.data
    });

    console.log(`Status: ${devicesResponse.status}`, devicesResponse.status === 200 ? '✅' : '❌');

    // Test 5: Get Conversion Funnel
    console.log('\n5️⃣ Testing Get Conversion Funnel');
    const funnelResponse = await this.request('/api/analytics/conversion?range=30d&funnelId=signup_funnel');
    
    results.push({
      test: 'Get Conversion Funnel',
      endpoint: '/api/analytics/conversion?range=30d&funnelId=signup_funnel',
      status: funnelResponse.status,
      success: funnelResponse.status === 200,
      data: funnelResponse.data
    });

    console.log(`Status: ${funnelResponse.status}`, funnelResponse.status === 200 ? '✅' : '❌');

    // Test 6: Get Events
    console.log('\n6️⃣ Testing Get Events');
    const eventsResponse = await this.request('/api/analytics/events?range=30d&limit=100&category=engagement');
    
    results.push({
      test: 'Get Events',
      endpoint: '/api/analytics/events?range=30d&limit=100&category=engagement',
      status: eventsResponse.status,
      success: eventsResponse.status === 200,
      data: eventsResponse.data
    });

    console.log(`Status: ${eventsResponse.status}`, eventsResponse.status === 200 ? '✅' : '❌');

    return results;
  }

  async generateSampleData() {
    console.log('\n🎲 Generating Sample Analytics Data...');
    
    if (!this.authToken) {
      console.log('❌ Skipping sample data generation - no authentication');
      return;
    }

    const sampleResponse = await this.request('/api/analytics/generate-sample-data', {
      method: 'POST',
      body: {
        days: 30,
        users: 1000,
        sessions: 2500,
        events: 15000
      }
    });

    console.log(`Sample data generation: ${sampleResponse.status}`, sampleResponse.status === 201 ? '✅' : '❌');
    
    if (sampleResponse.data) {
      console.log('Sample data details:', sampleResponse.data);
    }

    return sampleResponse;
  }

  async testInvalidRequests() {
    console.log('\n⚠️ Testing Invalid Requests...');
    const results = [];

    // Test invalid range parameter
    const invalidRangeResponse = await this.request('/api/analytics/metrics?range=invalid');
    results.push({
      test: 'Invalid Range Parameter',
      endpoint: '/api/analytics/metrics?range=invalid',
      status: invalidRangeResponse.status,
      expectedStatus: 400,
      success: invalidRangeResponse.status === 400
    });

    console.log(`Invalid range: ${invalidRangeResponse.status}`, invalidRangeResponse.status === 400 ? '✅' : '❌');

    // Test missing required fields in tracking
    const incompleteTrackingResponse = await this.request('/api/analytics/track/pageview', {
      method: 'POST',
      body: {
        page: '/test' // Missing required fields
      }
    });

    results.push({
      test: 'Incomplete Tracking Data',
      endpoint: '/api/analytics/track/pageview',
      status: incompleteTrackingResponse.status,
      expectedStatus: 400,
      success: incompleteTrackingResponse.status === 400
    });

    console.log(`Incomplete data: ${incompleteTrackingResponse.status}`, incompleteTrackingResponse.status === 400 ? '✅' : '❌');

    return results;
  }

  generateReport(allResults) {
    console.log('\n📋 ANALYTICS API TEST REPORT');
    console.log('=' .repeat(50));

    const totalTests = allResults.length;
    const passedTests = allResults.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      allResults.filter(r => !r.success).forEach(result => {
        console.log(`- ${result.test}: ${result.status} (Expected: ${result.expectedStatus || '200/201'})`);
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
      });
    }

    console.log('\n✅ SUCCESSFUL TESTS:');
    allResults.filter(r => r.success).forEach(result => {
      console.log(`- ${result.test}: ${result.status}`);
    });

    // Test Categories
    const categories = {
      'Tracking APIs': allResults.filter(r => r.endpoint.includes('/track/')),
      'Analytics APIs': allResults.filter(r => r.endpoint.includes('/analytics/') && !r.endpoint.includes('/track/')),
      'Error Handling': allResults.filter(r => r.expectedStatus >= 400)
    };

    console.log('\n📊 RESULTS BY CATEGORY:');
    Object.entries(categories).forEach(([category, tests]) => {
      const passed = tests.filter(t => t.success).length;
      const total = tests.length;
      console.log(`${category}: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      categories
    };
  }

  async runAllTests() {
    console.log('🚀 Starting Analytics API Test Suite...');
    console.log(`Testing against: ${this.baseURL}`);
    
    const allResults = [];

    try {
      // Authenticate
      await this.authenticate();

      // Generate sample data first
      await this.generateSampleData();

      // Wait a moment for data to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Run tracking tests
      const trackingResults = await this.testTrackingEndpoints();
      allResults.push(...trackingResults);

      // Run analytics tests  
      const analyticsResults = await this.testAnalyticsEndpoints();
      allResults.push(...analyticsResults);

      // Run invalid request tests
      const invalidResults = await this.testInvalidRequests();
      allResults.push(...invalidResults);

      // Generate and display report
      const report = this.generateReport(allResults);

      console.log('\n🎯 RECOMMENDATIONS:');
      if (report.failedTests === 0) {
        console.log('🎉 All analytics APIs are working perfectly!');
        console.log('✅ Ready for production use');
      } else {
        console.log('🔧 Fix the failed endpoints before deploying');
        console.log('🧪 Consider adding more comprehensive error handling');
      }

      console.log('\n📚 NEXT STEPS:');
      console.log('1. Integrate analytics tracking in your frontend');
      console.log('2. Set up analytics dashboard UI components');
      console.log('3. Configure real-time analytics updates');
      console.log('4. Set up automated analytics reports');
      console.log('5. Add custom conversion funnels');

      return report;

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      return { error: error.message };
    }
  }
}

// Example usage and testing scenarios
const runAnalyticsTests = async () => {
  const tester = new AnalyticsAPITester();
  return await tester.runAllTests();
};

// Additional utility functions for advanced testing
const performLoadTest = async (concurrentUsers = 10, duration = 60) => {
  console.log(`\n🏋️ Running load test with ${concurrentUsers} concurrent users for ${duration}s...`);
  
  const promises = [];
  const startTime = Date.now();
  
  for (let i = 0; i < concurrentUsers; i++) {
    const promise = (async () => {
      const tester = new AnalyticsAPITester();
      let requestCount = 0;
      
      while (Date.now() - startTime < duration * 1000) {
        await tester.request('/api/analytics/track/pageview', {
          method: 'POST',
          body: {
            sessionId: `load_test_${i}_${Date.now()}`,
            page: `/load-test-${i}`,
            deviceType: 'desktop',
            trafficSource: 'direct'
          }
        });
        requestCount++;
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
      }
      
      return requestCount;
    })();
    
    promises.push(promise);
  }
  
  const results = await Promise.all(promises);
  const totalRequests = results.reduce((sum, count) => sum + count, 0);
  const rps = totalRequests / duration;
  
  console.log(`✅ Load test completed:`);
  console.log(`- Total requests: ${totalRequests}`);
  console.log(`- Requests per second: ${rps.toFixed(2)}`);
  console.log(`- Average per user: ${(totalRequests / concurrentUsers).toFixed(1)}`);
  
  return { totalRequests, rps, concurrentUsers, duration };
};

// Export for use in other files
module.exports = {
  AnalyticsAPITester,
  runAnalyticsTests,
  performLoadTest
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAnalyticsTests().then(report => {
    process.exit(report.failedTests > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}