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
      subscription: { $ne: null },
      subscriptionExpiryDate: {
        $gte: currentDate,
        $lte: futureDate
      },
      isActive: true
    }).select('_id email subscription subscriptionExpiryDate subscriptionStatus createdAt');

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
        (user.subscriptionExpiryDate - currentDate) / (1000 * 60 * 60 * 24)
      );

      renewalSummary.upcoming.push({
        userId: user._id,
        email: user.email,
        subscription: user.subscription,
        subscriptionStatus: user.subscriptionStatus,
        expiryDate: user.subscriptionExpiryDate,
        daysRemaining: daysRemaining,
        isExpired: daysRemaining <= 0,
        isExpiringSoon: daysRemaining <= 3
      });
    });

    // Sort by days remaining (most urgent first)
    renewalSummary.upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);

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
