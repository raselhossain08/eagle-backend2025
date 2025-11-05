const express = require('express');
const contractRoutes = require('./contract.routes');
const enhancedContractRoutes = require('../contract/routes/enhancedContract.routes');

const router = express.Router();

// Mount contract routes
router.use('/', contractRoutes);

// Mount enhanced contract routes under /enhanced prefix
router.use('/enhanced', enhancedContractRoutes);

module.exports = router;