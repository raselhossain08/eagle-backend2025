const SignedContract = require("../../models/signedContract.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/subscription/cancel-downgrade:
 *   post:
 *     summary: Cancel a scheduled subscription downgrade
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
 *               - contractId
 *             properties:
 *               contractId:
 *                 type: string
 *                 description: ID of the contract with scheduled downgrade
 *     responses:
 *       200:
 *         description: Scheduled downgrade cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
module.exports = async (req, res, next) => {
  try {
    const { contractId } = req.body;
    const userId = req.user.id;

    console.log("Cancel downgrade request:", {
      userId,
      contractId,
      timestamp: new Date().toISOString(),
    });

    // Validate required fields
    if (!contractId) {
      throw createError(400, "Contract ID is required");
    }

    // Find the contract with scheduled downgrade
    const contract = await SignedContract.findOne({
      _id: contractId,
      userId: userId,
      status: "signed",
    });

    if (!contract) {
      throw createError(404, "Contract not found");
    }

    // Check if there's a scheduled downgrade
    if (!contract.scheduledDowngrade) {
      throw createError(400, "No scheduled downgrade found for this contract");
    }

    // Check if the downgrade is still cancellable (before effective date)
    const now = new Date();
    const effectiveDate = new Date(contract.scheduledDowngrade.effectiveDate);

    if (effectiveDate <= now) {
      throw createError(
        400,
        "Cannot cancel downgrade - effective date has passed"
      );
    }

    // Remove the scheduled downgrade
    const targetSubscription = contract.scheduledDowngrade.targetSubscription;
    contract.scheduledDowngrade = undefined;
    await contract.save();

    console.log("Downgrade cancelled successfully:", {
      contractId,
      previousTargetSubscription: targetSubscription,
    });

    res.status(200).json({
      success: true,
      message:
        "Scheduled downgrade has been cancelled successfully. Your current subscription will continue as normal.",
    });
  } catch (error) {
    console.error("Error cancelling downgrade:", error);
    next(error);
  }
};
