/**
 * Dashboard Module Index
 * Central export file for all dashboard module components
 */

// Routes
const dashboardRoutes = require('./routes/dashboard.routes');
const supportRoutes = require('./routes/support.routes');
const searchRoutes = require('./routes/search.routes');
const notificationRoutes = require('./routes/notification.routes');
const supportToolsRoutes = require('./routes/supportTools.routes');
const communicationProvidersRoutes = require('./routes/communicationProviders.routes');
const contentControlsRoutes = require('./routes/contentControls.routes');

// Controllers
const dashboardController = require('./controllers/dashboard');
const supportController = require('./controllers/support.controller');
const supportToolsController = require('./controllers/supportTools.controller');
const searchController = require('./controllers/search.controller');
const notificationController = require('./controllers/notification.controller');
const savedReplyController = require('./controllers/savedReply.controller');
const communicationProvidersController = require('./controllers/communicationProviders.controller');
const contentControlsController = require('./controllers/contentControls.controller');

// Services
const communicationProvidersService = require('./services/communicationProviders.service');
const notificationService = require('./services/notification.service');
const supportService = require('./services/support.service');
const savedReplyService = require('./services/savedReply.service');
const emailService = require('./services/email.service');
const emailResendService = require('./services/emailResend.service');
const emailServiceAlt = require('./services/emailService');

// Models
const Dashboard = require('./models/dashboard.model');
const Notification = require('./models/notification.model');
const SavedReply = require('./models/savedReply.model');

module.exports = {
  // Routes
  dashboardRoutes,
  supportRoutes,
  searchRoutes,
  notificationRoutes,
  supportToolsRoutes,
  communicationProvidersRoutes,
  contentControlsRoutes,
  
  // Controllers
  dashboardController,
  supportController,
  supportToolsController,
  searchController,
  notificationController,
  savedReplyController,
  communicationProvidersController,
  contentControlsController,
  
  // Services
  communicationProvidersService,
  notificationService,
  supportService,
  savedReplyService,
  emailService,
  emailResendService,
  emailServiceAlt,
  
  // Models
  Dashboard,
  Notification,
  SavedReply
};





