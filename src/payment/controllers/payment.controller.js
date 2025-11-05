const PaymentMethod = require('../models/paymentMethod.model');
const FailedPayment = require('../models/failedPayment.model');

/**
 * Legacy Payment Controller
 * Provides simple payment method management for legacy routes
 * For comprehensive payment retry and dunning management, use /api/v1/dunning endpoints
 */
class LegacyPaymentController {

    /**
     * Get payment methods
     * @route GET /api/payment/methods
     */
    getPaymentMethods = async (req, res) => {
        try {
            const { page = 1, limit = 10, searchTerm, statusFilter } = req.query;
            const query = {};

            if (searchTerm) {
                query.customer = { $regex: searchTerm, $options: 'i' };
            }

            if (statusFilter && statusFilter !== 'all') {
                query.status = statusFilter;
            }

            const skip = (page - 1) * limit;
            const paymentMethods = await PaymentMethod.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await PaymentMethod.countDocuments(query);

            res.status(200).json({
                success: true,
                data: paymentMethods,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get failed payments
     * @route GET /api/payment/failed
     */
    getFailedPayments = async (req, res) => {
        try {
            const { page = 1, limit = 10 } = req.query;
            const skip = (page - 1) * limit;

            const failedPayments = await FailedPayment.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('userId', 'email firstName lastName');

            const total = await FailedPayment.countDocuments();

            res.status(200).json({
                success: true,
                data: failedPayments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Get payment summary
     * @route GET /api/payment/summary
     */
    getSummary = async (req, res) => {
        try {
            const totalMethods = await PaymentMethod.countDocuments();
            const activeMethods = await PaymentMethod.countDocuments({ status: 'active' });
            const failedPayments = await FailedPayment.countDocuments({ status: 'failed' });
            const recoveredPayments = await FailedPayment.countDocuments({ status: 'recovered' });

            res.status(200).json({
                success: true,
                data: {
                    totalMethods,
                    activeMethods,
                    failedPayments,
                    recoveredPayments,
                    recoveryRate: failedPayments > 0 ? ((recoveredPayments / (failedPayments + recoveredPayments)) * 100).toFixed(2) : 0
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Update payment method
     * @route PUT /api/payment/methods/:id
     */
    updatePaymentMethod = async (req, res) => {
        try {
            const { id } = req.params;
            const updatedMethod = await PaymentMethod.findByIdAndUpdate(
                id,
                req.body,
                { new: true, runValidators: true }
            );

            if (!updatedMethod) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment method not found'
                });
            }

            res.status(200).json({
                success: true,
                data: updatedMethod
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Delete payment method
     * @route DELETE /api/payment/methods/:id
     */
    deletePaymentMethod = async (req, res) => {
        try {
            const { id } = req.params;
            const deletedMethod = await PaymentMethod.findByIdAndDelete(id);

            if (!deletedMethod) {
                return res.status(404).json({
                    success: false,
                    message: 'Payment method not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Payment method deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    /**
     * Basic retry failed payment (redirects to v1 API)
     * @route POST /api/payment/failed/:id/retry
     * @deprecated Use POST /api/v1/dunning/failed-payments/:id/retry for comprehensive retry functionality
     */
    retryFailedPayment = async (req, res) => {
        res.status(301).json({
            success: false,
            message: 'This endpoint is deprecated. Please use the v1 dunning API for comprehensive payment retry functionality.',
            redirect: `/api/v1/dunning/failed-payments/${req.params.id}/retry`,
            documentation: 'The v1 dunning API provides advanced retry options, campaign management, and detailed analytics.'
        });
    };

    /**
     * Create payment method
     * @route POST /api/payment/methods
     */
    createPaymentMethod = async (req, res) => {
        try {
            const newMethod = new PaymentMethod(req.body);
            await newMethod.save();

            res.status(201).json({
                success: true,
                data: newMethod
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };
}

module.exports = new LegacyPaymentController();





