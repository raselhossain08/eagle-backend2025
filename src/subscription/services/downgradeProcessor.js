const { SignedContract } = require("../../contract/models/contract.model");
const User = require("../../user/models/user.model");

/**
 * Background service to process scheduled subscription downgrades
 * This should be run daily via cron job or similar scheduling mechanism
 */
class DowngradeProcessor {
  constructor() {
    this.isProcessing = false;
  }

  /**
   * Process all scheduled downgrades that have reached their effective date
   */
  async processScheduledDowngrades() {
    if (this.isProcessing) {
      console.log("Downgrade processing already in progress, skipping...");
      return;
    }

    this.isProcessing = true;
    console.log(
      "Starting scheduled downgrade processing...",
      new Date().toISOString()
    );

    try {
      const now = new Date();

      // Find all contracts with scheduled downgrades that are due
      const contractsToDowngrade = await SignedContract.find({
        "scheduledDowngrade.status": "scheduled",
        "scheduledDowngrade.effectiveDate": { $lte: now },
        status: "signed",
      });

      console.log(
        `Found ${contractsToDowngrade.length} contracts ready for downgrade`
      );

      let processedCount = 0;
      let errorCount = 0;

      for (const contract of contractsToDowngrade) {
        try {
          await this.processContractDowngrade(contract);
          processedCount++;
          console.log(
            `Successfully processed downgrade for contract ${contract._id}`
          );
        } catch (error) {
          errorCount++;
          console.error(
            `Failed to process downgrade for contract ${contract._id}:`,
            error
          );

          // Mark as failed but don't stop processing other contracts
          contract.scheduledDowngrade.status = "failed";
          contract.scheduledDowngrade.failureReason = error.message;
          await contract.save();
        }
      }

      console.log(
        `Downgrade processing completed. Processed: ${processedCount}, Errors: ${errorCount}`
      );
    } catch (error) {
      console.error("Error during downgrade processing:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single contract downgrade
   */
  async processContractDowngrade(contract) {
    const targetSubscription = contract.scheduledDowngrade.targetSubscription;
    const userId = contract.userId;

    console.log(
      `Processing downgrade for user ${userId} from ${contract.productType} to ${targetSubscription}`
    );

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Update user subscription level
    user.subscription = targetSubscription;
    await user.save();

    // Mark the current contract as completed/downgraded
    contract.status = "downgraded";
    contract.scheduledDowngrade.status = "processed";
    contract.scheduledDowngrade.processedDate = new Date();

    // Set the subscription end date to now (contract expires)
    contract.subscriptionEndDate = new Date();

    await contract.save();

    // If downgrading to Basic (free), we're done
    if (targetSubscription === "Basic") {
      console.log(
        `User ${userId} downgraded to Basic (free) - no new contract needed`
      );
      return;
    }

    // If downgrading to Diamond from Infinity, create new Diamond contract
    if (
      targetSubscription === "Diamond" &&
      contract.productType === "infinity"
    ) {
      await this.createDowngradedContract(user, contract, "diamond");
      console.log(`Created new Diamond contract for user ${userId}`);
    }
  }

  /**
   * Create a new contract for the downgraded subscription
   */
  async createDowngradedContract(user, originalContract, newProductType) {
    const now = new Date();
    const endDate = new Date();

    // Set the new contract to end at the same time as the original would have
    endDate.setFullYear(endDate.getFullYear() + 1); // 1 year from now

    const newContract = new SignedContract({
      userId: user._id,
      name: user.firstName + " " + user.lastName,
      email: user.email,
      signature: originalContract.signature, // Reuse original signature
      productType: newProductType,
      pdfPath: originalContract.pdfPath, // Reuse original PDF or generate new one
      subscriptionType: originalContract.subscriptionType,
      subscriptionPrice: this.getSubscriptionPrice(newProductType),
      subscriptionStartDate: now,
      subscriptionEndDate: endDate,
      autoRenew: originalContract.autoRenew,
      status: "signed",
      ipAddress: originalContract.ipAddress,
      userAgent: originalContract.userAgent,
    });

    await newContract.save();
    return newContract;
  }

  /**
   * Get the price for a subscription type
   */
  getSubscriptionPrice(productType) {
    const prices = {
      diamond: 499,
      infinity: 999,
      basic: 0,
    };
    return prices[productType] || 0;
  }

  /**
   * Cancel a scheduled downgrade (if user changes their mind)
   */
  async cancelScheduledDowngrade(contractId, userId) {
    const contract = await SignedContract.findOne({
      _id: contractId,
      userId: userId,
      status: "signed",
    });

    if (!contract) {
      throw new Error("Contract not found");
    }

    if (!contract.scheduledDowngrade) {
      throw new Error("No scheduled downgrade found");
    }

    if (contract.scheduledDowngrade.status !== "scheduled") {
      throw new Error(
        "Downgrade cannot be cancelled - it may have already been processed"
      );
    }

    // Check if we're still before the effective date
    const now = new Date();
    const effectiveDate = new Date(contract.scheduledDowngrade.effectiveDate);

    if (effectiveDate <= now) {
      throw new Error("Cannot cancel downgrade - effective date has passed");
    }

    contract.scheduledDowngrade = undefined;
    await contract.save();

    console.log(`Cancelled scheduled downgrade for contract ${contractId}`);
    return true;
  }
}

module.exports = DowngradeProcessor;





