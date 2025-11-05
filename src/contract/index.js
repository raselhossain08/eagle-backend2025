/**
 * Contract Module Index
 * Central export file for all contract module components
 */

// Routes
const contractRoutes = require('./routes/contract.routes');
const enhancedContractRoutes = require('./routes/enhancedContract.routes');

// Controllers
const contractController = require('./controllers/contract.controller');
const enhancedContractController = require('./controllers/enhancedContract.controller');

// Services
const contractIntegrationService = require('./services/contractIntegration.service');
const contractSigningService = require('./services/contractSigning.service');
const contractTemplateService = require('./services/contractTemplate.service');

// Models
const Contract = require('./models/contract.model');

module.exports = {
  // Routes
  contractRoutes,
  enhancedContractRoutes,
  
  // Controllers
  contractController,
  enhancedContractController,
  
  // Services
  contractIntegrationService,
  contractSigningService,
  contractTemplateService,
  
  // Models
  Contract
};





