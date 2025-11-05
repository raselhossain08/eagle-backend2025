const { TaxRate, Invoice, Receipt, TaxReport } = require('../models/billing.model');
const TaxCalculationService = require('../services/taxCalculation.service');
const InvoiceService = require('../services/invoiceGeneration.service');
const { validationResult } = require('express-validator');

/**
 * Comprehensive Billing & Tax Controller
 * Multi-currency, provider-agnostic tax calculation, branded invoices, finance exports
 */
class BillingController {
  constructor() {
    this.taxService = new TaxCalculationService();
    this.invoiceService = new InvoiceService();
  }

  // ==================== TAX RATE MANAGEMENT ====================

  /**
   * Create new tax rate
   */
  async createTaxRate(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const taxRate = new TaxRate({
        ...req.body,
        'metadata.lastUpdatedBy': req.user.id
      });

      await taxRate.save();

      res.status(201).json({
        success: true,
        message: 'Tax rate created successfully',
        data: taxRate
      });
    } catch (error) {
      console.error('Tax rate creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create tax rate',
        error: error.message
      });
    }
  }

  /**
   * Get tax rates with filtering and pagination
   */
  async getTaxRates(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        country,
        state,
        taxType,
        active,
        search
      } = req.query;

      // Build filter
      const filter = {};
      
      if (country) filter.country = country.toUpperCase();
      if (state) filter.state = state.toUpperCase();
      if (taxType) filter.taxType = taxType;
      if (active !== undefined) filter.active = active === 'true';
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { country: 1, state: 1, rate: 1 },
        populate: {
          path: 'metadata.lastUpdatedBy',
          select: 'name email'
        }
      };

      const result = await TaxRate.paginate(filter, options);

      res.json({
        success: true,
        data: result.docs,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.totalDocs,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Tax rates fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tax rates',
        error: error.message
      });
    }
  }

  /**
   * Update tax rate
   */
  async updateTaxRate(req, res) {
    try {
      const { id } = req.params;
      const updateData = {
        ...req.body,
        'metadata.lastUpdatedBy': req.user.id
      };

      const taxRate = await TaxRate.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!taxRate) {
        return res.status(404).json({
          success: false,
          message: 'Tax rate not found'
        });
      }

      res.json({
        success: true,
        message: 'Tax rate updated successfully',
        data: taxRate
      });
    } catch (error) {
      console.error('Tax rate update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update tax rate',
        error: error.message
      });
    }
  }

  /**
   * Delete tax rate (soft delete by deactivating)
   */
  async deleteTaxRate(req, res) {
    try {
      const { id } = req.params;

      const taxRate = await TaxRate.findByIdAndUpdate(
        id,
        { 
          active: false,
          effectiveTo: new Date(),
          'metadata.lastUpdatedBy': req.user.id
        },
        { new: true }
      );

      if (!taxRate) {
        return res.status(404).json({
          success: false,
          message: 'Tax rate not found'
        });
      }

      res.json({
        success: true,
        message: 'Tax rate deactivated successfully',
        data: taxRate
      });
    } catch (error) {
      console.error('Tax rate deletion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete tax rate',
        error: error.message
      });
    }
  }

  // ==================== TAX CALCULATION ====================

  /**
   * Calculate tax for a transaction
   */
  async calculateTax(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        customerId,
        lineItems,
        billingAddress,
        currency,
        customerType = 'INDIVIDUAL',
        provider,
        exemptionCertificates
      } = req.body;

      // Calculate tax
      const taxCalculation = await this.taxService.calculateTax({
        customerId,
        lineItems,
        billingAddress,
        currency,
        customerType
      }, { provider });

      // Apply exemptions if provided
      let finalCalculation = taxCalculation;
      if (exemptionCertificates && exemptionCertificates.length > 0) {
        finalCalculation = await this.taxService.applyTaxExemptions(
          taxCalculation,
          exemptionCertificates
        );
      }

      res.json({
        success: true,
        data: {
          calculation: finalCalculation,
          summary: {
            totalTaxAmount: finalCalculation.totalTaxAmount,
            taxLineCount: finalCalculation.taxLines.length,
            exemptionCount: finalCalculation.exemptions.length,
            reverseChargeApplicable: finalCalculation.reverseCharge.applicable
          }
        }
      });
    } catch (error) {
      console.error('Tax calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Tax calculation failed',
        error: error.message
      });
    }
  }

  /**
   * Get applicable tax rates for location and product
   */
  async getApplicableTaxRates(req, res) {
    try {
      const {
        country,
        state,
        city,
        postalCode,
        customerType = 'INDIVIDUAL',
        productType = 'SUBSCRIPTIONS',
        amount = 0
      } = req.query;

      const location = { country, state, city, postalCode };
      
      const applicableRates = await this.taxService.getApplicableTaxRates(
        location,
        customerType,
        productType,
        parseFloat(amount)
      );

      res.json({
        success: true,
        data: applicableRates,
        summary: {
          rateCount: applicableRates.length,
          totalRate: applicableRates.reduce((sum, rate) => sum + rate.rate, 0),
          location: location
        }
      });
    } catch (error) {
      console.error('Applicable tax rates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get applicable tax rates',
        error: error.message
      });
    }
  }

  // ==================== INVOICE MANAGEMENT ====================

  /**
   * Create new invoice
   */
  async createInvoice(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        generatePdf = true,
        sendEmail = false,
        templateId = 'default',
        emailOptions = {}
      } = req.body;

      const invoice = await this.invoiceService.createInvoice(req.body, {
        generatePdf,
        sendEmail,
        templateId,
        emailOptions
      });

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice
      });
    } catch (error) {
      console.error('Invoice creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: error.message
      });
    }
  }

  /**
   * Get invoices with filtering and pagination
   */
  async getInvoices(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        customerId,
        status,
        currency,
        dateFrom,
        dateTo,
        amountMin,
        amountMax,
        search
      } = req.query;

      // Build filter
      const filter = {};
      
      if (customerId) filter.customerId = customerId;
      if (status) filter.status = status;
      if (currency) filter.currency = currency.toUpperCase();
      
      if (dateFrom || dateTo) {
        filter.invoiceDate = {};
        if (dateFrom) filter.invoiceDate.$gte = new Date(dateFrom);
        if (dateTo) filter.invoiceDate.$lte = new Date(dateTo);
      }
      
      if (amountMin || amountMax) {
        filter['amounts.total'] = {};
        if (amountMin) filter['amounts.total'].$gte = parseFloat(amountMin);
        if (amountMax) filter['amounts.total'].$lte = parseFloat(amountMax);
      }
      
      if (search) {
        filter.$or = [
          { invoiceNumber: { $regex: search, $options: 'i' } },
          { 'billingAddress.name': { $regex: search, $options: 'i' } },
          { 'billingAddress.company': { $regex: search, $options: 'i' } }
        ];
      }

      // Execute query with pagination
      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { invoiceDate: -1 },
        populate: [
          {
            path: 'customerId',
            select: 'name email company'
          },
          {
            path: 'subscriptionId',
            select: 'planName status'
          }
        ]
      };

      const result = await Invoice.paginate(filter, options);

      res.json({
        success: true,
        data: result.docs,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.totalDocs,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Invoices fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error.message
      });
    }
  }

  /**
   * Get single invoice
   */
  async getInvoice(req, res) {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('customerId', 'name email company billingAddress')
        .populate('subscriptionId', 'planName status currentPeriodStart currentPeriodEnd')
        .populate('taxCalculation.taxLines.taxRateId')
        .lean();

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.json({
        success: true,
        data: invoice
      });
    } catch (error) {
      console.error('Invoice fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: error.message
      });
    }
  }

  /**
   * Update invoice
   */
  async updateInvoice(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Don't allow updating certain fields for PAID invoices
      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      if (invoice.status === 'PAID' || invoice.status === 'VOID') {
        const restrictedFields = ['lineItems', 'amounts', 'taxCalculation'];
        const hasRestrictedFields = restrictedFields.some(field => 
          updateData.hasOwnProperty(field)
        );

        if (hasRestrictedFields) {
          return res.status(400).json({
            success: false,
            message: 'Cannot modify financial details of paid or voided invoices'
          });
        }
      }

      // Add audit trail entry
      updateData.$push = {
        'compliance.auditTrail': {
          action: 'INVOICE_UPDATED',
          performedBy: req.user.id,
          performedAt: new Date(),
          details: { updatedFields: Object.keys(updateData) }
        }
      };

      const updatedInvoice = await Invoice.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('customerId', 'name email');

      res.json({
        success: true,
        message: 'Invoice updated successfully',
        data: updatedInvoice
      });
    } catch (error) {
      console.error('Invoice update error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update invoice',
        error: error.message
      });
    }
  }

  /**
   * Void invoice
   */
  async voidInvoice(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      if (invoice.status === 'PAID') {
        return res.status(400).json({
          success: false,
          message: 'Cannot void a paid invoice. Issue a credit note instead.'
        });
      }

      if (invoice.status === 'VOID') {
        return res.status(400).json({
          success: false,
          message: 'Invoice is already voided'
        });
      }

      // Void the invoice
      invoice.void(reason, req.user.id);
      await invoice.save();

      res.json({
        success: true,
        message: 'Invoice voided successfully',
        data: invoice
      });
    } catch (error) {
      console.error('Invoice void error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to void invoice',
        error: error.message
      });
    }
  }

  /**
   * Mark invoice as paid
   */
  async markInvoicePaid(req, res) {
    try {
      const { id } = req.params;
      const { paymentAmount, paymentDate, paymentMethod, transactionId } = req.body;

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      if (invoice.status === 'PAID') {
        return res.status(400).json({
          success: false,
          message: 'Invoice is already paid'
        });
      }

      if (invoice.status === 'VOID') {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark voided invoice as paid'
        });
      }

      // Mark as paid
      invoice.markAsPaid(paymentAmount, new Date(paymentDate));
      
      // Add payment details
      if (transactionId) {
        invoice.paymentIntentId = transactionId;
      }

      await invoice.save();

      // Create receipt
      const receipt = await this.invoiceService.createReceipt({
        invoiceId: invoice._id,
        customerId: invoice.customerId,
        paymentAmount: paymentAmount,
        paymentCurrency: invoice.currency,
        paymentMethod: paymentMethod || 'MANUAL',
        paymentDate: new Date(paymentDate),
        transactionId: transactionId,
        generatePdf: true,
        sendEmail: true
      });

      res.json({
        success: true,
        message: 'Invoice marked as paid successfully',
        data: {
          invoice,
          receipt
        }
      });
    } catch (error) {
      console.error('Mark invoice paid error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark invoice as paid',
        error: error.message
      });
    }
  }

  // ==================== PDF AND EMAIL OPERATIONS ====================

  /**
   * Generate invoice PDF
   */
  async generateInvoicePDF(req, res) {
    try {
      const { id } = req.params;
      const { templateId = 'default' } = req.body;

      const result = await this.invoiceService.generateInvoicePDF(id, templateId);

      res.json({
        success: true,
        message: 'Invoice PDF generated successfully',
        data: {
          url: result.url,
          size: result.size
        }
      });
    } catch (error) {
      console.error('Invoice PDF generation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice PDF',
        error: error.message
      });
    }
  }

  /**
   * Send invoice email
   */
  async sendInvoiceEmail(req, res) {
    try {
      const { id } = req.params;
      const emailOptions = req.body;

      const result = await this.invoiceService.sendInvoiceEmail(id, emailOptions);

      res.json({
        success: true,
        message: 'Invoice email sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Invoice email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send invoice email',
        error: error.message
      });
    }
  }

  /**
   * Resend invoice email
   */
  async resendInvoiceEmail(req, res) {
    try {
      const { id } = req.params;
      const emailOptions = req.body;

      const result = await this.invoiceService.resendInvoiceEmail(id, emailOptions);

      res.json({
        success: true,
        message: 'Invoice email resent successfully',
        data: result
      });
    } catch (error) {
      console.error('Invoice email resend error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend invoice email',
        error: error.message
      });
    }
  }

  // ==================== RECEIPTS ====================

  /**
   * Get receipts with filtering
   */
  async getReceipts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        customerId,
        invoiceId,
        dateFrom,
        dateTo,
        paymentMethod
      } = req.query;

      const filter = {};
      
      if (customerId) filter.customerId = customerId;
      if (invoiceId) filter.invoiceId = invoiceId;
      if (paymentMethod) filter.paymentMethod = paymentMethod;
      
      if (dateFrom || dateTo) {
        filter.paymentDate = {};
        if (dateFrom) filter.paymentDate.$gte = new Date(dateFrom);
        if (dateTo) filter.paymentDate.$lte = new Date(dateTo);
      }

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { paymentDate: -1 },
        populate: [
          { path: 'customerId', select: 'name email' },
          { path: 'invoiceId', select: 'invoiceNumber' }
        ]
      };

      const result = await Receipt.paginate(filter, options);

      res.json({
        success: true,
        data: result.docs,
        pagination: {
          currentPage: result.page,
          totalPages: result.totalPages,
          totalItems: result.totalDocs,
          hasNext: result.hasNextPage,
          hasPrev: result.hasPrevPage
        }
      });
    } catch (error) {
      console.error('Receipts fetch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch receipts',
        error: error.message
      });
    }
  }

  /**
   * Resend receipt email
   */
  async resendReceiptEmail(req, res) {
    try {
      const { id } = req.params;
      const emailOptions = req.body;

      const result = await this.invoiceService.sendReceiptEmail(id, emailOptions);

      res.json({
        success: true,
        message: 'Receipt email sent successfully',
        data: result
      });
    } catch (error) {
      console.error('Receipt email error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send receipt email',
        error: error.message
      });
    }
  }

  // ==================== FINANCIAL REPORTING ====================

  /**
   * Get billing dashboard analytics
   */
  async getBillingDashboard(req, res) {
    try {
      const { period = '30d', currency } = req.query;
      
      // Calculate date range
      const periodDays = parseInt(period.replace('d', ''));
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      
      const filter = {
        invoiceDate: { $gte: startDate }
      };
      
      if (currency) {
        filter.currency = currency.toUpperCase();
      }

      // Aggregate invoice data
      const [invoiceStats, revenueByStatus, topCustomers, monthlyTrend] = await Promise.all([
        // Invoice statistics
        Invoice.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              totalRevenue: { $sum: '$amounts.total' },
              totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amounts.total', 0] } },
              totalPending: { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, '$amounts.total', 0] } },
              averageInvoiceValue: { $avg: '$amounts.total' }
            }
          }
        ]),

        // Revenue by status
        Invoice.aggregate([
          { $match: filter },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amounts.total' }
            }
          }
        ]),

        // Top customers by revenue
        Invoice.aggregate([
          { $match: { ...filter, status: 'PAID' } },
          {
            $group: {
              _id: '$customerId',
              totalRevenue: { $sum: '$amounts.total' },
              invoiceCount: { $sum: 1 }
            }
          },
          { $sort: { totalRevenue: -1 } },
          { $limit: 10 },
          {
            $lookup: {
              from: 'enhancedusers',
              localField: '_id',
              foreignField: '_id',
              as: 'customer'
            }
          },
          { $unwind: '$customer' },
          {
            $project: {
              customerName: '$customer.name',
              customerEmail: '$customer.email',
              totalRevenue: 1,
              invoiceCount: 1
            }
          }
        ]),

        // Monthly revenue trend
        Invoice.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                year: { $year: '$invoiceDate' },
                month: { $month: '$invoiceDate' }
              },
              totalRevenue: { $sum: '$amounts.total' },
              paidRevenue: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, '$amounts.total', 0] } },
              invoiceCount: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } }
        ])
      ]);

      res.json({
        success: true,
        data: {
          overview: invoiceStats[0] || {
            totalInvoices: 0,
            totalRevenue: 0,
            totalPaid: 0,
            totalPending: 0,
            averageInvoiceValue: 0
          },
          revenueByStatus,
          topCustomers,
          monthlyTrend,
          period: {
            days: periodDays,
            startDate,
            endDate: new Date()
          }
        }
      });
    } catch (error) {
      console.error('Billing dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch billing dashboard',
        error: error.message
      });
    }
  }

  /**
   * Export financial data
   */
  async exportFinancialData(req, res) {
    try {
      const {
        format = 'CSV',
        dataType = 'invoices',
        dateFrom,
        dateTo,
        currency,
        status
      } = req.query;

      if (!['CSV', 'JSON'].includes(format.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Unsupported export format. Use CSV or JSON.'
        });
      }

      // Build filter
      const filter = {};
      
      if (dateFrom || dateTo) {
        const dateField = dataType === 'receipts' ? 'paymentDate' : 'invoiceDate';
        filter[dateField] = {};
        if (dateFrom) filter[dateField].$gte = new Date(dateFrom);
        if (dateTo) filter[dateField].$lte = new Date(dateTo);
      }
      
      if (currency) filter.currency = currency.toUpperCase();
      if (status && dataType === 'invoices') filter.status = status;

      let data;
      let filename;

      if (dataType === 'invoices') {
        data = await Invoice.find(filter)
          .populate('customerId', 'name email company')
          .populate('subscriptionId', 'planName')
          .lean();
        filename = `invoices_export_${new Date().toISOString().split('T')[0]}`;
      } else if (dataType === 'receipts') {
        data = await Receipt.find(filter)
          .populate('customerId', 'name email')
          .populate('invoiceId', 'invoiceNumber')
          .lean();
        filename = `receipts_export_${new Date().toISOString().split('T')[0]}`;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid data type. Use "invoices" or "receipts".'
        });
      }

      if (format.toUpperCase() === 'CSV') {
        // Generate CSV
        const csvData = this.generateCSV(data, dataType);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.send(csvData);
      } else {
        // Return JSON
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json({
          success: true,
          exportInfo: {
            dataType,
            recordCount: data.length,
            exportedAt: new Date(),
            filter
          },
          data
        });
      }
    } catch (error) {
      console.error('Financial export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export financial data',
        error: error.message
      });
    }
  }

  /**
   * Generate CSV from data
   */
  generateCSV(data, dataType) {
    if (data.length === 0) {
      return 'No data available for export';
    }

    if (dataType === 'invoices') {
      const headers = [
        'Invoice Number',
        'Customer Name',
        'Customer Email',
        'Invoice Date',
        'Due Date',
        'Currency',
        'Status',
        'Subtotal',
        'Tax Total',
        'Total Amount',
        'Amount Paid',
        'Amount Due'
      ];

      const rows = data.map(invoice => [
        invoice.invoiceNumber,
        invoice.customerId?.name || '',
        invoice.customerId?.email || '',
        new Date(invoice.invoiceDate).toISOString().split('T')[0],
        new Date(invoice.dueDate).toISOString().split('T')[0],
        invoice.currency,
        invoice.status,
        invoice.amounts.subtotal,
        invoice.amounts.taxTotal,
        invoice.amounts.total,
        invoice.amounts.amountPaid,
        invoice.amounts.amountDue
      ]);

      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    } else if (dataType === 'receipts') {
      const headers = [
        'Receipt Number',
        'Customer Name',
        'Customer Email',
        'Invoice Number',
        'Payment Date',
        'Payment Amount',
        'Payment Currency',
        'Payment Method',
        'Transaction ID'
      ];

      const rows = data.map(receipt => [
        receipt.receiptNumber,
        receipt.customerId?.name || '',
        receipt.customerId?.email || '',
        receipt.invoiceId?.invoiceNumber || '',
        new Date(receipt.paymentDate).toISOString().split('T')[0],
        receipt.paymentAmount,
        receipt.paymentCurrency,
        receipt.paymentMethod,
        receipt.transactionId || ''
      ]);

      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    }

    return 'Unsupported data type for CSV export';
  }

  // ==================== CURRENCY MANAGEMENT ====================

  /**
   * Get supported currencies
   */
  async getSupportedCurrencies(req, res) {
    try {
      // Get currencies from invoices and tax rates
      const [invoiceCurrencies, configuredCurrencies] = await Promise.all([
        Invoice.distinct('currency'),
        TaxRate.distinct('currency')
      ]);

      const allCurrencies = [...new Set([...invoiceCurrencies, ...configuredCurrencies])];
      
      // Add currency details
      const currencyDetails = allCurrencies.map(code => ({
        code,
        name: this.getCurrencyName(code),
        symbol: this.getCurrencySymbol(code)
      }));

      res.json({
        success: true,
        data: currencyDetails
      });
    } catch (error) {
      console.error('Supported currencies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch supported currencies',
        error: error.message
      });
    }
  }

  /**
   * Get currency name from code
   */
  getCurrencyName(code) {
    const currencies = {
      'USD': 'US Dollar',
      'EUR': 'Euro',
      'GBP': 'British Pound',
      'CAD': 'Canadian Dollar',
      'AUD': 'Australian Dollar',
      'JPY': 'Japanese Yen',
      'CHF': 'Swiss Franc',
      'SEK': 'Swedish Krona',
      'NOK': 'Norwegian Krone',
      'DKK': 'Danish Krone'
    };
    
    return currencies[code] || code;
  }

  /**
   * Get currency symbol from code
   */
  getCurrencySymbol(code) {
    const symbols = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'C$',
      'AUD': 'A$',
      'JPY': '¥',
      'CHF': 'CHF',
      'SEK': 'kr',
      'NOK': 'kr',
      'DKK': 'kr'
    };
    
    return symbols[code] || code;
  }
}

module.exports = new BillingController();





