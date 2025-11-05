// Email service for sending various types of emails
// Note: This is a placeholder implementation. 
// In production, integrate with your preferred email service (SendGrid, Mailgun, etc.)

const sendEmail = async (to, subject, htmlContent, textContent = null) => {
  try {
    console.log(`📧 [EMAIL SERVICE] Sending email to: ${to}`);
    console.log(`📧 [EMAIL SERVICE] Subject: ${subject}`);
    console.log(`📧 [EMAIL SERVICE] Content: ${htmlContent.substring(0, 100)}...`);
    
    // TODO: Implement actual email sending logic here
    // For now, just log the email content for debugging
    
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      to,
      subject
    };
  } catch (error) {
    console.error(`❌ [EMAIL SERVICE] Error sending email to ${to}:`, error);
    throw error;
  }
};

const sendAccountActivationEmail = async (email, name, activationToken, frontendUrl) => {
  try {
    const activationUrl = `${frontendUrl}/activate?token=${activationToken}`;
    
    const subject = "Activate Your Eagle Investors Account";
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Activate Your Account</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to Eagle Investors!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for signing up with Eagle Investors! We're excited to have you join our community of successful investors.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              To complete your registration and activate your account, please click the button below:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${activationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                Activate Your Account
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If the button doesn't work, you can copy and paste this link into your browser:<br>
              <a href="${activationUrl}" style="color: #667eea; word-break: break-all;">${activationUrl}</a>
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 20px;">
              This activation link will expire in 24 hours for security reasons.
            </p>
            
            <hr style="border: none; height: 1px; background: #ddd; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              If you didn't create an account with Eagle Investors, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `;
    
    const textContent = `
      Welcome to Eagle Investors!
      
      Hello ${name},
      
      Thank you for signing up with Eagle Investors! To complete your registration and activate your account, please visit:
      
      ${activationUrl}
      
      This activation link will expire in 24 hours for security reasons.
      
      If you didn't create an account with Eagle Investors, you can safely ignore this email.
    `;
    
    return await sendEmail(email, subject, htmlContent, textContent);
  } catch (error) {
    console.error("❌ Error sending account activation email:", error);
    throw error;
  }
};

const sendWelcomeEmail = async (email, name, productType, frontendUrl) => {
  try {
    const subject = "Welcome Back to Eagle Investors";
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome Back</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome Back!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for your recent purchase of our ${productType} package! We're excited to continue working with you.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              You can access your account and manage your subscriptions by visiting our platform.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                Access Your Account
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
          </div>
        </body>
      </html>
    `;
    
    return await sendEmail(email, subject, htmlContent);
  } catch (error) {
    console.error("❌ Error sending welcome email:", error);
    throw error;
  }
};

const sendContractConfirmationEmail = async (email, name, contractId, productType, amount) => {
  try {
    const subject = "Contract Signed - Payment Pending";
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Contract Confirmation</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Contract Signed Successfully</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-bottom: 20px;">Hello ${name},</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your contract for the ${productType} package has been successfully signed and is now pending payment.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
              <h3 style="margin: 0 0 10px 0; color: #333;">Contract Details:</h3>
              <p style="margin: 5px 0;"><strong>Contract ID:</strong> ${contractId}</p>
              <p style="margin: 5px 0;"><strong>Package:</strong> ${productType}</p>
              <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount}</p>
              <p style="margin: 5px 0;"><strong>Status:</strong> Payment Pending</p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Please complete your payment to activate your subscription and gain access to all premium features.
            </p>
          </div>
        </body>
      </html>
    `;
    
    return await sendEmail(email, subject, htmlContent);
  } catch (error) {
    console.error("❌ Error sending contract confirmation email:", error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendAccountActivationEmail,
  sendWelcomeEmail,
  sendContractConfirmationEmail,
};