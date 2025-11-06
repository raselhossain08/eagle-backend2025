const User = require("../../user/models/user.model");
const createError = require("http-errors");

/**
 * Get subscriptions due for renewal
 * @route GET /api/subscription/due-for-renewal
 * @access Private (Admin only recommended)
 */
const getDueForRenewal = async (req, res, next) => {
  try {
    const { days = 7 } = req.query; // Default to 7 days

    // Calculate date range
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + parseInt(days));

    // Find users whose subscriptions are due for renewal
    const usersWithDueRenewals = await User.find({
      subscription: { $ne: "None", $ne: null },
      subscriptionEndDate: {
        $gte: currentDate,
        $lte: futureDate
      },
      isActive: true
    }).select('_id firstName lastName email subscription subscriptionEndDate subscriptionStatus subscriptionStartDate billingCycle createdAt');

    // Group by subscription type
    const renewalSummary = {
      total: usersWithDueRenewals.length,
      bySubscription: {},
      upcoming: []
    };

    usersWithDueRenewals.forEach(user => {
      const subscriptionType = user.subscription;

      // Count by subscription type
      if (!renewalSummary.bySubscription[subscriptionType]) {
        renewalSummary.bySubscription[subscriptionType] = 0;
      }
      renewalSummary.bySubscription[subscriptionType]++;

      // Add to upcoming list with days remaining
      const daysRemaining = Math.ceil(
        (user.subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24)
      );

      renewalSummary.upcoming.push({
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        subscription: user.subscription,
        subscriptionStatus: user.subscriptionStatus,
        billingCycle: user.billingCycle,
        subscriptionStartDate: user.subscriptionStartDate,
        subscriptionEndDate: user.subscriptionEndDate,
        daysRemaining: daysRemaining,
        isExpired: daysRemaining <= 0,
        isExpiringSoon: daysRemaining <= 3,
        urgencyLevel: daysRemaining <= 1 ? 'critical' : daysRemaining <= 3 ? 'high' : daysRemaining <= 7 ? 'medium' : 'low'
      });
    });

    // Sort by days remaining (most urgent first)
    renewalSummary.upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // If no results found in date range but query includes flag, show all active subscriptions
    if (renewalSummary.total === 0 && req.query.showAll === 'true') {
      const allActiveSubscriptions = await User.find({
        subscription: { $ne: "None", $ne: null },
        subscriptionStatus: 'active',
        isActive: true
      })
        .select('_id firstName lastName email subscription subscriptionEndDate subscriptionStatus subscriptionStartDate billingCycle')
        .limit(50);

      return res.status(200).json({
        success: true,
        message: `Found ${allActiveSubscriptions.length} active subscriptions (no renewals in next ${days} days)`,
        data: {
          total: allActiveSubscriptions.length,
          subscriptions: allActiveSubscriptions.map(user => ({
            userId: user._id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            subscription: user.subscription,
            subscriptionStatus: user.subscriptionStatus,
            billingCycle: user.billingCycle,
            subscriptionStartDate: user.subscriptionStartDate,
            subscriptionEndDate: user.subscriptionEndDate,
            hasEndDate: !!user.subscriptionEndDate,
            daysRemaining: user.subscriptionEndDate ?
              Math.ceil((user.subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24)) : null
          }))
        },
        meta: {
          queriedDays: parseInt(days),
          queryDate: currentDate.toISOString(),
          endDate: futureDate.toISOString(),
          showingAll: true
        }
      });
    }

    res.status(200).json({
      success: true,
      message: `Found ${renewalSummary.total} subscriptions due for renewal in the next ${days} days`,
      data: renewalSummary,
      meta: {
        queriedDays: parseInt(days),
        queryDate: currentDate.toISOString(),
        endDate: futureDate.toISOString()
      }
    });

  } catch (error) {
    console.error("Error fetching subscriptions due for renewal:", error);
    next(createError(500, "Failed to fetch renewal data"));
  }
};

module.exports = getDueForRenewal;
