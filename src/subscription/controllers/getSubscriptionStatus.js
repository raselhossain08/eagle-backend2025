const User = require("../../user/models/user.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/subscription/status:
 *   get:
 *     summary: Get user subscription status
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 subscription:
 *                   type: string
 *                   enum: [None, Basic, Diamond, Infinity, Script]
 *                 features:
 *                   type: array
 *                   items:
 *                     type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
module.exports = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select("subscription");
    if (!user) {
      throw createError(404, "User not found");
    }

    // Define features based on subscription level
    const subscriptionFeatures = {
      None: ["Basic access"],
      Basic: ["Basic access", "Limited features"],
      Diamond: ["Basic access", "Premium features", "Priority support"],
      Infinity: [
        "Basic access",
        "Premium features",
        "Priority support",
        "All scripts",
        "AI Advisor",
      ],
      Script: ["Basic access", "Script access", "Trading tools"],
    };

    res.json({
      success: true,
      subscription: user.subscription,
      features:
        subscriptionFeatures[user.subscription] || subscriptionFeatures["None"],
    });
  } catch (err) {
    next(err);
  }
};





