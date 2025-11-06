const User = require("../../../user/models/user.model");
const { SignedContract } = require("../../models/contract.model");
const asyncHandler = require("../../../utils/asyncHandler");
const ApiError = require("../../../utils/ApiError");
const ApiResponse = require("../../../utils/ApiResponse");
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Get all subscribers with search, filter, and pagination
const getAllSubscribers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search = '',
    status = '',
    plan = '',
    country = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter object
  const filter = {};

  // Search across multiple fields
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
      { 'address.country': searchRegex },
      { company: searchRegex }
    ];
  }

  // Filter by subscription plan
  if (plan && plan !== 'all') {
    filter.subscription = plan;
  }

  // Filter by account status
  if (status) {
    switch (status.toLowerCase()) {
      case 'active':
        filter.isActive = true;
        filter.isEmailVerified = true;
        break;
      case 'trial':
        filter.subscription = 'None';
        filter.isActive = true;
        break;
      case 'cancelled':
        filter.isActive = false;
        break;
      case 'suspended':
        filter.isActive = false;
        filter.isEmailVerified = false;
        break;
    }
  }

  // Filter by country
  if (country && country !== 'all') {
    filter['address.country'] = new RegExp(country, 'i');
  }

  // Calculate pagination
  const pageNumber = parseInt(page);
  const pageSize = parseInt(limit);
  const skip = (pageNumber - 1) * pageSize;

  // Sort configuration
  const sortConfig = {};
  sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

  try {
    // Get total count for pagination
    const total = await User.countDocuments(filter);

    // Get subscribers with pagination
    const subscribers = await User.find(filter)
      .select('-password -resetToken -resetTokenExpiry -activationToken -activationTokenExpiry -loginHistory')
      .sort(sortConfig)
      .skip(skip)
      .limit(pageSize)
      .lean();

    // Get contract data for each subscriber
    const subscriberIds = subscribers.map(sub => sub._id);
    const contracts = await SignedContract.aggregate([
      { $match: { userId: { $in: subscriberIds } } },
      { 
        $group: {
          _id: "$userId",
          contractsSigned: { $sum: 1 },
          totalRevenue: { $sum: "$subscriptionPrice" }
        }
      }
    ]);

    // Create a map for quick lookup
    const contractsMap = contracts.reduce((acc, contract) => {
      acc[contract._id.toString()] = {
        contractsSigned: contract.contractsSigned,
        totalRevenue: contract.totalRevenue
      };
      return acc;
    }, {});

    // Transform data for frontend
    const transformedSubscribers = subscribers.map(user => {
      const contractData = contractsMap[user._id.toString()] || { contractsSigned: 0, totalRevenue: 0 };
      
      return {
        _id: user._id,
        id: user._id,
        name: user.name || `${user.firstName} ${user.lastName}`,
        email: user.email,
        phone: user.phone || 'N/A',
        role: user.role || 'subscriber',
        subscription: user.subscription || 'None',
        plan: user.subscription || 'None',
        country: user.address?.country || 'N/A',
        company: user.company,
        status: getSubscriberStatus(user),
        contractsSigned: contractData.contractsSigned,
        totalRevenue: contractData.totalRevenue,
        registrationDate: user.createdAt,
        joinedAt: user.createdAt,
        lastActivity: user.lastLoginAt || user.updatedAt,
        lastLogin: user.lastLoginAt || user.updatedAt,
        avatar: user.avatar,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive
      };
    });

    // Calculate statistics
    const stats = await calculateSubscriberStats();

    res.status(200).json(new ApiResponse(200, {
      subscribers: transformedSubscribers,
      pagination: {
        currentPage: pageNumber,
        totalPages: Math.ceil(total / pageSize),
        totalSubscribers: total,
        hasNext: pageNumber < Math.ceil(total / pageSize),
        hasPrev: pageNumber > 1
      },
      stats
    }, "Subscribers retrieved successfully"));

  } catch (error) {
    console.error("Error fetching subscribers:", error);
    throw new ApiError(500, "Failed to fetch subscribers");
  }
});

