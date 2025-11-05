const User = require("../../user/models/user.model");
const { SignedContract } = require("../../models/signedContract.model");
const createError = require("http-errors");

/**
 * @swagger
 * /api/subscription/schedule-downgrade:
 *   post:
 *     summary: Schedule a subscription downgrade for the next billing cycle
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
 *               - targetSubscription
 *               - currentContractId
 *             properties:
 *               targetSubscription:
 *                 type: string
 *                 enum: [Basic, Diamond]
 *                 description: Target subscription level to downgrade to
 *               currentContractId:
 *                 type: string
 *                 description: ID of the current active contract
 *     responses:
 *       200:
 *         description: Downgrade scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 scheduledDowngrade:
 *                   type: object
 *                   properties:
 *                     targetSubscription:
 *                       type: string
 *                     effectiveDate:
 *                       type: string
 *                       format: date
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
module.exports = async (req, res, next) => {
  try {
    const { targetSubscription, currentContractId } = req.body;
    const userId = req.user.id;

    console.log("Downgrade request:", {
      userId,
      targetSubscription,
      currentContractId,
      timestamp: new Date().toISOString(),
    });

    // Validate required fields
    if (!targetSubscription || !currentContractId) {
      throw createError(
        400,
        "Target subscription and current contract ID are required"
      );
    }

    // Validate target subscription
    const validTargets = ["Basic", "Diamond"];
    if (!validTargets.includes(targetSubscription)) {
      throw createError(
        400,
        "Invalid target subscription. Must be Basic or Diamond"
      );
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      throw createError(404, "User not found");
    }

    // Find the current active contract
    const currentContract = await SignedContract.findOne({
      _id: currentContractId,
      userId: userId,
      status: "signed",
    });

    if (!currentContract) {
      throw createError(404, "Active contract not found");
    }

    // Validate the downgrade path
    const currentSubscription =
      getCurrentSubscriptionFromContract(currentContract);
    if (!isValidDowngrade(currentSubscription, targetSubscription)) {
      throw createError(
        400,
        `Invalid downgrade path from ${currentSubscription} to ${targetSubscription}`
      );
    }

    // Check if contract is still active (not expired)
    const now = new Date();
    const endDate = new Date(currentContract.subscriptionEndDate);
    if (endDate <= now) {
      throw createError(400, "Cannot downgrade an expired contract");
    }

    // Check if there's already a scheduled downgrade
    if (currentContract.scheduledDowngrade) {
      throw createError(
        400,
        "A downgrade is already scheduled for this contract"
      );
    }

    // Schedule the downgrade
    const effectiveDate = new Date(currentContract.subscriptionEndDate);

    currentContract.scheduledDowngrade = {
      targetSubscription: targetSubscription,
      scheduledDate: new Date(),
      effectiveDate: effectiveDate,
      status: "scheduled",
    };

    await currentContract.save();

    console.log("Downgrade scheduled successfully:", {
      contractId: currentContractId,
      targetSubscription,
      effectiveDate: effectiveDate.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Downgrade to ${targetSubscription} scheduled successfully. It will take effect on ${effectiveDate.toDateString()}.`,
      scheduledDowngrade: {
        targetSubscription: targetSubscription,
        effectiveDate: effectiveDate.toISOString(),
        currentSubscription: currentSubscription,
      },
    });
  } catch (error) {
    console.error("Error scheduling downgrade:", error);
    next(error);
  }
};

/**
 * Helper function to determine current subscription from contract
 */
function getCurrentSubscriptionFromContract(contract) {
  switch (contract.productType) {
    case "diamond":
      return "Diamond";
    case "infinity":
      return "Infinity";
    case "mentorship-package":
      return "Basic";
    default:
      return "Basic";
  }
}

/**
 * Helper function to validate downgrade paths
 */
function isValidDowngrade(current, target) {
  const downgradePaths = {
    Infinity: ["Diamond", "Basic"],
    Diamond: ["Basic"],
    Basic: [], // Can't downgrade from Basic
  };

  return downgradePaths[current] && downgradePaths[current].includes(target);
}





