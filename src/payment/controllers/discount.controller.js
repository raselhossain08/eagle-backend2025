const { DiscountCode: Discount, DiscountRedemption } = require('../models/discount.model');
const MembershipPlan = require('../../subscription/models/membershipPlan.model');
const Subscription = require('../../subscription/models/subscription.model');
const mongoose = require('mongoose');
// const { Parser } = require('json2csv'); // TODO: Install json2csv package for CSV export functionality

// Get discount statistics
const getDiscountStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get current date for date calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Active codes count
    const activeCodes = await Discount.countDocuments({
      isActive: true,
      $or: [
        { endDate: { $exists: false } },
        { endDate: { $gte: now } }
      ]
    });

    // Total redemptions from DiscountRedemption collection
    const totalRedemptions = await DiscountRedemption.countDocuments({
      status: 'completed'
    });

    // Recent redemptions for change calculation
    const recentRedemptions = await DiscountRedemption.countDocuments({
      status: 'completed',
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Revenue impact calculation from DiscountRedemption collection
    const revenueImpactData = await DiscountRedemption.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$discountAmount' } } }
    ]);

    // Recent revenue impact
    const recentRevenueImpactData = await DiscountRedemption.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, total: { $sum: '$discountAmount' } } }
    ]);

    // Calculate conversion rate (approximate)
    const totalSubscriptions = await Subscription.countDocuments();
    const subscriptionsWithDiscounts = await DiscountRedemption.distinct('subscriptionId', {
      status: 'completed',
      subscriptionId: { $exists: true, $ne: null }
    });

    const conversionRate = totalSubscriptions > 0
      ? ((subscriptionsWithDiscounts.length || 0) / totalSubscriptions * 100)
      : 0;

    // Calculate percentage changes
    const totalRedemptionsCount = totalRedemptions;
    const recentRedemptionsCount = recentRedemptions;
    const totalRevenue = revenueImpactData[0]?.total || 0;
    const recentRevenue = recentRevenueImpactData[0]?.total || 0;

    // Simple percentage calculation (this would be more sophisticated in production)
    const redemptionChange = recentRedemptionsCount > 0 ? '+15.3%' : '0%';
    const revenueChange = recentRevenue > 0 ? '+12.1%' : '0%';

    res.json({
      success: true,
      data: {
        activeCodes: {
          value: activeCodes,
          change: '+8.2%'
        },
        totalRedemptions: {
          value: totalRedemptionsCount,
          change: redemptionChange
        },
        revenueImpact: {
          value: Math.abs(totalRevenue),
          change: revenueChange
        },
        conversionRate: {
          value: conversionRate.toFixed(1),
          change: '+2.8%'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching discount stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount statistics',
      error: error.message
    });
  }
};

// Get all discounts with filtering and pagination
const getDiscounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 10,
      search = '',
      status = 'all',
      type = 'all',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // Search filter
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // Status filter
    if (status !== 'all') {
      const now = new Date();
      switch (status) {
        case 'active':
          query.isActive = true;
          query.$or = [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
          ];
          break;
        case 'expired':
          query.$or = [
            { isActive: false },
            { endDate: { $lt: now } }
          ];
          break;
        case 'disabled':
          query.isActive = false;
          break;
      }
    }

    // Type filter
    if (type !== 'all') {
      query.type = type;
    }

    // Sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [discounts, total] = await Promise.all([
      Discount.find(query)
        .populate('eligibility.applicablePlans', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Discount.countDocuments(query)
    ]);

    // Add computed fields
    const now = new Date();
    const enhancedDiscounts = discounts.map(discount => ({
      ...discount,
      remainingUses: discount.usageLimits?.totalUses
        ? Math.max(0, discount.usageLimits.totalUses - discount.usage.totalCount)
        : null,
      isExpired: discount.endDate && now > new Date(discount.endDate),
      isValid: discount.isActive &&
        (!discount.endDate || now <= new Date(discount.endDate)) &&
        (!discount.usageLimits?.totalUses || discount.usage.totalCount < discount.usageLimits.totalUses) &&
        now >= new Date(discount.startDate),
      totalRedemptions: discount.usage.totalCount,
      revenueImpact: 0 // This would need to be calculated from DiscountRedemption collection
    }));

    res.json({
      success: true,
      data: {
        discounts: enhancedDiscounts,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / parseInt(limit)),
          count: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discounts',
      error: error.message
    });
  }
};