// Get subscriber statistics
const getSubscriberStats = asyncHandler(async (req, res) => {
  try {
    const stats = await calculateSubscriberStats();
    res.status(200).json(new ApiResponse(200, stats, "Subscriber statistics retrieved successfully"));
  } catch (error) {
    console.error("Error fetching subscriber stats:", error);
    throw new ApiError(500, "Failed to fetch subscriber statistics");
  }
});

// Get single subscriber details
const getSubscriberById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  try {
    const subscriber = await User.findById(id)
      .select('-password -resetToken -resetTokenExpiry -activationToken -activationTokenExpiry')
      .lean();

    if (!subscriber) {
      throw new ApiError(404, "Subscriber not found");
    }

    // Transform data for frontend
    const transformedSubscriber = {
      id: subscriber._id,
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      name: subscriber.name || `${subscriber.firstName} ${subscriber.lastName}`,
      email: subscriber.email,
      phone: subscriber.phone,
      subscription: subscriber.subscription,
      address: subscriber.address,
      discordUsername: subscriber.discordUsername,
      isWordPressUser: subscriber.isWordPressUser,
      wordpressId: subscriber.wordpressId,
      isEmailVerified: subscriber.isEmailVerified,
      isActive: subscriber.isActive,
      isPendingUser: subscriber.isPendingUser,
      lastLoginAt: subscriber.lastLoginAt,
      bio: subscriber.bio,
      company: subscriber.company,
      location: subscriber.location,
      website: subscriber.website,
      avatar: subscriber.avatar,
      preferences: subscriber.preferences,
      createdAt: subscriber.createdAt,
      updatedAt: subscriber.updatedAt,
      status: getSubscriberStatus(subscriber)
    };

    res.status(200).json(new ApiResponse(200, transformedSubscriber, "Subscriber details retrieved successfully"));
  } catch (error) {
    console.error("Error fetching subscriber:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to fetch subscriber details");
  }
});

// Create new subscriber
const createSubscriber = asyncHandler(async (req, res) => {
  // Check validation results
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { 
    firstName, 
    lastName, 
    name,
    email, 
    phone, 
    subscription = 'None',
    country,
    company,
    status = 'active' 
  } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(409, "User with this email already exists");
    }

    // Create new subscriber
    const subscriberData = {
      firstName: firstName || '',
      lastName: lastName || '',
      name: name || `${firstName || ''} ${lastName || ''}`.trim(),
      email,
      phone,
      subscription,
      address: {
        country: country || ''
      },
      company,
      isActive: status === 'active',
      isEmailVerified: status === 'active',
      isPendingUser: status === 'trial'
    };

    const newSubscriber = await User.create(subscriberData);

    // Transform response
    const transformedSubscriber = {
      id: newSubscriber._id,
      name: newSubscriber.name,
      email: newSubscriber.email,
      phone: newSubscriber.phone,
      plan: newSubscriber.subscription,
      country: newSubscriber.address?.country,
      status: getSubscriberStatus(newSubscriber),
      joinedAt: newSubscriber.createdAt
    };

    res.status(201).json(new ApiResponse(201, transformedSubscriber, "Subscriber created successfully"));
  } catch (error) {
    console.error("Error creating subscriber:", error);
    if (error instanceof ApiError) throw error;
    if (error.code === 11000) {
      throw new ApiError(409, "User with this email already exists");
    }
    throw new ApiError(500, "Failed to create subscriber");
  }
});

