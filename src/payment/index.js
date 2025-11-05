/**
 * Payment Module Index
 * Central export file for all payment module components
 */

// Routes
const paymentRoutes = require('./routes/payment.routes');
const paypalRoutes = require('./routes/paypalRoutes');
const billingRoutes = require('./routes/billing.routes');
const taxRoutes = require('./routes/tax.routes');
const discountRoutes = require('./routes/discount.routes');
const dunningRoutes = require('./routes/dunning.routes');
const paymentProcessorsRoutes = require('./routes/paymentProcessors.routes');
const financeRoutes = require('./routes/finance.routes');
const invoicesRoutes = require('./routes/invoices.routes');

// Controllers
const paymentController = require('./controllers/payment');
const paypalController = require('./controllers/paypalController');
const billingController = require('./controllers/billing.controller');
const legacyPaymentController = require('./controllers/payment.controller');
const { PaymentController: paymentProcessorsController } = require('./controllers/paymentProcessors.controller');
const paymentRetryController = require('./controllers/paymentRetry.controller');
const discountController = require('./controllers/discount.controller');
const dunningController = require('./controllers/dunning.controller');
const taxController = require('./controllers/tax.controller');
const financeController = require('./controllers/finance');

// Services
const discountService = require('./services/discount.service');
const discountManagementService = require('./services/discountManagement.service');
const discountReportingService = require('./services/discountReporting.service');
const currencyService = require('./services/currency.service');
const taxService = require('./services/tax.service');
const taxCalculationService = require('./services/taxCalculation.service');
const taxProvidersService = require('./services/taxProviders.service');
const paymentProcessorsService = require('./services/paymentProcessors.service');
const paymentTokenMigrationService = require('./services/paymentTokenMigration.service');
const invoiceGenerationService = require('./services/invoiceGeneration.service');
const pciComplianceService = require('./services/pciCompliance.service');

// Models
const Billing = require('./models/billing.model');
const { DiscountCode, DiscountRedemption, PromotionCampaign } = require('./models/discount.model');
const FailedPayment = require('./models/failedPayment.model');
const Invoice = require('./models/invoice.model');
const Payment = require('./models/payment.model');
const PaymentMethod = require('./models/paymentMethod.model');
const TaxRate = require('./models/taxRate.model');
const TaxReport = require('./models/taxReport.model');
const DunningCampaign = require('./models/dunningCampaign.model');
const IntegrationConfig = require('./models/integrationConfig.model');

module.exports = {
  // Routes
  paymentRoutes,
  paypalRoutes,
  billingRoutes,
  taxRoutes,
  discountRoutes,
  dunningRoutes,
  paymentProcessorsRoutes,
  financeRoutes,
  invoicesRoutes,

  // Controllers
  paymentController,
  paypalController,
  billingController,
  legacyPaymentController,
  paymentProcessorsController,
  paymentRetryController,
  discountController,
  dunningController,
  taxController,
  financeController,

  // Services
  discountService,
  discountManagementService,
  discountReportingService,
  currencyService,
  taxService,
  taxCalculationService,
  taxProvidersService,
  paymentProcessorsService,
  paymentTokenMigrationService,
  invoiceGenerationService,
  pciComplianceService,

  // Models
  Billing,
  DiscountCode,
  DiscountRedemption,
  PromotionCampaign,
  FailedPayment,
  Invoice,
  Payment,
  PaymentMethod,
  TaxRate,
  TaxReport,
  DunningCampaign,
  IntegrationConfig
};