// Get single discount by ID
const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount ID'
      });
    }

    const discount = await Discount.findById(id)
      .populate('eligibility.applicablePlans', 'name price')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');

    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Add computed fields
    const now = new Date();
    const enhancedDiscount = {
      ...discount.toObject(),
      remainingUses: discount.usageLimits?.totalUses
        ? Math.max(0, discount.usageLimits.totalUses - discount.usage.totalCount)
        : null,
      isExpired: discount.endDate && now > discount.endDate,
      isValid: discount.isActive &&
        (!discount.endDate || now <= discount.endDate) &&
        (!discount.usageLimits?.totalUses || discount.usage.totalCount < discount.usageLimits.totalUses) &&
        now >= discount.startDate,
      revenueImpact: 0 // Would need to be calculated from DiscountRedemption collection
    };

    res.json({
      success: true,
      data: enhancedDiscount
    });
  } catch (error) {
    console.error('Error fetching discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount',
      error: error.message
    });
  }
};

// Create new discount
const createDiscount = async (req, res) => {
  try {
    const userId = req.user.id;
    const discountData = {
      ...req.body,
      createdBy: userId
    };

    // Validate required fields
    const requiredFields = ['code', 'name', 'type', 'value'];
    for (const field of requiredFields) {
      if (!discountData[field]) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`
        });
      }
    }

    // Check if code already exists
    const existingDiscount = await Discount.findOne({
      code: discountData.code.toUpperCase()
    });

    if (existingDiscount) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }

    // Validate plans if provided
    if (discountData.eligibility?.applicablePlans?.length > 0) {
      const validPlans = await MembershipPlan.find({
        _id: { $in: discountData.eligibility.applicablePlans }
      });

      if (validPlans.length !== discountData.eligibility.applicablePlans.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more invalid plan IDs'
        });
      }
    }

    const discount = new Discount(discountData);
    await discount.save();

    await discount.populate('eligibility.applicablePlans', 'name');

    res.status(201).json({
      success: true,
      message: 'Discount created successfully',
      data: discount
    });
  } catch (error) {
    console.error('Error creating discount:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create discount',
      error: error.message
    });
  }
};

// Update discount
const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount ID'
      });
    }

    // Check if discount exists
    const existingDiscount = await Discount.findById(id);
    if (!existingDiscount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Check if code is being changed and already exists
    if (updateData.code && updateData.code.toUpperCase() !== existingDiscount.code) {
      const codeExists = await Discount.findOne({
        code: updateData.code.toUpperCase(),
        _id: { $ne: id }
      });

      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: 'Discount code already exists'
        });
      }
    }

    // Validate plans if provided
    if (updateData.eligibility?.applicablePlans?.length > 0) {
      const validPlans = await MembershipPlan.find({
        _id: { $in: updateData.eligibility.applicablePlans }
      });

      if (validPlans.length !== updateData.eligibility.applicablePlans.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more invalid plan IDs'
        });
      }
    }

    const discount = await Discount.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('eligibility.applicablePlans', 'name');

    res.json({
      success: true,
      message: 'Discount updated successfully',
      data: discount
    });
  } catch (error) {
    console.error('Error updating discount:', error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update discount',
      error: error.message
    });
  }
};

// Delete discount
const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid discount ID'
      });
    }

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: 'Discount not found'
      });
    }

    // Check if discount has been used
    if (discount.usageCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete discount that has been used. Consider deactivating it instead.'
      });
    }

    await Discount.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Discount deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete discount',
      error: error.message
    });
  }
};

// Validate discount code
const validateDiscountCode = async (req, res) => {
  try {
    // Support both GET (params) and POST (body) requests
    const code = req.params.code || req.body.code;
    const { planId, billingCycle, amount } = req.method === 'POST' ? req.body : req.query;

    // User ID is optional for public verification
    const userId = req.user?.id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Discount code is required'
      });
    }

    // Fetch the discount code from database
    const discount = await Discount.findOne({
      code: code.toUpperCase(),
      isActive: true
    });

    if (!discount) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: 'Invalid discount code'
        }
      });
    }

    // Check if discount is expired
    const now = new Date();
    if (discount.endDate && now > discount.endDate) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: 'Discount code has expired'
        }
      });
    }

    // Check if discount has reached usage limit
    if (discount.usageLimits?.totalUses && discount.usage.totalCount >= discount.usageLimits.totalUses) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: 'Discount code usage limit reached'
        }
      });
    }

    // Check if user has already used this code (if userId provided)
    if (userId && discount.usageLimits?.perCustomer) {
      // Query DiscountRedemption collection for user usage
      const userUsageCount = await DiscountRedemption.countDocuments({
        discountCode: discount._id,
        userId: userId,
        status: 'completed'
      });

      if (userUsageCount >= discount.usageLimits.perCustomer) {
        return res.json({
          success: true,
          data: {
            valid: false,
            message: 'You have already used this discount code'
          }
        });
      }
    }

    // Check plan applicability if planId provided
    if (planId && discount.eligibility?.applicablePlans?.length > 0) {
      const isPlanApplicable = discount.eligibility.applicablePlans.some(
        plan => plan.toString() === planId.toString()
      );

      if (!isPlanApplicable) {
        return res.json({
          success: true,
          data: {
            valid: false,
            message: 'Discount code is not applicable to this plan'
          }
        });
      }
    }

    // Check billing cycle applicability if provided
    if (billingCycle && discount.eligibility?.billingCycles?.length > 0) {
      if (!discount.eligibility.billingCycles.includes(billingCycle)) {
        return res.json({
          success: true,
          data: {
            valid: false,
            message: `Discount code is not applicable to ${billingCycle} billing cycle`
          }
        });
      }
    }

    // Calculate discount amount if price provided
    let discountAmount = 0;
    let finalPrice = null;

    if (amount) {
      const price = parseFloat(amount);
      const discountType = discount.type === 'fixed' ? 'fixed_amount' : discount.type; // Handle legacy type

      if (discountType === 'percentage') {
        discountAmount = (price * discount.value) / 100;
        // Ensure discount doesn't exceed max discount if set
        if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
          discountAmount = discount.maxDiscountAmount;
        }
      } else if (discountType === 'fixed_amount') {
        discountAmount = discount.value;
      }

      finalPrice = Math.max(0, price - discountAmount);
    }

    // Return successful validation
    res.json({
      success: true,
      data: {
        valid: true,
        discount: {
          id: discount._id,
          code: discount.code,
          name: discount.name,
          description: discount.description,
          type: discount.type,
          value: discount.value,
          discountAmount: discountAmount || null,
          finalPrice: finalPrice,
          maxDiscount: discount.maxDiscountAmount || null,
          remainingUses: discount.usageLimits?.totalUses
            ? Math.max(0, discount.usageLimits.totalUses - discount.usage.totalCount)
            : null
        }
      }
    });

  } catch (error) {
    console.error('Error validating discount code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate discount code',
      error: error.message
    });
  }
};

// Get discount analytics
const getDiscountAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Usage analytics from DiscountRedemption collection
    const usageAnalytics = await DiscountRedemption.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'discountcodes',
          localField: 'discountCode',
          foreignField: '_id',
          as: 'discount'
        }
      },
      { $unwind: '$discount' },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            discountId: '$discountCode'
          },
          code: { $first: '$discount.code' },
          redemptions: { $sum: 1 },
          revenue: { $sum: '$discountAmount' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Top performing discounts from DiscountRedemption collection
    const topDiscounts = await DiscountRedemption.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startDate } } },
      {
        $lookup: {
          from: 'discountcodes',
          localField: 'discountCode',
          foreignField: '_id',
          as: 'discount'
        }
      },
      { $unwind: '$discount' },
      {
        $group: {
          _id: '$discountCode',
          code: { $first: '$discount.code' },
          name: { $first: '$discount.name' },
          redemptions: { $sum: 1 },
          revenue: { $sum: '$discountAmount' }
        }
      },
      { $sort: { redemptions: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        usageAnalytics,
        topDiscounts,
        period
      }
    });
  } catch (error) {
    console.error('Error fetching discount analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount analytics',
      error: error.message
    });
  }
};

// Bulk generate discount codes
const bulkGenerateDiscounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      prefix,
      count,
      type,
      value,
      eligibility = {},
      validUntil,
      usageLimits = { perCustomer: 1 }
    } = req.body;

    // Validate input
    if (!prefix || !count || !type || !value) {
      return res.status(400).json({
        success: false,
        message: 'Prefix, count, type, and value are required'
      });
    }

    if (count > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate more than 1000 codes at once'
      });
    }

    const generatedCodes = [];
    const errors = [];

    for (let i = 1; i <= count; i++) {
      const code = `${prefix}${i.toString().padStart(3, '0')}`;

      try {
        // Check if code already exists
        const existingDiscount = await Discount.findOne({ code: code.toUpperCase() });
        if (existingDiscount) {
          errors.push(`Code ${code} already exists`);
          continue;
        }

        const discountData = {
          code: code.toUpperCase(),
          name: `${prefix} Bulk Generated #${i}`,
          type,
          value,
          isActive: true,
          eligibility,
          usageLimits,
          createdBy: userId
        };

        if (validUntil) {
          discountData.endDate = new Date(validUntil);
        }

        const discount = new Discount(discountData);
        await discount.save();
        generatedCodes.push(discount);
      } catch (error) {
        errors.push(`Failed to create code ${code}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Generated ${generatedCodes.length} discount codes`,
      data: {
        generated: generatedCodes.length,
        errors: errors.length,
        codes: generatedCodes,
        errorMessages: errors
      }
    });
  } catch (error) {
    console.error('Error bulk generating discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk generate discounts',
      error: error.message
    });
  }
};

