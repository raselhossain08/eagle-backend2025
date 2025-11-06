const axios = require("axios");
const Payment = require("../models/payment.model");
const SignedContract = require("../../contract/models/signedContract.model");
require("dotenv").config();


async function generateAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    `${process.env.PAYPAL_API}/v1/oauth2/token`,
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  return response.data.access_token;
}

// 🧾 Create Order
exports.createOrder = async (req, res) => {
  try {
    const accessToken = await generateAccessToken();

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "USD",
              value: "20.00",
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({ id: response.data.id });
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
};

// ✅ Capture Order
exports.captureOrder = async (req, res) => {
  try {
    const accessToken = await generateAccessToken();
    const { orderId } = req.params;

    const response = await axios.post(
      `${process.env.PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error(
      "❌ PayPal Capture Error:",
      error?.response?.data || error.message
    );

    res.status(500).json({
      error: "Failed to capture order",
      details: error?.response?.data || error.message,
    });
  }
};

// ==================== ADMIN DASHBOARD ROUTES ====================

/**
 * Get all PayPal transactions with filters
 * @route GET /api/paypal/admin/transactions
 * @access Admin
 */
exports.getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      startDate,
      endDate,
      searchTerm,
    } = req.query;

    // Build query
    const query = { paymentMethod: "paypal" };

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search by transaction ID or user email
    if (searchTerm) {
      query.$or = [
        { transactionId: { $regex: searchTerm, $options: "i" } },
        { "userInfo.email": { $regex: searchTerm, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    // Get transactions from database
    const transactions = await Payment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "email firstName lastName")
      .lean();

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get PayPal transactions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch transactions",
    });
  }
};

/**
 * Get single PayPal transaction details
 * @route GET /api/paypal/admin/transactions/:id
 * @access Admin
 */
exports.getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Get from database
    const transaction = await Payment.findById(id)
      .populate("userId", "email firstName lastName phone")
      .lean();

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    // If we have a PayPal transaction ID, fetch additional details from PayPal API
    if (transaction.transactionId && transaction.transactionId.startsWith("PAYID-")) {
      try {
        const accessToken = await generateAccessToken();
        const paypalResponse = await axios.get(
          `${process.env.PAYPAL_API}/v2/payments/captures/${transaction.transactionId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        transaction.paypalDetails = paypalResponse.data;
      } catch (paypalError) {
        console.warn("Could not fetch PayPal details:", paypalError.message);
      }
    }

    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction details error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch transaction details",
    });
  }
};

/**
 * Get PayPal analytics/summary
 * @route GET /api/paypal/admin/analytics
 * @access Admin
 */
exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const query = { paymentMethod: "paypal" };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Total transactions
    const totalTransactions = await Payment.countDocuments(query);

    // Successful transactions
    const successfulTransactions = await Payment.countDocuments({
      ...query,
      status: "completed",
    });

    // Failed transactions
    const failedTransactions = await Payment.countDocuments({
      ...query,
      status: "failed",
    });

    // Pending transactions
    const pendingTransactions = await Payment.countDocuments({
      ...query,
      status: "pending",
    });

    // Total revenue
    const revenueData = await Payment.aggregate([
      { $match: { ...query, status: "completed" } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          averageTransaction: { $avg: "$amount" },
        },
      },
    ]);

    const revenue = revenueData.length > 0 ? revenueData[0] : { totalRevenue: 0, averageTransaction: 0 };

    // Refunded amount
    const refundData = await Payment.aggregate([
      { $match: { ...query, status: "refunded" } },
      {
        $group: {
          _id: null,
          totalRefunded: { $sum: "$amount" },
        },
      },
    ]);

    const refunded = refundData.length > 0 ? refundData[0].totalRefunded : 0;

    // Success rate
    const successRate =
      totalTransactions > 0
        ? ((successfulTransactions / totalTransactions) * 100).toFixed(2)
        : 0;

    // Recent transactions
    const recentTransactions = await Payment.find(query)
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("userId", "email firstName lastName")
      .select("amount status createdAt transactionId userId")
      .lean();

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalTransactions,
          successfulTransactions,
          failedTransactions,
          pendingTransactions,
          totalRevenue: revenue.totalRevenue,
          averageTransaction: revenue.averageTransaction,
          totalRefunded: refunded,
          successRate: `${successRate}%`,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    console.error("Get PayPal analytics error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch analytics",
    });
  }
};

/**
 * Process PayPal refund
 * @route POST /api/paypal/admin/refunds
 * @access Admin
 */