// Update subscriber
const updateSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  // Remove sensitive fields from updates
  delete updates.password;
  delete updates.resetToken;
  delete updates.activationToken;

  try {
    const subscriber = await User.findById(id);
    if (!subscriber) {
      throw new ApiError(404, "Subscriber not found");
    }

    // Handle special status updates
    if (updates.status) {
      switch (updates.status.toLowerCase()) {
        case 'active':
          updates.isActive = true;
          updates.isEmailVerified = true;
          break;
        case 'trial':
          updates.isActive = true;
          updates.isPendingUser = true;
          break;
        case 'cancelled':
        case 'suspended':
          updates.isActive = false;
          break;
      }
      delete updates.status;
    }

    // Update address if country is provided
    if (updates.country) {
      updates['address.country'] = updates.country;
      delete updates.country;
    }

    const updatedSubscriber = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -resetToken -resetTokenExpiry -activationToken -activationTokenExpiry');

    const transformedSubscriber = {
      id: updatedSubscriber._id,
      name: updatedSubscriber.name || `${updatedSubscriber.firstName} ${updatedSubscriber.lastName}`,
      email: updatedSubscriber.email,
      phone: updatedSubscriber.phone,
      plan: updatedSubscriber.subscription,
      country: updatedSubscriber.address?.country,
      status: getSubscriberStatus(updatedSubscriber),
      joinedAt: updatedSubscriber.createdAt,
      lastLogin: updatedSubscriber.lastLoginAt
    };

    res.status(200).json(new ApiResponse(200, transformedSubscriber, "Subscriber updated successfully"));
  } catch (error) {
    console.error("Error updating subscriber:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to update subscriber");
  }
});

// Delete subscriber
const deleteSubscriber = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid subscriber ID");
  }

  try {
    const subscriber = await User.findById(id);
    if (!subscriber) {
      throw new ApiError(404, "Subscriber not found");
    }

    await User.findByIdAndDelete(id);

    res.status(200).json(new ApiResponse(200, null, "Subscriber deleted successfully"));
  } catch (error) {
    console.error("Error deleting subscriber:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to delete subscriber");
  }
});

// Bulk operations
const bulkUpdateSubscribers = asyncHandler(async (req, res) => {
  const { subscriberIds, action, data } = req.body;

  if (!subscriberIds || !Array.isArray(subscriberIds) || subscriberIds.length === 0) {
    throw new ApiError(400, "Subscriber IDs are required");
  }

  if (!action) {
    throw new ApiError(400, "Action is required");
  }

  try {
    let updateQuery = {};
    let message = "";

    switch (action) {
      case 'activate':
        updateQuery = { isActive: true, isEmailVerified: true };
        message = "Subscribers activated successfully";
        break;
      case 'deactivate':
        updateQuery = { isActive: false };
        message = "Subscribers deactivated successfully";
        break;
      case 'updatePlan':
        if (!data?.plan) {
          throw new ApiError(400, "Plan is required for plan update");
        }
        updateQuery = { subscription: data.plan };
        message = `Subscription plan updated to ${data.plan} successfully`;
        break;
      case 'delete':
        await User.deleteMany({ _id: { $in: subscriberIds } });
        return res.status(200).json(new ApiResponse(200, null, "Subscribers deleted successfully"));
      default:
        throw new ApiError(400, "Invalid action");
    }

    const result = await User.updateMany(
      { _id: { $in: subscriberIds } },
      { $set: updateQuery }
    );

    res.status(200).json(new ApiResponse(200, {
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount
    }, message));
  } catch (error) {
    console.error("Error in bulk update:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "Failed to perform bulk operation");
  }
});

// Export subscribers data
const exportSubscribers = asyncHandler(async (req, res) => {
  const { format = 'csv', filters = {} } = req.query;

  try {
    // Build filter based on provided filters
    const filter = {};
    if (filters.status) {
      switch (filters.status.toLowerCase()) {
        case 'active':
          filter.isActive = true;
          filter.isEmailVerified = true;
          break;
        case 'trial':
          filter.subscription = 'None';
          filter.isActive = true;
          break;
        case 'cancelled':
          filter.isActive = false;
          break;
      }
    }

    if (filters.plan && filters.plan !== 'all') {
      filter.subscription = filters.plan;
    }

    // Get all subscribers matching filter
    const subscribers = await User.find(filter)
      .select('firstName lastName name email phone subscription address.country company createdAt lastLoginAt isActive isEmailVerified')
      .sort({ createdAt: -1 })
      .lean();

    // Transform data for export
    const exportData = subscribers.map(user => ({
      'Name': user.name || `${user.firstName} ${user.lastName}`,
      'Email': user.email,
      'Phone': user.phone || '',
      'Subscription Plan': user.subscription || 'None',
      'Country': user.address?.country || '',
      'Company': user.company || '',
      'Status': getSubscriberStatus(user),
      'Join Date': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '',
      'Last Login': user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'
    }));

    // Set appropriate headers based on format
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv');
      
      // Generate CSV content
      const csvHeaders = Object.keys(exportData[0] || {}).join(',');
      const csvRows = exportData.map(row => 
        Object.values(row).map(value => `"${value}"`).join(',')
      );
      const csvContent = [csvHeaders, ...csvRows].join('\n');
      
      res.send(csvContent);
    } else {
      // Return JSON for other formats (to be handled by frontend)
      res.status(200).json(new ApiResponse(200, {
        data: exportData,
        format,
        totalRecords: exportData.length,
        generatedAt: new Date().toISOString()
      }, "Export data generated successfully"));
    }
  } catch (error) {
    console.error("Error exporting subscribers:", error);
    throw new ApiError(500, "Failed to export subscribers");
  }
});