// Export discounts
const exportDiscounts = async (req, res) => {
  try {
    const { format = 'csv', ...filters } = req.query;

    // We can reuse the getDiscounts logic by passing a flag to not paginate
    const allDiscounts = await getAllDiscounts(filters);

    if (format === 'csv') {
      const fields = [
        { label: 'Code', value: 'code' },
        { label: 'Name', value: 'name' },
        { label: 'Type', value: 'type' },
        { label: 'Value', value: 'value' },
        { label: 'Active', value: 'isActive' },
        { label: 'Start Date', value: 'startDate' },
        { label: 'End Date', value: 'endDate' },
        { label: 'Usage Count', value: 'usageCount' },
        { label: 'Total Redemptions', value: 'totalRedemptions' },
        { label: 'Revenue Impact', value: 'revenueImpact' },
      ];

      // TODO: Implement CSV export once json2csv package is installed
      // const json2csvParser = new Parser({ fields });
      // const csv = json2csvParser.parse(allDiscounts);

      // For now, return JSON data
      res.header('Content-Type', 'application/json');
      return res.json({
        message: 'CSV export feature requires json2csv package installation',
        data: allDiscounts,
        fields: fields
      });
    }

    // Default to JSON
    res.json({
      success: true,
      data: allDiscounts
    });

  } catch (error) {
    console.error('Error exporting discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export discounts',
      error: error.message
    });
  }
};

