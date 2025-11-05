const User = require("../../models/user.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/admin/users/{userId}/subscription:
 *   put:
 *     summary: Update user subscription (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscription
 *             properties:
 *               subscription:
 *                 type: string
 *                 enum: [None, Basic, Diamond, Infinity, Script]
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 */
module.exports = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { subscription } = req.body;

    if (!subscription) {
      throw createError(400, "Subscription level is required");
    }

    const validSubscriptions = [
      "None",
      "Basic",
      "Diamond",
      "Infinity",
      "Script",
    ];
    if (!validSubscriptions.includes(subscription)) {
      throw createError(400, "Invalid subscription level");
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { subscription },
      { new: true, select: "-password" }
    );

    if (!user) {
      throw createError(404, "User not found");
    }

    res.json({
      success: true,
      message: "User subscription updated successfully",
      user: {
        id: user._id,
        email: user.email,
        subscription: user.subscription,
      },
    });
  } catch (err) {
    next(err);
  }
};
