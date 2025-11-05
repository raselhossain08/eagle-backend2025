const User = require("../models/user.model");
const Notification = require("../models/Notification");
// Note: Add other models as needed (Contract, Payment, etc.)

// Global search function
const globalSearch = async (req, res) => {
  try {
    const { q: query, type, limit = 10 } = req.query;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 2 characters long",
      });
    }

    const searchLimit = Math.min(parseInt(limit), 50); // Maximum 50 results
    const results = [];

    // Create search regex for partial matching
    const searchRegex = new RegExp(query.trim(), 'i');

    // Search in different collections based on type or search all
    const searchTypes = type ? [type] : ['subscriber', 'contract', 'notification', 'page'];

    for (const searchType of searchTypes) {
      if (results.length >= searchLimit) break;

      switch (searchType) {
        case 'subscriber':
        case 'user':
          try {
            // Search users (subscribers) - only for admin users
            if (req.user.role === 'admin' || req.user.role === 'super_admin') {
              const users = await User.find({
                $or: [
                  { firstName: searchRegex },
                  { lastName: searchRegex },
                  { email: searchRegex },
                ],
              })
                .select('firstName lastName email role createdAt')
                .limit(searchLimit - results.length)
                .lean();

              users.forEach(user => {
                results.push({
                  id: user._id,
                  type: 'subscriber',
                  title: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                  description: `${user.email} - ${user.role}`,
                  url: `/subscribers/${user._id}`,
                  data: {
                    email: user.email,
                    role: user.role,
                    createdAt: user.createdAt,
                  },
                });
              });
            }
          } catch (error) {
            console.error('User search error:', error);
          }
          break;

        case 'notification':
          try {
            // Search user's notifications
            const notifications = await Notification.find({
              userId,
              $or: [
                { title: searchRegex },
                { message: searchRegex },
              ],
            })
              .select('title message type read createdAt')
              .sort({ createdAt: -1 })
              .limit(searchLimit - results.length)
              .lean();

            notifications.forEach(notification => {
              results.push({
                id: notification._id,
                type: 'notification',
                title: notification.title,
                description: notification.message.substring(0, 100) + (notification.message.length > 100 ? '...' : ''),
                url: `/notifications`,
                data: {
                  type: notification.type,
                  read: notification.read,
                  createdAt: notification.createdAt,
                },
              });
            });
          } catch (error) {
            console.error('Notification search error:', error);
          }
          break;

        case 'contract':
          try {
            // Search contracts - placeholder (implement when Contract model exists)
            // const contracts = await Contract.find({...}).lean();
            
            // For now, return sample contract results
            if (query.toLowerCase().includes('contract') || query.toLowerCase().includes('agreement')) {
              results.push({
                id: 'contract_1',
                type: 'contract',
                title: `Contract: ${query}`,
                description: 'Enterprise Agreement - Pending',
                url: '/contracts/contract_1',
                data: {
                  status: 'pending',
                  type: 'enterprise',
                },
              });
            }
          } catch (error) {
            console.error('Contract search error:', error);
          }
          break;

        case 'page':
          // Search navigation pages and features
          const pages = [
            { title: 'Dashboard', url: '/', description: 'Main dashboard with overview' },
            { title: 'Subscribers', url: '/subscribers', description: 'Manage subscribers and users' },
            { title: 'Analytics', url: '/analytics', description: 'View analytics and reports' },
            { title: 'Contracts', url: '/contracts', description: 'Manage contracts and agreements' },
            { title: 'Payments', url: '/payments', description: 'Payment management and history' },
            { title: 'Settings', url: '/settings', description: 'Application settings and configuration' },
            { title: 'Profile', url: '/profile', description: 'User profile and account settings' },
            { title: 'Billing', url: '/billing', description: 'Billing information and invoices' },
            { title: 'Team', url: '/team', description: 'Team management and permissions' },
            { title: 'Reports', url: '/reports', description: 'Generate and download reports' },
            { title: 'Export', url: '/export', description: 'Export data and information' },
          ];

          pages.forEach(page => {
            if (
              page.title.toLowerCase().includes(query.toLowerCase()) ||
              page.description.toLowerCase().includes(query.toLowerCase())
            ) {
              results.push({
                id: page.url,
                type: 'page',
                title: page.title,
                description: page.description,
                url: page.url,
                data: {
                  category: 'navigation',
                },
              });
            }
          });
          break;
      }
    }

    // Remove duplicates and limit results
    const uniqueResults = results.slice(0, searchLimit);

    res.json({
      success: true,
      query: query.trim(),
      results: uniqueResults,
      count: uniqueResults.length,
      searchTypes,
    });
  } catch (error) {
    console.error("Global search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

// Search subscribers specifically
const searchSubscribers = async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    // Only admins can search subscribers
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 2 characters long",
      });
    }

    const searchLimit = Math.min(parseInt(limit), 50);
    const searchRegex = new RegExp(query.trim(), 'i');

    const subscribers = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ],
    })
      .select('firstName lastName email role subscription createdAt')
      .limit(searchLimit)
      .lean();

    const results = subscribers.map(subscriber => ({
      id: subscriber._id,
      type: 'subscriber',
      title: `${subscriber.firstName || ''} ${subscriber.lastName || ''}`.trim() || subscriber.email,
      description: `${subscriber.email} - ${subscriber.role} ${subscriber.subscription ? `(${subscriber.subscription})` : ''}`,
      url: `/subscribers/${subscriber._id}`,
      data: {
        email: subscriber.email,
        role: subscriber.role,
        subscription: subscriber.subscription,
        createdAt: subscriber.createdAt,
      },
    }));

    res.json({
      success: true,
      query: query.trim(),
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Search subscribers error:", error);
    res.status(500).json({
      success: false,
      message: "Subscriber search failed",
      error: error.message,
    });
  }
};

