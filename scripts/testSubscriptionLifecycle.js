/**
 * Subscription Lifecycle Integration Test
 * Comprehensive testing for subscription system
 */

const axios = require('axios');
const mongoose = require('mongoose');

// Base configuration
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const API_VERSION = '/api/v1';

// Test configuration
const TEST_CONFIG = {
    baseURL: `${BASE_URL}${API_VERSION}`,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Subscription-Lifecycle-Tester/1.0'
    }
};

// Test data templates
const TEST_DATA = {
    testUser: {
        name: 'Test User',
        email: 'testuser+subscription@example.com',
        password: 'Test@123456',
        role: 'user'
    },
    testPlan: {
        name: 'Test Plan Pro',
        description: 'Test subscription plan',
        pricing: {
            monthly: { amount: 29.99, currency: 'USD' },
            quarterly: { amount: 79.99, currency: 'USD' },
            annual: { amount: 299.99, currency: 'USD' }
        },
        features: ['feature1', 'feature2', 'feature3'],
        status: 'active'
    },
    subscription: {
        billingCycle: 'monthly',
        paymentData: {
            amount: 29.99,
            currency: 'USD',
            paymentMethod: 'card'
        }
    }
};

class SubscriptionLifecycleTester {
    constructor() {
        this.authToken = null;
        this.testUserId = null;
        this.testPlanId = null;
        this.testSubscriptionId = null;
        this.results = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️',
            test: '🧪'
        }[type] || '📋';

        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async makeRequest(method, endpoint, data = null, headers = {}) {
        try {
            const config = {
                method,
                url: `${TEST_CONFIG.baseURL}${endpoint}`,
                headers: {
                    ...TEST_CONFIG.headers,
                    ...headers,
                    ...(this.authToken && { Authorization: `Bearer ${this.authToken}` })
                },
                timeout: TEST_CONFIG.timeout
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            return { success: true, data: response.data, status: response.status };
        } catch (error) {
            return {
                success: false,
                error: error.response ? error.response.data : error.message,
                status: error.response ? error.response.status : 500
            };
        }
    }

    async runTest(testName, testFunction) {
        this.log(`Running test: ${testName}`, 'test');
        try {
            await testFunction();
            this.results.passed++;
            this.results.tests.push({ name: testName, status: 'passed' });
            this.log(`Test passed: ${testName}`, 'success');
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({
                name: testName,
                status: 'failed',
                error: error.message
            });
            this.log(`Test failed: ${testName} - ${error.message}`, 'error');
        }
    }

    // Health check test
    async testHealthCheck() {
        const response = await this.makeRequest('GET', '/subscriptions/health');
        if (!response.success || response.status !== 200) {
            throw new Error('Health check failed');
        }
    }

    async testSubscriptionLifecycleHealth() {
        const response = await this.makeRequest('GET', '/subscriptions/lifecycle/health-check');
        if (!response.success || response.status !== 200) {
            throw new Error('Subscription lifecycle health check failed');
        }
    }

    // User registration and authentication
    async testUserRegistration() {
        const response = await this.makeRequest('POST', '/auth/register', TEST_DATA.testUser);
        if (!response.success) {
            throw new Error(`User registration failed: ${response.error.message || response.error}`);
        }

        this.testUserId = response.data.user?.id || response.data.data?.user?.id;
        if (!this.testUserId) {
            throw new Error('User ID not returned from registration');
        }
    }

    async testUserLogin() {
        const loginData = {
            email: TEST_DATA.testUser.email,
            password: TEST_DATA.testUser.password
        };

        const response = await this.makeRequest('POST', '/auth/login', loginData);
        if (!response.success) {
            throw new Error(`User login failed: ${response.error.message || response.error}`);
        }

        this.authToken = response.data.token || response.data.data?.token;
        if (!this.authToken) {
            throw new Error('Auth token not returned from login');
        }
    }

    // Plan creation (admin functionality)
    async testPlanCreation() {
        const response = await this.makeRequest('POST', '/subscriptions/plans', TEST_DATA.testPlan);
        if (!response.success) {
            throw new Error(`Plan creation failed: ${response.error.message || response.error}`);
        }

        this.testPlanId = response.data.plan?.id || response.data.data?.id;
        if (!this.testPlanId) {
            throw new Error('Plan ID not returned from creation');
        }
    }

    // Subscription lifecycle tests
    async testSubscriptionCreation() {
        const subscriptionData = {
            userId: this.testUserId,
            planId: this.testPlanId,
            ...TEST_DATA.subscription
        };

        const response = await this.makeRequest('POST', '/subscriptions/lifecycle/create', subscriptionData);
        if (!response.success) {
            throw new Error(`Subscription creation failed: ${response.error.message || response.error}`);
        }

        this.testSubscriptionId = response.data.subscription?.id || response.data.data?.id;
        if (!this.testSubscriptionId) {
            throw new Error('Subscription ID not returned from creation');
        }
    }

    async testSubscriptionDetails() {
        const response = await this.makeRequest('GET', `/subscriptions/lifecycle/${this.testSubscriptionId}/details`);
        if (!response.success) {
            throw new Error(`Get subscription details failed: ${response.error.message || response.error}`);
        }

        const subscription = response.data.subscription || response.data.data;
        if (!subscription) {
            throw new Error('Subscription data not returned');
        }
    }

    async testSubscriptionPause() {
        const pauseData = {
            reason: 'Testing pause functionality'
        };

        const response = await this.makeRequest('POST', `/subscriptions/lifecycle/${this.testSubscriptionId}/pause`, pauseData);
        if (!response.success) {
            throw new Error(`Subscription pause failed: ${response.error.message || response.error}`);
        }
    }

    async testSubscriptionResume() {
        const response = await this.makeRequest('POST', `/subscriptions/lifecycle/${this.testSubscriptionId}/resume`);
        if (!response.success) {
            throw new Error(`Subscription resume failed: ${response.error.message || response.error}`);
        }
    }

    async testSubscriptionCancellation() {
        const cancellationData = {
            reason: 'other',
            note: 'Testing cancellation functionality',
            immediate: false
        };

        const response = await this.makeRequest('POST', `/subscriptions/lifecycle/${this.testSubscriptionId}/cancel`, cancellationData);
        if (!response.success) {
            throw new Error(`Subscription cancellation failed: ${response.error.message || response.error}`);
        }
    }

    // Analytics tests
    async testSubscriptionAnalytics() {
        const response = await this.makeRequest('GET', '/subscriptions/lifecycle/analytics');
        if (!response.success) {
            throw new Error(`Subscription analytics failed: ${response.error.message || response.error}`);
        }
    }

    // Main test runner
    async runAllTests() {
        this.log('Starting Subscription Lifecycle Integration Tests', 'info');
        this.log('='.repeat(60), 'info');

        // Health checks
        await this.runTest('Health Check', () => this.testHealthCheck());
        await this.runTest('Subscription Lifecycle Health Check', () => this.testSubscriptionLifecycleHealth());

        // Authentication flow
        await this.runTest('User Registration', () => this.testUserRegistration());
        await this.runTest('User Login', () => this.testUserLogin());

        // Plan management (requires admin, might fail in test environment)
        await this.runTest('Plan Creation', () => this.testPlanCreation());

        // Subscription lifecycle tests
        if (this.testPlanId) {
            await this.runTest('Subscription Creation', () => this.testSubscriptionCreation());

            if (this.testSubscriptionId) {
                await this.runTest('Subscription Details', () => this.testSubscriptionDetails());
                await this.runTest('Subscription Pause', () => this.testSubscriptionPause());
                await this.runTest('Subscription Resume', () => this.testSubscriptionResume());
                await this.runTest('Subscription Cancellation', () => this.testSubscriptionCancellation());
            }
        }

        // Analytics (requires admin, might fail in test environment)
        await this.runTest('Subscription Analytics', () => this.testSubscriptionAnalytics());

        // Print results
        this.printResults();
    }

    printResults() {
        this.log('='.repeat(60), 'info');
        this.log('Test Results Summary', 'info');
        this.log('='.repeat(60), 'info');

        this.log(`Total Tests: ${this.results.passed + this.results.failed}`, 'info');
        this.log(`Passed: ${this.results.passed}`, 'success');
        this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'success');

        if (this.results.tests.length > 0) {
            this.log('\nDetailed Results:', 'info');
            this.results.tests.forEach(test => {
                const status = test.status === 'passed' ? '✅' : '❌';
                const error = test.error ? ` (${test.error})` : '';
                this.log(`${status} ${test.name}${error}`, test.status === 'passed' ? 'success' : 'error');
            });
        }

        this.log('='.repeat(60), 'info');

        if (this.results.failed === 0) {
            this.log('🎉 All tests passed! Subscription system is working correctly.', 'success');
        } else {
            this.log('⚠️ Some tests failed. Please check the subscription system configuration.', 'warning');
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new SubscriptionLifecycleTester();
    tester.runAllTests().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = SubscriptionLifecycleTester;