/**
 * Eagle Integration Routes
 * Main routing file for all integration endpoints
 */

const express = require('express');
const router = express.Router();

// Import integration route modules
const communicationRoutes = require('./communication.routes');
const taxRoutes = require('./tax.routes');
const integrationRoutes = require('./integrationSettings.routes');

// Mount integration routes
router.use('/communication', communicationRoutes);
router.use('/tax', taxRoutes);
router.use('/settings', integrationRoutes);

// Integration health check endpoint
router.get('/health', async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Integration services are running',
      timestamp: new Date().toISOString(),
      services: {
        communication: 'available',
        tax: 'available',
        settings: 'available'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Integration services health check failed',
      details: error.message
    });
  }
});

// Integration info endpoint
router.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      version: '1.0.0',
      services: {
        communication: {
          description: 'Email and SMS provider integrations',
          providers: {
            email: ['sendgrid', 'postmark'],
            sms: ['twilio']
          },
          endpoints: [
            'POST /communication/email/send',
            'POST /communication/sms/send',
            'GET /communication/health'
          ]
        },
        tax: {
          description: 'Tax calculation and compliance providers',
          providers: ['stripe_tax', 'taxjar', 'avalara'],
          endpoints: [
            'POST /tax/calculate',
            'POST /tax/transaction',
            'GET /tax/rates',
            'GET /tax/health'
          ]
        },
        settings: {
          description: 'Integration configuration management',
          endpoints: [
            'POST /settings/configure',
            'GET /settings/list',
            'PUT /settings/:id',
            'DELETE /settings/:id'
          ]
        }
      }
    }
  });
});

module.exports = router;