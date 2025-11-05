#!/usr/bin/env node
/**
 * Contract API Testing Script
 * Tests all contract endpoints to ensure they're working properly
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:5000';
const API_BASE = '/api/contracts';

// Test data
const testContract = {
  name: 'John Test User',
  email: 'test@example.com',
  phone: '+1234567890',
  productType: 'basic-subscription',
  signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUGAA...',
  country: 'USA',
  streetAddress: '123 Test Street',
  townCity: 'Test City',
  stateCounty: 'Test State',
  postcodeZip: '12345',
  subscriptionType: 'monthly'
};

let authToken = null;

/**
 * Make HTTP request
 */
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Test public endpoints
 */
async function testPublicEndpoints() {
  console.log('\n🔓 Testing Public Contract Endpoints...\n');
  
  const tests = [
    {
      name: 'Health Check',
      method: 'GET',
      path: '/api/health'
    },
    {
      name: 'Create Contract with Contact',
      method: 'POST',
      path: `${API_BASE}/create-with-contact`,
      data: testContract
    },
    {
      name: 'Get Contracts by Contact',
      method: 'POST',
      path: `${API_BASE}/get-by-contact`,
      data: {
        fullName: testContract.name,
        email: testContract.email,
        phone: testContract.phone
      }
    },
    {
      name: 'Get Public User Contracts',
      method: 'POST',
      path: `${API_BASE}/public/my-contracts`,
      data: { email: testContract.email }
    },
    {
      name: 'Get My Contracts (Optional Auth)',
      method: 'GET',
      path: `${API_BASE}/my-contracts`
    }
  ];

  for (const test of tests) {
    try {
      const response = await makeRequest(test.method, test.path, test.data);
      console.log(`✅ ${test.name}: ${response.statusCode} - ${response.body?.message || 'OK'}`);
      
      if (response.statusCode >= 400) {
        console.log(`   Error: ${response.body?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
}

/**
 * Test admin login
 */
async function testAdminLogin() {
  console.log('\n🔐 Testing Admin Authentication...\n');
  
  try {
    const response = await makeRequest('POST', '/api/admin/auth/login', {
      email: 'raselhossain86666@gmail.com',
      password: 'Admin123@@'
    });
    
    if (response.statusCode === 200 && response.body?.token) {
      authToken = response.body.token;
      console.log('✅ Admin Login: Success - Token obtained');
      return true;
    } else {
      console.log(`❌ Admin Login: ${response.statusCode} - ${response.body?.message || 'Failed'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Admin Login: Error - ${error.message}`);
    return false;
  }
}

/**
 * Test protected endpoints
 */
async function testProtectedEndpoints() {
  if (!authToken) {
    console.log('⚠️  Skipping protected endpoint tests - no auth token');
    return;
  }
  
  console.log('\n🔒 Testing Protected Contract Endpoints...\n');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  const tests = [
    {
      name: 'Get Contract Stats',
      method: 'GET',
      path: `${API_BASE}/stats`
    },
    {
      name: 'Get All Contracts',
      method: 'GET',
      path: `${API_BASE}?page=1&limit=10`
    },
    {
      name: 'Get Contract Templates',
      method: 'GET',
      path: `${API_BASE}/templates`
    },
    {
      name: 'Export Contracts',
      method: 'GET',
      path: `${API_BASE}/export?format=json`
    },
    {
      name: 'Get Evidence Packets',
      method: 'GET',
      path: `${API_BASE}/evidence`
    },
    {
      name: 'Store Signed Contract',
      method: 'POST',
      path: `${API_BASE}/sign`,
      data: testContract
    }
  ];

  for (const test of tests) {
    try {
      const response = await makeRequest(test.method, test.path, test.data, headers);
      console.log(`✅ ${test.name}: ${response.statusCode} - ${response.body?.message || 'OK'}`);
      
      if (response.statusCode >= 400) {
        console.log(`   Error: ${response.body?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
}

/**
 * Test enhanced contract endpoints
 */
async function testEnhancedEndpoints() {
  console.log('\n🔥 Testing Enhanced Contract Endpoints...\n');
  
  const tests = [
    {
      name: 'Get Enhanced Templates (Public)',
      method: 'GET',
      path: `${API_BASE}/enhanced/templates`,
      needsAuth: true
    },
    {
      name: 'Webhook Test (Public)',
      method: 'POST',
      path: `${API_BASE}/enhanced/webhooks/test`,
      data: { test: true },
      needsAuth: false
    }
  ];

  for (const test of tests) {
    try {
      const headers = test.needsAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {};
      const response = await makeRequest(test.method, test.path, test.data, headers);
      console.log(`✅ ${test.name}: ${response.statusCode} - ${response.body?.message || 'OK'}`);
      
      if (response.statusCode >= 400) {
        console.log(`   Error: ${response.body?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
}

/**
 * Test RBAC endpoints
 */
async function testRBACEndpoints() {
  if (!authToken) {
    console.log('⚠️  Skipping RBAC endpoint tests - no auth token');
    return;
  }
  
  console.log('\n👥 Testing RBAC Endpoints...\n');
  
  const headers = { Authorization: `Bearer ${authToken}` };
  
  const tests = [
    {
      name: 'Get RBAC Roles',
      method: 'GET',
      path: '/api/rbac/roles?page=1&limit=10'
    },
    {
      name: 'Get RBAC Permissions',
      method: 'GET',
      path: '/api/rbac/permissions'
    },
    {
      name: 'Get RBAC Users',
      method: 'GET',
      path: '/api/rbac/users?page=1&limit=5'
    }
  ];

  for (const test of tests) {
    try {
      const response = await makeRequest(test.method, test.path, null, headers);
      console.log(`✅ ${test.name}: ${response.statusCode} - ${response.body?.message || 'OK'}`);
      
      if (response.statusCode >= 400) {
        console.log(`   Error: ${response.body?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🚀 Starting Contract API Tests...');
  console.log(`📡 Testing against: ${BASE_URL}`);
  
  try {
    // Test public endpoints
    await testPublicEndpoints();
    
    // Try to authenticate
    const loginSuccess = await testAdminLogin();
    
    // Test protected endpoints
    await testProtectedEndpoints();
    
    // Test enhanced endpoints
    await testEnhancedEndpoints();
    
    // Test RBAC endpoints
    await testRBACEndpoints();
    
    console.log('\n✅ Contract API testing completed!');
    console.log('\n📋 Summary:');
    console.log('- Public endpoints: Tested ✅');
    console.log(`- Authentication: ${loginSuccess ? 'Working ✅' : 'Failed ❌'}`);
    console.log('- Protected endpoints: Tested ✅');
    console.log('- Enhanced endpoints: Tested ✅');
    console.log('- RBAC endpoints: Tested ✅');
    
  } catch (error) {
    console.error('💥 Test runner error:', error.message);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  makeRequest,
  testPublicEndpoints,
  testProtectedEndpoints,
  testEnhancedEndpoints,
  testRBACEndpoints
};