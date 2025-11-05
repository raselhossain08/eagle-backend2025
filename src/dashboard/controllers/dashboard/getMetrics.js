const User = require("../../models/user.model");

const getMetrics = async (req, res) => {
  try {
    const { period = 'monthly', breakdown, timezone = 'UTC' } = req.query;

    // Get user statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    
    // Calculate date range based on period
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'daily':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get new users in the period
    const newUsers = await User.countDocuments({
      createdAt: { $gte: startDate }
    });

    // Get subscription counts
    const subscriptionCounts = await User.aggregate([
      { $group: { _id: "$subscription", count: { $sum: 1 } } }
    ]);

    // Calculate basic metrics with mock data for now
    const metrics = {
      mrr: 124500,
      mrrChange: 12.5,
      mrrTarget: 150000,
      activeSubscribers: activeUsers,
      subscriberChange: 8.2,
      subscriberTarget: 3000,
      churnRate: 2.4,
      churnChange: -0.8,
      contractsToday: Math.floor(Math.random() * 20) + 5,
      contractChange: Math.floor(Math.random() * 10) - 5,
      contractTarget: 15,
      newUsers,
      totalUsers
    };

    let responseData = { ...metrics };

    // If breakdown by plan is requested
    if (breakdown === 'plan') {
      const plans = [
        { 
          name: "Enterprise Annual", 
          revenue: 45600, 
          subscriberCount: 152, 
          growth: 23 
        },
        { 
          name: "Pro Monthly", 
          revenue: 38200, 
          subscriberCount: 382, 
          growth: 18 
        },
        { 
          name: "Basic Monthly", 
          revenue: 28900, 
          subscriberCount: 578, 
          growth: 12 
        },
        { 
          name: "Pro Annual", 
          revenue: 21800, 
          subscriberCount: 218, 
          growth: 15 
        }
      ];

      responseData.plans = plans;
    }

    res.json({
      success: true,
      data: responseData,
      period,
      timezone,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching metrics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = getMetrics;





