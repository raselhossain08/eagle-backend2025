const Invoice = require('../../payment/models/invoice.model');
const Payment = require('../../payment/models/payment.model');
const User = require('../../user/models/user.model');
const { validationResult } = require('express-validator');
const PDFDocument = require('pdfkit'); // You'll need to install this
const nodemailer = require('nodemailer'); // You'll need to install this

class InvoiceController {

  /**
   * GET /api/v1/invoices
   * Get invoices with filtering
   */
  async getInvoices(req, res) {
    try {
      const {
        subscriber_id,
        status,
        start_date,
        end_date,
        page = 1,
        limit = 50,
        sort = '-createdAt'
      } = req.query;

      const query = {};

      if (subscriber_id) {
        query.userId = subscriber_id;
      }

      if (status) {
        const statusArray = Array.isArray(status) ? status : [status];
        query.status = { $in: statusArray };
      }

      if (start_date || end_date) {
        query.issueDate = {};
        if (start_date) query.issueDate.$gte = new Date(start_date);
        if (end_date) query.issueDate.$lte = new Date(end_date);
      }

      const skip = (page - 1) * limit;
      const sortObj = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const [invoices, total] = await Promise.all([
        Invoice.find(query)
          .populate('userId', 'name firstName lastName email')
          .populate('subscriptionId', 'planId billingCycle')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit)),
        Invoice.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        message: 'Invoices retrieved successfully',
        data: invoices,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Error in getInvoices controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoices',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/invoices/:id
   * Get single invoice
   */
  async getInvoice(req, res) {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('userId', 'name firstName lastName email phone address')
        .populate('subscriptionId');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Invoice retrieved successfully',
        data: invoice
      });

    } catch (error) {
      console.error('Error in getInvoice controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch invoice',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/invoices
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
        userId,
        subscriptionId,
        items,
        taxDetails = [],
        discounts = [],
        dueDate,
        notes
      } = req.body;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Generate invoice number
      const invoiceNumber = await Invoice.generateInvoiceNumber();

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
      const taxAmount = taxDetails.reduce((sum, tax) => sum + tax.taxAmount, 0);
      const discountAmount = discounts.reduce((sum, discount) => sum + discount.amount, 0);
      const total = subtotal + taxAmount - discountAmount;

      const invoice = new Invoice({
        invoiceNumber,
        userId,
        subscriptionId,
        items,
        subtotal,
        taxAmount,
        discountAmount,
        total,
        amountDue: total,
        taxDetails,
        discounts,
        dueDate: dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        notes,
        billingAddress: {
          name: user.name || `${user.firstName} ${user.lastName}`,
          email: user.email,
          line1: user.address?.streetAddress,
          city: user.address?.townCity,
          state: user.address?.stateCounty,
          postalCode: user.address?.postcodeZip,
          country: user.address?.country
        }
      });

      await invoice.save();

      res.status(201).json({
        success: true,
        message: 'Invoice created successfully',
        data: invoice
      });

    } catch (error) {
      console.error('Error in createInvoice controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/invoices/:id/refund
   * Process refund for invoice
   */
  async processRefund(req, res) {
    try {
      const { id } = req.params;
      const { amount, reason } = req.body;
      const refundedBy = req.user.id; // Assuming user is attached to request by auth middleware

      const invoice = await Invoice.findById(id);
      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      if (invoice.status !== 'paid') {
        return res.status(400).json({
          success: false,
          message: 'Can only refund paid invoices'
        });
      }

      const refundAmount = amount || invoice.remainingBalance;
      if (refundAmount > invoice.remainingBalance) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount exceeds remaining balance'
        });
      }

      // Process the refund
      const externalRefundId = `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      await invoice.addRefund(refundAmount, reason, refundedBy, externalRefundId);

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refundAmount,
          remainingBalance: invoice.remainingBalance,
          status: invoice.status
        }
      });

    } catch (error) {
      console.error('Error in processRefund controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process refund',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/invoices/:id/pdf
   * Generate and download invoice PDF
   */
  async generateInvoicePDF(req, res) {
    try {
      const { id } = req.params;

      const invoice = await Invoice.findById(id)
        .populate('userId', 'name firstName lastName email phone address company')
        .populate('subscriptionId');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      // Create PDF
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Add company header
      doc.fontSize(20).text('Eagle Trading', 50, 50);
      doc.fontSize(10).text('Professional Trading Platform', 50, 75);
      doc.text('support@eagle-trading.com', 50, 90);

      // Add invoice details
      doc.fontSize(16).text('INVOICE', 400, 50);
      doc.fontSize(10);
      doc.text(`Invoice #: ${invoice.invoiceNumber}`, 400, 75);
      doc.text(`Date: ${invoice.issueDate.toLocaleDateString()}`, 400, 90);
      doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`, 400, 105);

      // Add billing information
      doc.fontSize(12).text('Bill To:', 50, 150);
      doc.fontSize(10);
      const user = invoice.userId;
      doc.text(user.name || `${user.firstName} ${user.lastName}`, 50, 170);
      doc.text(user.email, 50, 185);
      if (user.company) doc.text(user.company, 50, 200);
      if (user.address?.streetAddress) {
        doc.text(user.address.streetAddress, 50, 215);
        doc.text(`${user.address.townCity}, ${user.address.stateCounty} ${user.address.postcodeZip}`, 50, 230);
        doc.text(user.address.country, 50, 245);
      }

      // Add line items
      let yPosition = 300;
      doc.fontSize(12).text('Description', 50, yPosition);
      doc.text('Quantity', 250, yPosition);
      doc.text('Unit Price', 350, yPosition);
      doc.text('Total', 450, yPosition);

      yPosition += 20;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 10;

      doc.fontSize(10);
      invoice.items.forEach(item => {
        doc.text(item.description, 50, yPosition);
        doc.text(item.quantity.toString(), 250, yPosition);
        doc.text(`$${item.unitPrice.toFixed(2)}`, 350, yPosition);
        doc.text(`$${item.totalPrice.toFixed(2)}`, 450, yPosition);
        yPosition += 20;
      });

      // Add totals
      yPosition += 20;
      doc.text(`Subtotal: $${invoice.subtotal.toFixed(2)}`, 350, yPosition);
      yPosition += 15;

      if (invoice.taxAmount > 0) {
        doc.text(`Tax: $${invoice.taxAmount.toFixed(2)}`, 350, yPosition);
        yPosition += 15;
      }

      if (invoice.discountAmount > 0) {
        doc.text(`Discount: -$${invoice.discountAmount.toFixed(2)}`, 350, yPosition);
        yPosition += 15;
      }

      doc.fontSize(12).text(`Total: $${invoice.total.toFixed(2)}`, 350, yPosition);

      // Add payment status
      yPosition += 30;
      doc.fontSize(10).text(`Status: ${invoice.status.toUpperCase()}`, 50, yPosition);
      if (invoice.paidAt) {
        doc.text(`Paid on: ${invoice.paidAt.toLocaleDateString()}`, 50, yPosition + 15);
      }

      // Add notes if any
      if (invoice.notes) {
        yPosition += 50;
        doc.text('Notes:', 50, yPosition);
        doc.text(invoice.notes, 50, yPosition + 15);
      }

      doc.end();

    } catch (error) {
      console.error('Error in generateInvoicePDF controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate invoice PDF',
        error: error.message
      });
    }
  }

  /**
   * POST /api/v1/invoices/:id/send
   * Send invoice via email
   */
  async sendInvoiceEmail(req, res) {
    try {
      const { id } = req.params;
      const { recipient, subject, message } = req.body;

      const invoice = await Invoice.findById(id)
        .populate('userId', 'name firstName lastName email');

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found'
        });
      }

      // Configure email transporter (you'll need to set up email service)
      const transporter = nodemailer.createTransport({
        // Configure your email service here
        // Example for Gmail:
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const emailRecipient = recipient || invoice.userId.email;
      const emailSubject = subject || `Invoice ${invoice.invoiceNumber} from Eagle Trading`;
      const emailMessage = message || `
        Dear ${invoice.userId.name || 'Customer'},
        
        Please find attached your invoice ${invoice.invoiceNumber}.
        
        Amount Due: $${invoice.amountDue.toFixed(2)}
        Due Date: ${invoice.dueDate.toLocaleDateString()}
        
        Thank you for your business!
        
        Best regards,
        Eagle Trading Team
      `;

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@eagle-trading.com',
        to: emailRecipient,
        subject: emailSubject,
        text: emailMessage,
        html: emailMessage.replace(/\n/g, '<br>')
      };

      await transporter.sendMail(mailOptions);

      // Record email attempt
      invoice.emailAttempts.push({
        recipient: emailRecipient,
        status: 'sent',
        emailType: 'invoice'
      });

      invoice.emailSent = true;
      invoice.emailSentAt = new Date();
      await invoice.save();

      res.status(200).json({
        success: true,
        message: 'Invoice email sent successfully',
        data: {
          recipient: emailRecipient,
          sentAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error in sendInvoiceEmail controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send invoice email',
        error: error.message
      });
    }
  }

  /**
   * GET /api/v1/export/financials
   * Export financial data
   */
  async exportFinancialData(req, res) {
    try {
      const {
        format = 'csv',
        start_date,
        end_date,
        include_invoices = true,
        include_payments = true,
        include_refunds = true
      } = req.query;

      const dateFilter = {};
      if (start_date || end_date) {
        dateFilter.createdAt = {};
        if (start_date) dateFilter.createdAt.$gte = new Date(start_date);
        if (end_date) dateFilter.createdAt.$lte = new Date(end_date);
      }

      const exportData = [];

      // Include invoices
      if (include_invoices === 'true') {
        const invoices = await Invoice.find(dateFilter)
          .populate('userId', 'name email')
          .sort({ createdAt: -1 });

        invoices.forEach(invoice => {
          exportData.push({
            type: 'Invoice',
            id: invoice.invoiceNumber,
            date: invoice.issueDate,
            customer: invoice.userId?.name || 'Unknown',
            email: invoice.userId?.email || '',
            amount: invoice.total,
            status: invoice.status,
            description: `Invoice ${invoice.invoiceNumber}`
          });
        });
      }

      // Include payments
      if (include_payments === 'true') {
        const payments = await Payment.find(dateFilter)
          .populate('userId', 'name email')
          .sort({ attemptedAt: -1 });

        payments.forEach(payment => {
          exportData.push({
            type: 'Payment',
            id: payment.paymentId,
            date: payment.attemptedAt,
            customer: payment.userId?.name || 'Unknown',
            email: payment.userId?.email || '',
            amount: payment.amount,
            status: payment.status,
            description: `Payment via ${payment.paymentMethod.type}`
          });
        });
      }

      // Include refunds
      if (include_refunds === 'true') {
        const refundedInvoices = await Invoice.find({
          ...dateFilter,
          'refunds.0': { $exists: true }
        }).populate('userId', 'name email');

        refundedInvoices.forEach(invoice => {
          invoice.refunds.forEach(refund => {
            exportData.push({
              type: 'Refund',
              id: `REF-${invoice.invoiceNumber}`,
              date: refund.refundedAt,
              customer: invoice.userId?.name || 'Unknown',
              email: invoice.userId?.email || '',
              amount: -refund.amount, // Negative for refunds
              status: refund.status,
              description: `Refund for ${invoice.invoiceNumber}: ${refund.reason}`
            });
          });
        });
      }

      // Sort by date
      exportData.sort((a, b) => new Date(b.date) - new Date(a.date));

      let content, contentType, extension;

      switch (format.toLowerCase()) {
        case 'csv':
          content = this.convertToCSV(exportData);
          contentType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          contentType = 'application/json';
          extension = 'json';
          break;
        default:
          throw new Error('Unsupported export format');
      }

      const filename = `financial-data-${new Date().toISOString().split('T')[0]}.${extension}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(content);

    } catch (error) {
      console.error('Error in exportFinancialData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export financial data',
        error: error.message
      });
    }
  }

  convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        if (value instanceof Date) {
          return value.toISOString().split('T')[0];
        }
        return value;
      }).join(',')
    );

    return [csvHeaders, ...csvRows].join('\n');
  }
}

module.exports = new InvoiceController();