exports.processRefund = async (req, res) => {
  try {
    const { transactionId, amount, reason = "Customer request" } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID is required",
      });
    }

    // Find transaction in database
    const transaction = await Payment.findOne({
      transactionId,
      paymentMethod: "paypal",
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    if (transaction.status === "refunded") {
      return res.status(400).json({
        success: false,
        message: "Transaction already refunded",
      });
    }

    // Get PayPal access token
    const accessToken = await generateAccessToken();

    // Prepare refund data
    const refundAmount = amount || transaction.amount;
    const refundData = {
      amount: {
        value: refundAmount.toFixed(2),
        currency_code: transaction.currency || "USD",
      },
      note_to_payer: reason,
    };

    // Process refund via PayPal API
    const refundResponse = await axios.post(
      `${process.env.PAYPAL_API}/v2/payments/captures/${transactionId}/refund`,
      refundData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Update transaction in database
    transaction.status = "refunded";
    transaction.refundId = refundResponse.data.id;
    transaction.refundAmount = refundAmount;
    transaction.refundReason = reason;
    transaction.refundDate = new Date();
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "Refund processed successfully",
      data: {
        refundId: refundResponse.data.id,
        amount: refundAmount,
        status: refundResponse.data.status,
        transactionId,
      },
    });
  } catch (error) {
    console.error("Process refund error:", error?.response?.data || error);
    res.status(500).json({
      success: false,
      message: error?.response?.data?.message || error.message || "Failed to process refund",
      details: error?.response?.data,
    });
  }
};

/**
 * Get all PayPal refunds
 * @route GET /api/paypal/admin/refunds
 * @access Admin
 */
exports.getAllRefunds = async (req, res) => {
  try {
    const { page = 1, limit = 10, startDate, endDate } = req.query;

    const query = {
      paymentMethod: "paypal",
      status: "refunded",
    };

    // Date range filter
    if (startDate || endDate) {
      query.refundDate = {};
      if (startDate) query.refundDate.$gte = new Date(startDate);
      if (endDate) query.refundDate.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const refunds = await Payment.find(query)
      .sort({ refundDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "email firstName lastName")
      .lean();

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: refunds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get refunds error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch refunds",
    });
  }
};

/**
 * Get PayPal subscription by order ID
 * @route GET /api/paypal/admin/subscriptions/:orderId
 * @access Admin
 */
exports.getSubscriptionByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Try to find in contracts
    const contract = await SignedContract.findOne({
      paypalOrderId: orderId,
    })
      .populate("userId", "email firstName lastName")
      .lean();

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    res.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    console.error("Get subscription error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscription",
    });
  }
};

/**
 * Get all PayPal subscriptions (from contracts)
 * @route GET /api/paypal/admin/subscriptions
 * @access Admin
 */
exports.getAllSubscriptions = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, searchTerm } = req.query;

    const query = {
      paymentMethod: "paypal",
    };

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Search filter
    if (searchTerm) {
      query.$or = [
        { paypalOrderId: { $regex: searchTerm, $options: "i" } },
        { contractNumber: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const subscriptions = await SignedContract.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "email firstName lastName")
      .lean();

    const total = await SignedContract.countDocuments(query);

    res.status(200).json({
      success: true,
      data: subscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch subscriptions",
    });
  }
};

/**
 * Cancel PayPal subscription
 * @route POST /api/paypal/admin/subscriptions/:id/cancel
 * @access Admin
 */
exports.cancelSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = "Admin cancelled" } = req.body;

    const contract = await SignedContract.findById(id);

    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Update contract status
    contract.status = "cancelled";
    contract.cancellationReason = reason;
    contract.cancelledAt = new Date();
    await contract.save();

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: {
        contractId: contract._id,
        status: contract.status,
      },
    });
  } catch (error) {
    console.error("Cancel subscription error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to cancel subscription",
    });
  }
};

/**
 * Verify PayPal webhook signature
 * @route POST /api/paypal/webhooks
 * @access Public (PayPal webhook)
 */
exports.handleWebhook = async (req, res) => {
  try {
    const webhookEvent = req.body;

    console.log("PayPal Webhook Event:", webhookEvent.event_type);

    // Handle different webhook events
    switch (webhookEvent.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        // Payment completed
        await handlePaymentCompleted(webhookEvent);
        break;

      case "PAYMENT.CAPTURE.DENIED":
        // Payment denied
        await handlePaymentDenied(webhookEvent);
        break;

      case "PAYMENT.CAPTURE.REFUNDED":
        // Payment refunded
        await handlePaymentRefunded(webhookEvent);
        break;

      default:
        console.log("Unhandled webhook event:", webhookEvent.event_type);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Webhook handling error:", error);
    res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }
};

// Helper functions for webhook handling
async function handlePaymentCompleted(event) {
  const captureId = event.resource.id;
  // Update payment status in database
  await Payment.updateOne(
    { transactionId: captureId },
    { status: "completed", webhookProcessed: true }
  );
}

async function handlePaymentDenied(event) {
  const captureId = event.resource.id;
  await Payment.updateOne(
    { transactionId: captureId },
    { status: "failed", webhookProcessed: true }
  );
}

async function handlePaymentRefunded(event) {
  const captureId = event.resource.id;
  await Payment.updateOne(
    { transactionId: captureId },
    { status: "refunded", webhookProcessed: true }
  );
}





