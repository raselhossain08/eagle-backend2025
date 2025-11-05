const { SignedContract } = require("../models/contract.model");

// @desc    Get contract statistics
// @route   GET /api/contracts/stats
// @access  Protected
const getContractStats = async (req, res) => {
  try {
    // Get total contracts
    const totalContracts = await SignedContract.countDocuments();

    // Get contracts signed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const signedToday = await SignedContract.countDocuments({
      signedDate: { $gte: today },
      status: { $in: ['signed', 'completed'] }
    });

    // Get pending signatures
    const pendingSignatures = await SignedContract.countDocuments({
      status: { $in: ['pending', 'payment_pending'] }
    });

    // Calculate completion rate
    const completionRate = totalContracts > 0 ? 
      (await SignedContract.countDocuments({ status: { $in: ['signed', 'completed'] } }) / totalContracts * 100) : 0;

    res.json({
      success: true,
      data: {
        totalContracts,
        signedToday,
        pendingSignatures,
        completionRate: Math.round(completionRate),
        contractsChange: 12.5, // Mock data for now
        signedTodayChange: 8.3, // Mock data for now
        pendingChange: -5.2, // Mock data for now
        completionRateChange: 3.1 // Mock data for now
      }
    });
  } catch (error) {
    console.error("Error fetching contract stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch contract statistics",
      error: error.message
    });
  }
};

module.exports = { getContractStats };





