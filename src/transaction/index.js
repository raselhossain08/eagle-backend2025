const transactionRoutes = require('./routes/transaction.routes');
const Transaction = require('./models/transaction.model');
const transactionService = require('./services/transaction.service');

module.exports = {
    transactionRoutes,
    Transaction,
    transactionService,
};