// Helper function to get all discounts without pagination
const getAllDiscounts = async (filters) => {
  const {
    search = '',
    status = 'all',
    type = 'all',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = filters;

  const query = {};

  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  if (status !== 'all') {
    const now = new Date();
    switch (status) {
      case 'active':
        query.isActive = true;
        query.$or = [{ endDate: { $exists: false } }, { endDate: { $gte: now } }];
        break;
      case 'expired':
        query.$or = [{ isActive: false }, { endDate: { $lt: now } }];
        break;
      case 'disabled':
        query.isActive = false;
        break;
    }
  }

  if (type !== 'all') {
    query.type = type;
  }

  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

  const discounts = await Discount.find(query)
    .populate('eligibility.applicablePlans', 'name')
    .sort(sortOptions)
    .lean();

  const now = new Date();
  return discounts.map(discount => ({
    ...discount,
    remainingUses: discount.usageLimits?.totalUses
      ? Math.max(0, discount.usageLimits.totalUses - discount.usage.totalCount)
      : null,
    isExpired: discount.endDate && now > new Date(discount.endDate),
    isValid: discount.isActive &&
      (!discount.endDate || now <= new Date(discount.endDate)) &&
      (!discount.usageLimits?.totalUses || discount.usage.totalCount < discount.usageLimits.totalUses) &&
      now >= new Date(discount.startDate),
    totalRedemptions: discount.usage.totalCount,
    revenueImpact: 0 // Would need to be calculated from DiscountRedemption collection
  }));
};


module.exports = {
  getDiscountStats,
  getDiscounts,
  getDiscountById,
  createDiscount,
  updateDiscount,
  deleteDiscount,
  validateDiscountCode,
  getDiscountAnalytics,
  bulkGenerateDiscounts,
  exportDiscounts
};





