/**
 * WordPress API Authentication Middleware
 * Validates API requests from WordPress integration
 */

const createError = require("http-errors");

/**
 * Middleware to validate WordPress API requests
 * This is a more flexible version that allows for debugging and relaxed validation
 */
const validateWordPressAPI = (req, res, next) => {
  try {
    // Log incoming request for debugging
    console.log('WordPress API Request Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'x-api-key': req.headers['x-api-key'] ? 'Present' : 'Missing',
      'x-wc-webhook-source': req.headers['x-wc-webhook-source'] || 'Not provided',
      origin: req.headers.origin || 'Not provided',
      referer: req.headers.referer || 'Not provided',
      'content-type': req.headers['content-type'] || 'Not provided'
    });
    
    // Extract API key from various sources
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                  req.headers['x-api-key'] ||
                  req.query.api_key;
    
    // WooCommerce webhook validation
    const wcSignature = req.headers['x-wc-webhook-signature'];
    const wcSource = req.headers['x-wc-webhook-source'];
    const wcTopic = req.headers['x-wc-webhook-topic'];
    const wcDeliveryId = req.headers['x-wc-webhook-delivery-id'];
    
    // Custom webhook secret (from WooCommerce secret field)
    const webhookSecret = req.headers['x-wc-webhook-secret'] || 
                        req.body?.secret ||
                        req.query.secret;
    
    // Debug mode - if enabled, allow all requests for testing
    const debugMode = process.env.WP_API_DEBUG_MODE === 'true';
    if (debugMode) {
      console.log('WordPress API Debug Mode: Bypassing authentication checks');
      return next();
    }
    
    // Check if this is a WooCommerce webhook
    if (wcSource || wcTopic || wcSignature || wcDeliveryId) {
      console.log('WordPress API: WooCommerce webhook detected');
      
      // For WooCommerce webhooks, we'll be more lenient
      if (webhookSecret === process.env.WORDPRESS_API_KEY) {
        console.log('WordPress API: Webhook secret matched');
        return next();
      }
      
      if (wcSignature || wcSource) {
        console.log('WordPress API: WooCommerce webhook signature or source present');
        return next(); // Allow WooCommerce webhooks through
      }
    }
    
    // Direct database sync tools
    if (req.headers['x-wc-webhook-source'] === 'direct-db-sync-script') {
      console.log('WordPress API: Direct database sync tool detected');
      
      // Still validate API key but be more lenient
      if (apiKey) {
        const validApiKeys = [
          process.env.WORDPRESS_API_KEY,
          'eagle_jlphgw67ilj' // Fallback API key for testing
        ];
        
        if (validApiKeys.includes(apiKey)) {
          console.log('WordPress API: Valid API key for direct sync tool');
          return next();
        }
      }
    }
    
    // Standard API key validation
    if (apiKey) {
      const validApiKeys = [
        process.env.WORDPRESS_API_KEY,
        'eagle_jlphgw67ilj' // Fallback API key for testing
      ];
      
      if (validApiKeys.includes(apiKey)) {
        console.log('WordPress API: Valid API key');
        return next();
      }
    }
    
    // If none of the validation methods work, return 401 with helpful message
    console.log('WordPress API: Authentication failed');
    return res.status(401).json({ 
      success: false, 
      message: 'Authentication failed',
      expectedAuth: 'Authorization: Bearer YOUR_API_KEY or X-API-Key header',
      helpUrl: '/api/wordpress/debug'
    });
  } catch (error) {
    console.error('WordPress API authentication error:', error);
    next(createError(500, 'Internal server error during WordPress API authentication'));
  }
};

module.exports = validateWordPressAPI;
