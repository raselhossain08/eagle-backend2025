/**
 * Plan Management API - Comprehensive Test Suite
 * 
 * This file contains tests for all Plan Management API endpoints.
 * 
 * Prerequisites:
 * 1. Server must be running on http://localhost:5000
 * 2. MongoDB must be connected
 * 3. You need a valid JWT token for protected routes
 * 
 * How to run:
 * node test-plan-api.js
 */

const BASE_URL = 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api/plans`;

// Replace with your actual JWT token
const AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE';

// Test data
const testPlanData = {
    name: "test-plan-" + Date.now(),
    displayName: "Test Plan",
    description: "This is a test plan for API testing",
    planType: "subscription",
    category: "basic",
    pricing: {
        monthly: {
            price: 29.99,
            originalPrice: 39.99,
            discount: "25% OFF",
            savings: 10
        },
        annual: {
            price: 299.99,
            originalPrice: 479.88,
            discount: "37% OFF",
            savings: 179.89
        }
    },
    features: [
        "Feature 1",
        "Feature 2",
        "Feature 3"
    ],
    advancedFeatures: [
        {
            name: "Advanced Feature",
            description: "This is an advanced feature",
            isExclusive: true
        }
    ],
    ui: {
        icon: "star",
        gradient: "from-blue-500 to-purple-600",
        color: "blue",
        badgeText: "Test Badge",
        badgeColor: "blue"
    },
    isActive: true,
    isPopular: false,
    isFeatured: false,
    sortOrder: 1,
    accessLevel: 1,
    tags: ["test", "api"]
};

let createdPlanId = null;

// Helper function to make API requests
async function apiRequest(endpoint, method = 'GET', body = null, requiresAuth = true) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

    const headers = {
        'Content-Type': 'application/json',
    };

    if (requiresAuth && AUTH_TOKEN !== 'YOUR_JWT_TOKEN_HERE') {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        return {
            status: response.status,
            statusText: response.statusText,
            data,
            ok: response.ok
        };
    } catch (error) {
        return {
            status: 0,
            statusText: 'Network Error',
            error: error.message,
            ok: false
        };
    }
}

// Test reporter
function logTest(testName, result, details = null) {
    const status = result.ok ? '✅' : '❌';
    console.log(`\n${status} ${testName}`);
    console.log(`   Status: ${result.status} ${result.statusText}`);

    if (details) {
        console.log(`   Details: ${details}`);
    }

    if (result.data) {
        console.log(`   Response:`, JSON.stringify(result.data, null, 2).substring(0, 200) + '...');
    }

    if (result.error) {
        console.log(`   Error: ${result.error}`);
    }
}

// Test Suite
async function runTests() {
    console.log('🚀 Starting Plan Management API Tests\n');
    console.log('='.repeat(60));

    // Check if server is running
    console.log('\n📡 Checking server connection...');
    try {
        const healthCheck = await fetch(`${BASE_URL}/api/health`);
        if (healthCheck.ok) {
            console.log('✅ Server is running');
        } else {
            console.log('❌ Server health check failed');
            return;
        }
    } catch (error) {
        console.log('❌ Cannot connect to server. Make sure it\'s running on http://localhost:5000');
        return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('PUBLIC ENDPOINTS (No Authentication Required)');
    console.log('='.repeat(60));

    // Test 1: Get Public Plans
    const test1 = await apiRequest('/public', 'GET', null, false);
    logTest('GET /api/plans/public - Get all public plans', test1);

    // Test 2: Get Public Plans by Type
    const test2 = await apiRequest('/public?planType=mentorship', 'GET', null, false);
    logTest('GET /api/plans/public?planType=mentorship - Get mentorship plans', test2);

    console.log('\n' + '='.repeat(60));
    console.log('PROTECTED ENDPOINTS (Authentication Required)');
    console.log('='.repeat(60));

    if (AUTH_TOKEN === 'YOUR_JWT_TOKEN_HERE') {
        console.log('\n⚠️  WARNING: Please set AUTH_TOKEN variable with a valid JWT token to test protected endpoints');
        console.log('   You can get a token by logging in through /api/auth/login');
        return;
    }

    // Test 3: Get All Plans
    const test3 = await apiRequest('/', 'GET');
    logTest('GET /api/plans - Get all plans with pagination', test3);

    // Test 4: Get Plan Statistics
    const test4 = await apiRequest('/stats', 'GET');
    logTest('GET /api/plans/stats - Get plan statistics', test4);

    // Test 5: Get Featured Plans
    const test5 = await apiRequest('/featured/active', 'GET');
    logTest('GET /api/plans/featured/active - Get featured plans', test5);

    // Test 6: Get Plans by Type
    const test6 = await apiRequest('/type/subscription', 'GET');
    logTest('GET /api/plans/type/subscription - Get subscription plans', test6);

    // Test 7: Get Plans by Category
    const test7 = await apiRequest('/category/basic', 'GET');
    logTest('GET /api/plans/category/basic - Get basic category plans', test7);

    console.log('\n' + '='.repeat(60));
    console.log('CRUD OPERATIONS');
    console.log('='.repeat(60));

    // Test 8: Create Plan
    const test8 = await apiRequest('/', 'POST', testPlanData);
    logTest('POST /api/plans - Create new plan', test8);

    if (test8.ok && test8.data.data) {
        createdPlanId = test8.data.data._id;
        console.log(`   📝 Created Plan ID: ${createdPlanId}`);
    }

    if (!createdPlanId) {
        console.log('\n⚠️  Cannot continue with tests that require a plan ID');
        return;
    }

    // Test 9: Get Plan by ID
    const test9 = await apiRequest(`/${createdPlanId}`, 'GET');
    logTest('GET /api/plans/:id - Get plan by ID', test9);

    // Test 10: Update Plan
    const updateData = {
        ...testPlanData,
        displayName: "Updated Test Plan",
        description: "This plan has been updated"
    };
    const test10 = await apiRequest(`/${createdPlanId}`, 'PUT', updateData);
    logTest('PUT /api/plans/:id - Update plan', test10);

    console.log('\n' + '='.repeat(60));
    console.log('PLAN MANAGEMENT OPERATIONS');
    console.log('='.repeat(60));

    // Test 11: Toggle Archive Status
    const test11 = await apiRequest(`/${createdPlanId}/archive`, 'PUT');
    logTest('PUT /api/plans/:id/archive - Toggle archive status', test11);

    // Test 12: Toggle Featured Status
    const test12 = await apiRequest(`/${createdPlanId}/feature`, 'PUT');
    logTest('PUT /api/plans/:id/feature - Toggle featured status', test12);

    // Test 13: Toggle Popular Status
    const test13 = await apiRequest(`/${createdPlanId}/popular`, 'PUT');
    logTest('PUT /api/plans/:id/popular - Toggle popular status', test13);

    // Test 14: Duplicate Plan
    const duplicateData = {
        name: "test-plan-duplicate-" + Date.now(),
        displayName: "Test Plan (Duplicate)"
    };
    const test14 = await apiRequest(`/${createdPlanId}/duplicate`, 'POST', duplicateData);
    logTest('POST /api/plans/:id/duplicate - Duplicate plan', test14);

    let duplicatedPlanId = null;
    if (test14.ok && test14.data.data) {
        duplicatedPlanId = test14.data.data._id;
        console.log(`   📝 Duplicated Plan ID: ${duplicatedPlanId}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('BULK OPERATIONS');
    console.log('='.repeat(60));

    // Test 15: Bulk Update Plans
    const planIds = [createdPlanId];
    if (duplicatedPlanId) planIds.push(duplicatedPlanId);

    const bulkUpdateData = {
        planIds,
        updateData: {
            tags: ["test", "bulk-updated"]
        }
    };
    const test15 = await apiRequest('/bulk', 'PUT', bulkUpdateData);
    logTest('PUT /api/plans/bulk - Bulk update plans', test15);

    // Test 16: Reorder Plans
    const reorderData = {
        planOrders: [
            { id: createdPlanId, sortOrder: 1 }
        ]
    };
    if (duplicatedPlanId) {
        reorderData.planOrders.push({ id: duplicatedPlanId, sortOrder: 2 });
    }
    const test16 = await apiRequest('/reorder', 'PUT', reorderData);
    logTest('PUT /api/plans/reorder - Reorder plans', test16);

    console.log('\n' + '='.repeat(60));
    console.log('FILTERED QUERIES');
    console.log('='.repeat(60));

    // Test 17: Get Plans with Filters
    const test17 = await apiRequest('/?planType=subscription&isActive=true&page=1&limit=5', 'GET');
    logTest('GET /api/plans?filters - Get plans with filters', test17);

    // Test 18: Get Plans with Sorting
    const test18 = await apiRequest('/?sortBy=displayName&sortOrder=asc', 'GET');
    logTest('GET /api/plans?sorting - Get plans with sorting', test18);

    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP - DELETE TEST DATA');
    console.log('='.repeat(60));

    // Test 19: Soft Delete Plan
    const test19 = await apiRequest(`/${createdPlanId}`, 'DELETE');
    logTest('DELETE /api/plans/:id - Soft delete plan', test19);

    // Test 20: Permanent Delete Plan
    const test20 = await apiRequest(`/${createdPlanId}?permanent=true`, 'DELETE');
    logTest('DELETE /api/plans/:id?permanent=true - Permanent delete plan', test20);

    // Delete duplicated plan if exists
    if (duplicatedPlanId) {
        const test21 = await apiRequest(`/${duplicatedPlanId}?permanent=true`, 'DELETE');
        logTest('DELETE /api/plans/:id?permanent=true - Delete duplicated plan', test21);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST SUITE COMPLETED');
    console.log('='.repeat(60));
}

// Run the tests
runTests().catch(console.error);
