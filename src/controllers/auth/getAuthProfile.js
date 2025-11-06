const User = require("../../user/models/user.model");
const SignedContract = require("../../models/signedContract.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/auth/profile:
 *   get:
 *     summary: Get authenticated user profile with contracts
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile with contracts retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: User not found
 */
const getAuthProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get user info
    const user = await User.findById(userId).select("-password");
    if (!user) {
      throw createError(404, "User not found");
    }

    // Get user's contracts
    const contracts = await SignedContract.find({ userId })
      .select(
        "productType status subscriptionStartDate subscriptionEndDate subscriptionPrice"
      )
      .sort({ createdAt: -1 });

    // Return user with contracts
    const userWithContracts = {
      ...user.toObject(),
      contracts,
    };

    res.json({
      success: true,
      user: userWithContracts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = getAuthProfile;