// Helper functions
function getSubscriberStatus(user) {
  if (!user.isActive) {
    return user.isEmailVerified ? 'cancelled' : 'suspended';
  }
  if (user.isPendingUser || user.subscription === 'None') {
    return 'trial';
  }
  return 'active';
}

async function calculateSubscriberStats() {
  try {
    const currentDate = new Date();
    const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const thisMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Total subscribers
    const totalSubscribers = await User.countDocuments({});
    const lastMonthTotal = await User.countDocuments({
      createdAt: { $lt: thisMonth }
    });

    // Active this month (logged in or created this month)
    const activeThisMonth = await User.countDocuments({
      $or: [
        { lastLoginAt: { $gte: thisMonth } },
        { createdAt: { $gte: thisMonth } }
      ],
      isActive: true
    });
    const lastMonthActive = await User.countDocuments({
      $or: [
        { lastLoginAt: { $gte: lastMonth, $lt: thisMonth } },
        { createdAt: { $gte: lastMonth, $lt: thisMonth } }
      ],
      isActive: true
    });

    // At risk (not logged in for 30+ days but still active)
    const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const atRisk = await User.countDocuments({
      isActive: true,
      $or: [
        { lastLoginAt: { $lt: thirtyDaysAgo } },
        { lastLoginAt: { $exists: false }, createdAt: { $lt: thirtyDaysAgo } }
      ]
    });
    const lastMonthAtRisk = await User.countDocuments({
      isActive: true,
      $or: [
        { lastLoginAt: { $lt: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000) } },
        { lastLoginAt: { $exists: false }, createdAt: { $lt: new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000) } }
      ]
    });

    // Churned this month (deactivated this month)
    const churnedThisMonth = await User.countDocuments({
      isActive: false,
      updatedAt: { $gte: thisMonth }
    });
    const churnedLastMonth = await User.countDocuments({
      isActive: false,
      updatedAt: { $gte: lastMonth, $lt: thisMonth }
    });

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous * 100);
    };

    return {
      totalSubscribers: {
        value: totalSubscribers,
        change: calculateChange(totalSubscribers, lastMonthTotal),
        trend: totalSubscribers >= lastMonthTotal ? 'up' : 'down'
      },
      activeThisMonth: {
        value: activeThisMonth,
        change: calculateChange(activeThisMonth, lastMonthActive),
        trend: activeThisMonth >= lastMonthActive ? 'up' : 'down'
      },
      atRisk: {
        value: atRisk,
        change: calculateChange(atRisk, lastMonthAtRisk),
        trend: atRisk <= lastMonthAtRisk ? 'down' : 'up' // Less at risk is better
      },
      churnedThisMonth: {
        value: churnedThisMonth,
        change: calculateChange(churnedThisMonth, churnedLastMonth),
        trend: churnedThisMonth <= churnedLastMonth ? 'down' : 'up' // Less churn is better
      }
    };
  } catch (error) {
    console.error("Error calculating stats:", error);
    throw error;
  }
}

module.exports = {
  getAllSubscribers,
  getSubscriberStats,
  getSubscriberById,
  createSubscriber,
  updateSubscriber,
  deleteSubscriber,
  bulkUpdateSubscribers,
  exportSubscribers
};





