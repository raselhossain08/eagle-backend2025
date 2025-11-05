/**
 * Subscription Module Index
 * Central export file for all subscription module components
 */

// Routes
const subscriptionRoutes = require('./routes/subscription.routes');
const subscriptionsRoutes = require('./routes/subscriptions.routes');
const subscriberRoutes = require('./routes/subscriber.routes');
const subscribersRoutes = require('./routes/subscribers.routes');

// Controllers
const subscriptionController = require('./controllers');
const subscriberController = require('./controllers/subscriber.controller');
const subscriberLifecycleController = require('./controllers/subscriberLifecycle.controller');
const subscriberLifecycleCompleteController = require('./controllers/subscriberLifecycleComplete.controller');

// Services
const subscriberService = require('./services/subscriber.service');
const downgradeProcessor = require('./services/downgradeProcessor');
const statusMappingService = require('./services/statusMapping.service');

// Models
const Subscription = require('./models/subscription.model');
const EnhancedSubscriber = require('./models/enhancedSubscriber.model');
const MembershipPlan = require('./models/membershipPlan.model');

module.exports = {
  // Routes
  subscriptionRoutes,
  subscriptionsRoutes,
  subscriberRoutes,
  subscribersRoutes,

  // Controllers
  subscriptionController,
  subscriberController,
  subscriberLifecycleController,
  subscriberLifecycleCompleteController,

  // Services
  subscriberService,
  downgradeProcessor,
  statusMappingService,

  // Models
  Subscription,
  EnhancedSubscriber,
  MembershipPlan
};





