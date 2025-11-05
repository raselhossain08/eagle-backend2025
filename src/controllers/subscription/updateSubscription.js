const User = require("../../models/user.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/subscription/update:
 *   put:
 *     summary: Update user subscription
 *     tags: [Subscription]
 *     security:
 *       - bearerAuth: []
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
 *                 description: New subscription level
 *     responses:
 *       200:
 *         description: Subscription updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 subscription:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
module.exports = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

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
      message: "Subscription updated successfully",
      subscription: user.subscription,
    });
  } catch (err) {
    next(err);
  }
};
