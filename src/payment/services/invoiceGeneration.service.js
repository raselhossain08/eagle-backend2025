const { Invoice, Receipt } = require('../models/billing.model');
const TaxCalculationService = require('./taxCalculation.service');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const cloudinary = require('../../config/cloudinary');
const nodemailer = require('nodemailer');

/**
 * Invoice Generation Service with PDF Support and Email Delivery
 */
class InvoiceService {
  constructor() {
    this.taxService = new TaxCalculationService();
    this.sequenceCounters = new Map();

    // Email transporter setup
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  /**
   * Create a new invoice with automatic tax calculation
   */
  async createInvoice(invoiceData, options = {}) {
    try {
      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(invoiceData.currency);

      // Calculate taxes if not provided
      let taxCalculation = invoiceData.taxCalculation;
      if (!taxCalculation || options.recalculateTax) {
        taxCalculation = await this.calculateInvoiceTax(invoiceData);
      }

      // Create invoice document
      const invoice = new Invoice({
        ...invoiceData,
        invoiceNumber,
        invoiceSequence: await this.getNextSequence(invoiceData.currency),
        taxCalculation,
        dueDate: invoiceData.dueDate || this.calculateDueDate(),
        status: 'OPEN'
      });

      // Calculate all amounts
      invoice.calculateAmounts();

      // Save invoice
      await invoice.save();

      // Generate PDF if requested
      if (options.generatePdf !== false) {
        await this.generateInvoicePDF(invoice._id, options.templateId);
      }

      // Send email if requested
      if (options.sendEmail) {
        await this.sendInvoiceEmail(invoice._id, options.emailOptions);
      }

      return invoice;
    } catch (error) {
      console.error('Invoice creation error:', error);
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Calculate tax for invoice
   */
  async calculateInvoiceTax(invoiceData) {
    try {
      const transactionData = {
        customerId: invoiceData.customerId,
        lineItems: invoiceData.lineItems,
        billingAddress: invoiceData.billingAddress,
        currency: invoiceData.currency,
        customerType: invoiceData.customerType || 'INDIVIDUAL'
      };

      return await this.taxService.calculateTax(transactionData, {
        provider: invoiceData.taxProvider
      });
    } catch (error) {
      console.error('Tax calculation error for invoice:', error);
      // Return minimal tax calculation to avoid blocking invoice creation
      return {
        provider: 'MANUAL',
        calculatedAt: new Date(),
        taxLines: [],
        exemptions: [],
        reverseCharge: { applicable: false }
      };
    }
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber(currency) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const sequence = await this.getNextSequence(currency);

    return `INV-${year}${month}-${currency}-${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Get next sequence number for currency
   */
  async getNextSequence(currency) {
    const key = `${currency}-${new Date().getFullYear()}-${new Date().getMonth() + 1}`;

    if (!this.sequenceCounters.has(key)) {
      // Get last invoice for this currency and month
      const lastInvoice = await Invoice.findOne({
        currency,
        invoiceDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          $lt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
        }
      }).sort({ invoiceSequence: -1 });

      const lastSequence = lastInvoice ? lastInvoice.invoiceSequence : 0;
      this.sequenceCounters.set(key, lastSequence);
    }

    const currentSequence = this.sequenceCounters.get(key) + 1;
    this.sequenceCounters.set(key, currentSequence);

    return currentSequence;
  }

  /**
   * Calculate default due date
   */
  calculateDueDate() {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (parseInt(process.env.DEFAULT_PAYMENT_TERMS) || 30));
    return dueDate;
  }

  /**
   * Generate PDF for invoice
   */
  async generateInvoicePDF(invoiceId, templateId = 'default') {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('customerId', 'name email company billingAddress')
        .lean();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `Invoice ${invoice.invoiceNumber}`,
          Author: process.env.COMPANY_NAME || 'Your Company',
          Subject: `Invoice for ${invoice.customerId.name}`,
          Creator: 'Eagle Subscription Platform'
        }
      });

      // Generate PDF content based on template
      await this.generatePDFContent(doc, invoice, templateId);

      // Save PDF to buffer
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);

            // Upload to cloud storage
            const uploadResult = await this.uploadPDFToCloud(
              pdfBuffer,
              `invoice-${invoice.invoiceNumber}.pdf`
            );

            // Update invoice with PDF information
            await Invoice.findByIdAndUpdate(invoiceId, {
              'pdfGeneration.generated': true,
              'pdfGeneration.generatedAt': new Date(),
              'pdfGeneration.fileUrl': uploadResult.secure_url,
              'pdfGeneration.fileSize': pdfBuffer.length,
              'pdfGeneration.templateId': templateId,
              'pdfGeneration.version': 1
            });

            resolve({
              url: uploadResult.secure_url,
              size: pdfBuffer.length,
              buffer: pdfBuffer
            });
          } catch (error) {
            reject(error);
          }
        });

        doc.on('error', reject);
        doc.end();
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  /**
   * Generate PDF content based on template
   */
  async generatePDFContent(doc, invoice, templateId) {
    const template = this.getTemplate(templateId);

    // Header with company branding
    await this.addPDFHeader(doc, invoice, template);

    // Invoice details
    this.addInvoiceDetails(doc, invoice, template);

    // Customer information
    this.addCustomerDetails(doc, invoice, template);

    // Line items table
    this.addLineItemsTable(doc, invoice, template);

    // Tax breakdown
    this.addTaxBreakdown(doc, invoice, template);

    // Payment information
    this.addPaymentInformation(doc, invoice, template);

    // Footer
    this.addPDFFooter(doc, invoice, template);
  }

  /**
   * Get PDF template configuration
   */
  getTemplate(templateId) {
    const templates = {
      default: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        fontFamily: 'Helvetica',
        logoUrl: process.env.COMPANY_LOGO_URL,
        headerHeight: 100,
        footerHeight: 80
      },
      modern: {
        primaryColor: '#7c3aed',
        secondaryColor: '#6b7280',
        fontFamily: 'Helvetica',
        logoUrl: process.env.COMPANY_LOGO_URL,
        headerHeight: 120,
        footerHeight: 100
      },
      classic: {
        primaryColor: '#1f2937',
        secondaryColor: '#4b5563',
        fontFamily: 'Times-Roman',
        logoUrl: process.env.COMPANY_LOGO_URL,
        headerHeight: 80,
        footerHeight: 60
      }
    };

    return templates[templateId] || templates.default;
  }

  /**
   * Add PDF header with company branding
   */
  async addPDFHeader(doc, invoice, template) {
    const startY = 50;

    // Company logo (if available)
    if (template.logoUrl) {
      try {
        // Note: In production, you'd fetch and embed the logo
        // doc.image(logoBuffer, 50, startY, { width: 100 });
      } catch (error) {
        console.warn('Logo loading failed:', error);
      }
    }

    // Company information
    doc.fontSize(20)
      .fillColor(template.primaryColor)
      .text(process.env.COMPANY_NAME || 'Your Company', 50, startY, { align: 'left' });

    doc.fontSize(10)
      .fillColor(template.secondaryColor)
      .text(process.env.COMPANY_ADDRESS_LINE1 || '123 Business Street', 50, startY + 25)
      .text(`${process.env.COMPANY_CITY || 'City'}, ${process.env.COMPANY_STATE || 'State'} ${process.env.COMPANY_POSTAL_CODE || '12345'}`, 50, startY + 38)
      .text(process.env.COMPANY_COUNTRY || 'Country', 50, startY + 51);

    // Invoice title and number
    doc.fontSize(24)
      .fillColor(template.primaryColor)
      .text('INVOICE', 400, startY, { align: 'right' });

    doc.fontSize(12)
      .fillColor('#000000')
      .text(`Invoice #: ${invoice.invoiceNumber}`, 400, startY + 30, { align: 'right' });

    // Add line separator
    doc.moveTo(50, startY + template.headerHeight)
      .lineTo(545, startY + template.headerHeight)
      .strokeColor(template.primaryColor)
      .lineWidth(2)
      .stroke();
  }

  /**
   * Add invoice details section
   */
  addInvoiceDetails(doc, invoice, template) {
    const startY = 180;

    doc.fontSize(12)
      .fillColor('#000000')
      .text('Invoice Date:', 50, startY)
      .text(new Date(invoice.invoiceDate).toLocaleDateString(), 150, startY)
      .text('Due Date:', 50, startY + 15)
      .text(new Date(invoice.dueDate).toLocaleDateString(), 150, startY + 15)
      .text('Currency:', 50, startY + 30)
      .text(invoice.currency, 150, startY + 30);

    if (invoice.subscriptionId) {
      doc.text('Subscription ID:', 50, startY + 45)
        .text(invoice.subscriptionId.toString().slice(-8), 150, startY + 45);
    }
  }

  /**
   * Add customer details section
   */
  addCustomerDetails(doc, invoice, template) {
    const startY = 180;

    doc.fontSize(12)
      .fillColor('#000000')
      .text('Bill To:', 350, startY)
      .fontSize(11);

    const customer = invoice.customerId;
    const billing = invoice.billingAddress;

    let yPosition = startY + 20;

    if (customer.name) {
      doc.text(customer.name, 350, yPosition);
      yPosition += 15;
    }

    if (billing.company) {
      doc.text(billing.company, 350, yPosition);
      yPosition += 15;
    }

    doc.text(billing.line1, 350, yPosition);
    yPosition += 15;

    if (billing.line2) {
      doc.text(billing.line2, 350, yPosition);
      yPosition += 15;
    }

    doc.text(`${billing.city}, ${billing.state || ''} ${billing.postalCode}`, 350, yPosition);
    yPosition += 15;

    doc.text(billing.country, 350, yPosition);

    if (billing.vatNumber) {
      yPosition += 15;
      doc.text(`VAT: ${billing.vatNumber}`, 350, yPosition);
    }
  }

  /**
   * Add line items table
   */
  addLineItemsTable(doc, invoice, template) {
    const startY = 280;
    const tableTop = startY;
    const tableLeft = 50;
    const tableWidth = 495;

    // Table headers
    const headers = ['Description', 'Qty', 'Unit Price', 'Amount'];
    const columnWidths = [250, 60, 90, 95];
    let currentX = tableLeft;

    doc.fontSize(10)
      .fillColor(template.primaryColor);

    headers.forEach((header, index) => {
      doc.text(header, currentX, tableTop, {
        width: columnWidths[index],
        align: index === 0 ? 'left' : 'right'
      });
      currentX += columnWidths[index];
    });

    // Header line
    doc.moveTo(tableLeft, tableTop + 15)
      .lineTo(tableLeft + tableWidth, tableTop + 15)
      .strokeColor(template.primaryColor)
      .lineWidth(1)
      .stroke();

    // Line items
    let currentY = tableTop + 25;
    doc.fontSize(9)
      .fillColor('#000000');

    invoice.lineItems.forEach(item => {
      currentX = tableLeft;

      // Description
      doc.text(item.description, currentX, currentY, {
        width: columnWidths[0],
        align: 'left',
        ellipsis: true
      });
      currentX += columnWidths[0];

      // Quantity
      doc.text(item.quantity.toString(), currentX, currentY, {
        width: columnWidths[1],
        align: 'right'
      });
      currentX += columnWidths[1];

      // Unit Price
      doc.text(this.formatCurrency(item.unitPrice, invoice.currency), currentX, currentY, {
        width: columnWidths[2],
        align: 'right'
      });
      currentX += columnWidths[2];

      // Amount
      doc.text(this.formatCurrency(item.amount, invoice.currency), currentX, currentY, {
        width: columnWidths[3],
        align: 'right'
      });

      currentY += 20;
    });

    // Totals section
    currentY += 10;
    const totalsX = tableLeft + tableWidth - 200;

    // Subtotal
    doc.text('Subtotal:', totalsX, currentY, { align: 'left' });
    doc.text(this.formatCurrency(invoice.amounts.subtotal, invoice.currency),
      totalsX + 100, currentY, { align: 'right' });
    currentY += 15;

    // Discount
    if (invoice.amounts.discountTotal > 0) {
      doc.text('Discount:', totalsX, currentY, { align: 'left' });
      doc.text(`-${this.formatCurrency(invoice.amounts.discountTotal, invoice.currency)}`,
        totalsX + 100, currentY, { align: 'right' });
      currentY += 15;
    }

    // Tax
    if (invoice.amounts.taxTotal > 0) {
      doc.text('Tax:', totalsX, currentY, { align: 'left' });
      doc.text(this.formatCurrency(invoice.amounts.taxTotal, invoice.currency),
        totalsX + 100, currentY, { align: 'right' });
      currentY += 15;
    }

    // Total line
    doc.moveTo(totalsX, currentY)
      .lineTo(totalsX + 200, currentY)
      .strokeColor(template.primaryColor)
      .lineWidth(1)
      .stroke();

    currentY += 10;

    // Total
    doc.fontSize(12)
      .fillColor(template.primaryColor)
      .text('Total:', totalsX, currentY, { align: 'left' });
    doc.text(this.formatCurrency(invoice.amounts.total, invoice.currency),
      totalsX + 100, currentY, { align: 'right' });

    return currentY + 30;
  }

  /**
   * Add tax breakdown section
   */
  addTaxBreakdown(doc, invoice, template) {
    if (!invoice.taxCalculation.taxLines || invoice.taxCalculation.taxLines.length === 0) {
      return;
    }

    const startY = 520;

    doc.fontSize(12)
      .fillColor(template.primaryColor)
      .text('Tax Breakdown:', 50, startY);

    let currentY = startY + 20;
    doc.fontSize(9)
      .fillColor('#000000');

    invoice.taxCalculation.taxLines.forEach(taxLine => {
      doc.text(`${taxLine.jurisdiction} (${taxLine.rate.toFixed(2)}%):`, 70, currentY);
      doc.text(this.formatCurrency(taxLine.taxAmount, invoice.currency), 300, currentY, { align: 'right' });
      currentY += 12;
    });

    // Reverse charge notice
    if (invoice.taxCalculation.reverseCharge.applicable) {
      currentY += 10;
      doc.fontSize(8)
        .fillColor(template.secondaryColor)
        .text('* Reverse charge applicable - VAT to be accounted for by recipient', 70, currentY);
    }
  }

  /**
   * Add payment information section
   */
  addPaymentInformation(doc, invoice, template) {
    const startY = 600;

    doc.fontSize(12)
      .fillColor(template.primaryColor)
      .text('Payment Information:', 50, startY);

    doc.fontSize(9)
      .fillColor('#000000')
      .text('Please remit payment by the due date to avoid late fees.', 50, startY + 20)
      .text(`Amount Due: ${this.formatCurrency(invoice.amounts.amountDue, invoice.currency)}`, 50, startY + 35);

    // Payment methods
    if (process.env.BANK_ACCOUNT_INFO) {
      doc.text('Bank Transfer Details:', 50, startY + 55)
        .text(process.env.BANK_ACCOUNT_INFO, 50, startY + 70);
    }
  }

  /**
   * Add PDF footer
   */
  addPDFFooter(doc, invoice, template) {
    const pageHeight = 792; // A4 height in points
    const footerY = pageHeight - template.footerHeight;

    // Footer line
    doc.moveTo(50, footerY)
      .lineTo(545, footerY)
      .strokeColor(template.secondaryColor)
      .lineWidth(1)
      .stroke();

    // Footer content
    doc.fontSize(8)
      .fillColor(template.secondaryColor)
      .text(`Generated on ${new Date().toLocaleDateString()}`, 50, footerY + 15)
      .text(`Invoice ID: ${invoice._id}`, 50, footerY + 28);

    // Page number
    doc.text('Page 1 of 1', 495, footerY + 15, { align: 'right' });

    // Company footer info
    if (process.env.COMPANY_WEBSITE) {
      doc.text(process.env.COMPANY_WEBSITE, 50, footerY + 50);
    }

    if (process.env.COMPANY_EMAIL) {
      doc.text(process.env.COMPANY_EMAIL, 200, footerY + 50);
    }

    if (process.env.COMPANY_PHONE) {
      doc.text(process.env.COMPANY_PHONE, 350, footerY + 50);
    }
  }

  /**
   * Upload PDF to cloud storage
   */
  async uploadPDFToCloud(pdfBuffer, filename) {
    try {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'raw',
            folder: 'invoices',
            public_id: filename.replace('.pdf', ''),
            format: 'pdf'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        uploadStream.end(pdfBuffer);
      });
    } catch (error) {
      console.error('PDF upload error:', error);
      throw error;
    }
  }

  /**
   * Send invoice via email
   */
  async sendInvoiceEmail(invoiceId, emailOptions = {}) {
    try {
      const invoice = await Invoice.findById(invoiceId)
        .populate('customerId', 'name email')
        .lean();

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const customer = invoice.customerId;
      const recipientEmail = emailOptions.to || customer.email;

      if (!recipientEmail) {
        throw new Error('No recipient email address available');
      }

      // Get PDF attachment
      let pdfAttachment = null;
      if (invoice.pdfGeneration.generated && invoice.pdfGeneration.fileUrl) {
        // In production, you'd download the PDF from cloud storage
        pdfAttachment = {
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          path: invoice.pdfGeneration.fileUrl,
          contentType: 'application/pdf'
        };
      }

      // Prepare email content
      const emailContent = this.generateInvoiceEmailContent(invoice, emailOptions);

      // Send email
      const result = await this.emailTransporter.sendMail({
        from: emailOptions.from || process.env.INVOICE_FROM_EMAIL || process.env.SMTP_USER,
        to: recipientEmail,
        cc: emailOptions.cc,
        bcc: emailOptions.bcc,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments: pdfAttachment ? [pdfAttachment] : []
      });

      // Update invoice with delivery information
      await Invoice.findByIdAndUpdate(invoiceId, {
        'emailDelivery.sent': true,
        'emailDelivery.sentAt': new Date(),
        'emailDelivery.sentTo': [recipientEmail],
        $push: {
          'emailDelivery.deliveryAttempts': {
            attemptedAt: new Date(),
            successful: true,
            emailProvider: 'SMTP'
          }
        }
      });

      return {
        success: true,
        messageId: result.messageId,
        sentTo: recipientEmail
      };
    } catch (error) {
      console.error('Invoice email error:', error);

      // Log failed delivery attempt
      await Invoice.findByIdAndUpdate(invoiceId, {
        $push: {
          'emailDelivery.deliveryAttempts': {
            attemptedAt: new Date(),
            successful: false,
            errorMessage: error.message,
            emailProvider: 'SMTP'
          }
        }
      });

      throw new Error(`Failed to send invoice email: ${error.message}`);
    }
  }

  /**
   * Generate email content for invoice
   */
  generateInvoiceEmailContent(invoice, options = {}) {
    const customer = invoice.customerId;
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();
    const amount = this.formatCurrency(invoice.amounts.total, invoice.currency);

    const subject = options.subject ||
      `Invoice ${invoice.invoiceNumber} from ${process.env.COMPANY_NAME || 'Your Company'}`;

    const text = `
Dear ${customer.name || 'Valued Customer'},

Please find attached your invoice ${invoice.invoiceNumber} for ${amount}.

Invoice Details:
- Invoice Number: ${invoice.invoiceNumber}
- Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}
- Due Date: ${dueDate}
- Amount Due: ${amount}

Please remit payment by the due date to avoid any late fees.

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
${process.env.COMPANY_NAME || 'Your Company'}
${process.env.COMPANY_EMAIL || ''}
${process.env.COMPANY_PHONE || ''}
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #2563eb; margin: 0;">Invoice ${invoice.invoiceNumber}</h2>
          <p style="color: #64748b; margin: 5px 0 0 0;">from ${process.env.COMPANY_NAME || 'Your Company'}</p>
        </div>
        
        <p>Dear ${customer.name || 'Valued Customer'},</p>
        
        <p>Please find attached your invoice for <strong>${amount}</strong>.</p>
        
        <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 5px 0;"><strong>Invoice Number:</strong></td>
              <td style="padding: 5px 0; text-align: right;">${invoice.invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Invoice Date:</strong></td>
              <td style="padding: 5px 0; text-align: right;">${new Date(invoice.invoiceDate).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 5px 0;"><strong>Due Date:</strong></td>
              <td style="padding: 5px 0; text-align: right;">${dueDate}</td>
            </tr>
            <tr style="border-top: 1px solid #cbd5e1;">
              <td style="padding: 10px 0 5px 0;"><strong>Amount Due:</strong></td>
              <td style="padding: 10px 0 5px 0; text-align: right; font-size: 18px; color: #2563eb;"><strong>${amount}</strong></td>
            </tr>
          </table>
        </div>
        
        <p>Please remit payment by the due date to avoid any late fees.</p>
        
        <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>
        
        <p>Thank you for your business!</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 14px;">
          <p><strong>${process.env.COMPANY_NAME || 'Your Company'}</strong></p>
          ${process.env.COMPANY_EMAIL ? `<p>Email: ${process.env.COMPANY_EMAIL}</p>` : ''}
          ${process.env.COMPANY_PHONE ? `<p>Phone: ${process.env.COMPANY_PHONE}</p>` : ''}
          ${process.env.COMPANY_WEBSITE ? `<p>Website: ${process.env.COMPANY_WEBSITE}</p>` : ''}
        </div>
      </div>
    `;

    return { subject, text, html };
  }

  /**
   * Resend invoice email
   */
  async resendInvoiceEmail(invoiceId, emailOptions = {}) {
    try {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Increment resend count
      const currentResends = invoice.emailDelivery.resendCount || 0;
      await Invoice.findByIdAndUpdate(invoiceId, {
        'emailDelivery.resendCount': currentResends + 1
      });

      // Send email with resend indicator
      const enhancedOptions = {
        ...emailOptions,
        subject: emailOptions.subject ||
          `[RESEND] Invoice ${invoice.invoiceNumber} from ${process.env.COMPANY_NAME || 'Your Company'}`
      };

      return await this.sendInvoiceEmail(invoiceId, enhancedOptions);
    } catch (error) {
      console.error('Invoice resend error:', error);
      throw error;
    }
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount, currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Create receipt for payment
   */
  async createReceipt(receiptData) {
    try {
      const receiptNumber = await this.generateReceiptNumber();

      const receipt = new Receipt({
        ...receiptData,
        receiptNumber
      });

      await receipt.save();

      // Generate PDF if requested
      if (receiptData.generatePdf !== false) {
        await this.generateReceiptPDF(receipt._id);
      }

      // Send email if requested
      if (receiptData.sendEmail) {
        await this.sendReceiptEmail(receipt._id, receiptData.emailOptions);
      }

      return receipt;
    } catch (error) {
      console.error('Receipt creation error:', error);
      throw new Error(`Failed to create receipt: ${error.message}`);
    }
  }

  /**
   * Generate receipt number
   */
  async generateReceiptNumber() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const sequence = await this.getReceiptSequence();

    return `RCP-${year}${month}-${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Get next receipt sequence
   */
  async getReceiptSequence() {
    const lastReceipt = await Receipt.findOne({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    }).sort({ createdAt: -1 });

    const match = lastReceipt?.receiptNumber.match(/RCP-\d{6}-(\d{6})/);
    return match ? parseInt(match[1]) + 1 : 1;
  }

  /**
   * Generate receipt PDF (simplified version)
   */
  async generateReceiptPDF(receiptId) {
    try {
      const receipt = await Receipt.findById(receiptId)
        .populate('customerId', 'name email')
        .populate('invoiceId', 'invoiceNumber')
        .lean();

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      // Create simple receipt PDF
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      // Header
      doc.fontSize(20)
        .text('PAYMENT RECEIPT', 50, 50, { align: 'center' });

      // Receipt details
      doc.fontSize(12)
        .text(`Receipt Number: ${receipt.receiptNumber}`, 50, 100)
        .text(`Payment Date: ${new Date(receipt.paymentDate).toLocaleDateString()}`, 50, 120)
        .text(`Amount Paid: ${this.formatCurrency(receipt.paymentAmount, receipt.paymentCurrency)}`, 50, 140)
        .text(`Payment Method: ${receipt.paymentMethod}`, 50, 160);

      if (receipt.invoiceId) {
        doc.text(`Invoice Number: ${receipt.invoiceId.invoiceNumber}`, 50, 180);
      }

      // Customer details
      doc.text(`Customer: ${receipt.customerId.name}`, 50, 220)
        .text(`Email: ${receipt.customerId.email}`, 50, 240);

      // Save and upload
      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));

      return new Promise((resolve, reject) => {
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);

            const uploadResult = await this.uploadPDFToCloud(
              pdfBuffer,
              `receipt-${receipt.receiptNumber}.pdf`
            );

            await Receipt.findByIdAndUpdate(receiptId, {
              'pdfGeneration.generated': true,
              'pdfGeneration.generatedAt': new Date(),
              'pdfGeneration.fileUrl': uploadResult.secure_url
            });

            resolve(uploadResult);
          } catch (error) {
            reject(error);
          }
        });

        doc.end();
      });
    } catch (error) {
      console.error('Receipt PDF generation error:', error);
      throw error;
    }
  }

  /**
   * Send receipt via email
   */
  async sendReceiptEmail(receiptId, emailOptions = {}) {
    try {
      const receipt = await Receipt.findById(receiptId)
        .populate('customerId', 'name email')
        .populate('invoiceId', 'invoiceNumber')
        .lean();

      if (!receipt) {
        throw new Error('Receipt not found');
      }

      const customer = receipt.customerId;
      const recipientEmail = emailOptions.to || customer.email;

      const subject = `Payment Receipt ${receipt.receiptNumber}`;
      const amount = this.formatCurrency(receipt.paymentAmount, receipt.paymentCurrency);

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Payment Received</h2>
          <p>Dear ${customer.name},</p>
          <p>Thank you for your payment. Here are the details:</p>
          <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p><strong>Receipt Number:</strong> ${receipt.receiptNumber}</p>
            <p><strong>Amount Paid:</strong> ${amount}</p>
            <p><strong>Payment Date:</strong> ${new Date(receipt.paymentDate).toLocaleDateString()}</p>
            <p><strong>Payment Method:</strong> ${receipt.paymentMethod}</p>
            ${receipt.invoiceId ? `<p><strong>Invoice:</strong> ${receipt.invoiceId.invoiceNumber}</p>` : ''}
          </div>
          <p>Thank you for your business!</p>
        </div>
      `;

      const result = await this.emailTransporter.sendMail({
        from: process.env.RECEIPT_FROM_EMAIL || process.env.SMTP_USER,
        to: recipientEmail,
        subject,
        html
      });

      await Receipt.findByIdAndUpdate(receiptId, {
        'emailDelivery.sent': true,
        'emailDelivery.sentAt': new Date(),
        'emailDelivery.sentTo': recipientEmail
      });

      return result;
    } catch (error) {
      console.error('Receipt email error:', error);
      throw error;
    }
  }
}

module.exports = InvoiceService;