// Search contracts specifically
const searchContracts = async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Query must be at least 2 characters long",
      });
    }

    const searchLimit = Math.min(parseInt(limit), 50);

    // For now, return sample contract results
    // TODO: Implement when Contract model exists
    const sampleContracts = [
      {
        id: 'contract_1',
        title: 'Enterprise Agreement - Acme Corp',
        description: 'Enterprise subscription contract - Pending signature',
        status: 'pending',
        type: 'enterprise',
        client: 'Acme Corp',
        value: '$1,200/month',
      },
      {
        id: 'contract_2', 
        title: 'Diamond Plan Contract - TechStart Inc',
        description: 'Diamond subscription contract - Active',
        status: 'active',
        type: 'diamond',
        client: 'TechStart Inc',
        value: '$76/month',
      },
      {
        id: 'contract_3',
        title: 'Basic Plan Agreement - John Doe',
        description: 'Basic subscription contract - Expired',
        status: 'expired',
        type: 'basic',
        client: 'John Doe',
        value: '$35/month',
      },
    ];

    const results = sampleContracts
      .filter(contract => 
        contract.title.toLowerCase().includes(query.toLowerCase()) ||
        contract.description.toLowerCase().includes(query.toLowerCase()) ||
        contract.client.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, searchLimit)
      .map(contract => ({
        id: contract.id,
        type: 'contract',
        title: contract.title,
        description: contract.description,
        url: `/contracts/${contract.id}`,
        data: {
          status: contract.status,
          contractType: contract.type,
          client: contract.client,
          value: contract.value,
        },
      }));

    res.json({
      success: true,
      query: query.trim(),
      results,
      count: results.length,
    });
  } catch (error) {
    console.error("Search contracts error:", error);
    res.status(500).json({
      success: false,
      message: "Contract search failed",
      error: error.message,
    });
  }
};

// Get search suggestions
const getSearchSuggestions = async (req, res) => {
  try {
    const { q: query } = req.query;

    if (!query || query.trim().length < 1) {
      return res.json({
        success: true,
        suggestions: [],
      });
    }

    const suggestions = [];

    // Add page suggestions
    const pages = [
      'Dashboard', 'Subscribers', 'Analytics', 'Contracts', 
      'Payments', 'Settings', 'Profile', 'Billing', 'Team'
    ];

    pages.forEach(page => {
      if (page.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          text: page,
          type: 'page',
          icon: 'page',
        });
      }
    });

    // Add common search terms
    const commonTerms = [
      'payment failed', 'new subscriber', 'contract pending',
      'active users', 'expired contracts', 'revenue report'
    ];

    commonTerms.forEach(term => {
      if (term.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push({
          text: term,
          type: 'term',
          icon: 'search',
        });
      }
    });

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 10),
    });
  } catch (error) {
    console.error("Get search suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get search suggestions",
      error: error.message,
    });
  }
};

module.exports = {
  globalSearch,
  searchSubscribers,
  searchContracts,
  getSearchSuggestions,
};





