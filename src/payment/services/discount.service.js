const Discount = require('../models/discount.model');
const ApiError = require('../../../utils/ApiError');
const httpStatus = require('http-status');

/**
 * Create a discount
 * @param {Object} discountBody
 * @returns {Promise<Discount>}
 */
const createDiscount = async (discountBody) => {
  if (await Discount.findOne({ code: discountBody.code })) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Discount code already exists');
  }
  return Discount.create(discountBody);
};

/**
 * Query for discounts
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryDiscounts = async (filter, options) => {
  const discounts = await Discount.paginate(filter, options);
  return discounts;
};

/**
 * Get discount by id
 * @param {ObjectId} id
 * @returns {Promise<Discount>}
 */
const getDiscountById = async (id) => {
  return Discount.findById(id);
};

/**
 * Get discount by code
 * @param {string} code
 * @returns {Promise<Discount>}
 */
const getDiscountByCode = async (code) => {
    return Discount.findOne({ code });
};


/**
 * Update discount by id
 * @param {ObjectId} discountId
 * @param {Object} updateBody
 * @returns {Promise<Discount>}
 */
const updateDiscountById = async (discountId, updateBody) => {
  const discount = await getDiscountById(discountId);
  if (!discount) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Discount not found');
  }
  if (updateBody.code && (await Discount.findOne({ code: updateBody.code, _id: { $ne: discountId } }))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Discount code already taken');
  }
  Object.assign(discount, updateBody);
  await discount.save();
  return discount;
};

/**
 * Delete discount by id
 * @param {ObjectId} discountId
 * @returns {Promise<Discount>}
 */
const deleteDiscountById = async (discountId) => {
  const discount = await getDiscountById(discountId);
  if (!discount) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Discount not found');
  }
  await discount.remove();
  return discount;
};

/**
 * Get discount statistics
 * @returns {Promise<Object>}
 */
const getDiscountStats = async () => {
    const activeCodes = await Discount.countDocuments({ isActive: true, endDate: { $gte: new Date() } });
    const totalRedemptions = await Discount.aggregate([{ $group: { _id: null, total: { $sum: '$usageCount' } } }]);
    // This is a placeholder for revenue impact. A real implementation would need to look at orders.
    const revenueImpact = 0; 
    const conversionRate = 0; // Placeholder

    return {
        activeCodes: { value: activeCodes, change: "+20.1%" }, // Placeholder change
        totalRedemptions: { value: totalRedemptions[0]?.total || 0, change: "+180.1%" },
        revenueImpact: { value: revenueImpact, change: "+19%" },
        conversionRate: { value: conversionRate.toFixed(1), change: "+12.2%" }
    };
};


module.exports = {
  createDiscount,
  queryDiscounts,
  getDiscountById,
  getDiscountByCode,
  updateDiscountById,
  deleteDiscountById,
  getDiscountStats,
};





