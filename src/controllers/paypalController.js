const axios = require("axios");
const Transaction = require("../transaction/models/transaction.model");
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

// 📊 Get Admin Transactions (Real Database Data)
exports.getAdminTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const search = req.query.search;

    // Build query filter
    const query = { "psp.provider": "paypal" };

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Date range filter
    if (startDate || endDate) {
      query["timeline.initiatedAt"] = {};
      if (startDate) {
        query["timeline.initiatedAt"].$gte = new Date(startDate);
      }
      if (endDate) {
        query["timeline.initiatedAt"].$lte = new Date(endDate);
      }
    }

    // Search filter (transaction ID, email, payment method)
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: "i" } },
        { "psp.reference.orderId": { $regex: search, $options: "i" } },
        { "psp.reference.chargeId": { $regex: search, $options: "i" } },
        { "paymentMethod.details.email": { $regex: search, $options: "i" } },
      ];
    }

    // Execute queries in parallel
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("userId", "name email")
        .populate("subscriptionId", "planId status")
        .sort({ "timeline.initiatedAt": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query),
    ]);

    // Calculate statistics
    const stats = await Transaction.aggregate([
      { $match: { "psp.provider": "paypal" } },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amounts.gross" },
          successfulTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          failedTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pendingTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          refundedTransactions: {
            $sum: { $cond: [{ $eq: ["$status", "refunded"] }, 1, 0] },
          },
          totalRefunds: { $sum: "$refund.amount" },
        },
      },
    ]);

    const statistics = stats.length > 0 ? stats[0] : {
      totalTransactions: 0,
      totalAmount: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      pendingTransactions: 0,
      refundedTransactions: 0,
      totalRefunds: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
        statistics,
      },
    });
  } catch (error) {
    console.error("❌ PayPal Admin Transactions Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch PayPal transactions",
      message: error.message,
    });
  }
};


