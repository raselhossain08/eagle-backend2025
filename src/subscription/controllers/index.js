/**
 * Subscription Controllers Index - Consolidated
 * Exports all subscription controller functions
 */

// Core subscription operations
const cancelDowngrade = require('./cancelDowngrade');
const getSubscriptionStatus = require('./getSubscriptionStatus');
const getDueForRenewal = require('./getDueForRenewal');
const scheduleDowngrade = require('./scheduleDowngrade');
const updateSubscription = require('./updateSubscription');

// Main controllers
const subscriberController = require('./subscriber.controller');
const subscriberLifecycleController = require('./subscriberLifecycle.controller');
const subscriberLifecycleCompleteController = require('./subscriberLifecycleComplete.controller');
const subscriptionController = require('./subscription.controller');
const invoiceController = require('./invoice.controller');

module.exports = {
  // Individual functions
  cancelDowngrade,
  getSubscriptionStatus,
  getDueForRenewal,
  scheduleDowngrade,
  updateSubscription,

  // Controller classes
  subscriberController,
  subscriberLifecycleController,
  subscriberLifecycleCompleteController,
  subscriptionController,
  invoiceController
};