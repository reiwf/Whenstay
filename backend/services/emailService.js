const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.ADMIN_EMAIL || 'noreply@yourhotel.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (!process.env.RESEND_API_KEY) {
      console.warn('Resend API key not configured - emails will not be sent');
    }
  }

  // Send check-in invitation email to guest
  async sendCheckinInvitation(guestEmail, guestName, checkinToken, checkInDate) {
    try {
      const checkinUrl = `${this.frontendUrl}/checkin/${checkinToken}`;
      
      const emailData = {
        from: this.fromEmail,
        to: guestEmail,
        subject: 'Complete Your Online Check-in - Whenstay',
        html: this.getCheckinInvitationTemplate(guestName, checkinUrl, checkInDate)
      };

      const result = await this.resend.emails.send(emailData);
      console.log('Check-in invitation sent:', result.id);
      return result;
    } catch (error) {
      console.error('Error sending check-in invitation:', error);
      throw new Error('Failed to send check-in invitation email');
    }
  }

  // Send confirmation email after guest completes check-in
  async sendCheckinConfirmation(guestEmail, guestName, checkInDate) {
    try {
      const emailData = {
        from: this.fromEmail,
        to: guestEmail,
        subject: 'Check-in Completed - Whenstay',
        html: this.getCheckinConfirmationTemplate(guestName, checkInDate)
      };

      const result = await this.resend.emails.send(emailData);
      console.log('Check-in confirmation sent:', result.id);
      return result;
    } catch (error) {
      console.error('Error sending check-in confirmation:', error);
      throw new Error('Failed to send check-in confirmation email');
    }
  }

  // Send notification to admin about new check-in submission
  async sendAdminNotification(guestName, guestEmail, checkInDate, reservationId) {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        console.warn('Admin email not configured - skipping admin notification');
        return;
      }

      const emailData = {
        from: this.fromEmail,
        to: adminEmail,
        subject: `New Check-in Submission - ${guestName}`,
        html: this.getAdminNotificationTemplate(guestName, guestEmail, checkInDate, reservationId)
      };

      const result = await this.resend.emails.send(emailData);
      console.log('Admin notification sent:', result.id);
      return result;
    } catch (error) {
      console.error('Error sending admin notification:', error);
      // Don't throw error for admin notifications to avoid blocking guest flow
    }
  }

  // Check-in invitation email template
  getCheckinInvitationTemplate(guestName, checkinUrl, checkInDate) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Complete Your Check-in</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .button { 
            display: inline-block; 
            background: #2563eb; 
            color: white; 
            padding: 12px 30px; 
            text-decoration: none; 
            border-radius: 5px; 
            margin: 20px 0; 
          }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Whenstay!</h1>
          </div>
          <div class="content">
            <h2>Hello ${guestName},</h2>
            <p>Thank you for choosing Whenstay! We're excited to welcome you on <strong>${new Date(checkInDate).toLocaleDateString()}</strong>.</p>
            
            <p>To make your arrival smooth and efficient, please complete your online check-in by clicking the button below:</p>
            
            <div style="text-align: center;">
              <a href="${checkinUrl}" class="button">Complete Online Check-in</a>
            </div>
            
            <p>During the online check-in process, you'll need to provide:</p>
            <ul>
              <li>Upload a photo of your passport/ID</li>
              <li>Confirm your address</li>
              <li>Estimated arrival time</li>
              <li>Purpose of travel</li>
            </ul>
            
            <p>This link is secure and unique to your reservation. Please complete your check-in at least 24 hours before your arrival.</p>
            
            <p>If you have any questions, please don't hesitate to contact us.</p>
            
            <p>We look forward to hosting you!</p>
            
            <p>Best regards,<br>The Whenstay Team</p>
          </div>
          <div class="footer">
            <p>This email was sent regarding your upcoming stay. If you did not make this reservation, please contact us immediately.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Check-in confirmation email template
  getCheckinConfirmationTemplate(guestName, checkInDate) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Check-in Completed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #059669; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Check-in Completed!</h1>
          </div>
          <div class="content">
            <h2>Hello ${guestName},</h2>
            <p>Great news! Your online check-in has been successfully completed.</p>
            
            <p>Your information has been received and is being reviewed by our team. You'll be all set for a smooth arrival on <strong>${new Date(checkInDate).toLocaleDateString()}</strong>.</p>
            
            <p><strong>What's next?</strong></p>
            <ul>
              <li>Our team will review your submitted information</li>
              <li>You'll receive a confirmation once everything is verified</li>
              <li>Simply arrive at your scheduled time - no need to wait in line!</li>
            </ul>
            
            <p>If you need to make any changes or have questions, please contact us as soon as possible.</p>
            
            <p>We can't wait to welcome you!</p>
            
            <p>Best regards,<br>The Whenstay Team</p>
          </div>
          <div class="footer">
            <p>Thank you for choosing Whenstay. We're committed to making your stay exceptional.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Admin notification email template
  getAdminNotificationTemplate(guestName, guestEmail, checkInDate, reservationId) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Check-in Submission</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .info-box { background: #f8f9fa; padding: 15px; border-left: 4px solid #dc2626; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 New Check-in Submission</h1>
          </div>
          <div class="content">
            <h2>Admin Notification</h2>
            <p>A guest has completed their online check-in and requires review.</p>
            
            <div class="info-box">
              <h3>Guest Details:</h3>
              <p><strong>Name:</strong> ${guestName}</p>
              <p><strong>Email:</strong> ${guestEmail}</p>
              <p><strong>Check-in Date:</strong> ${new Date(checkInDate).toLocaleDateString()}</p>
              <p><strong>Reservation ID:</strong> ${reservationId}</p>
            </div>
            
            <p>Please log into the admin dashboard to review the submitted documents and information.</p>
            
            <p><strong>Action Required:</strong></p>
            <ul>
              <li>Review uploaded passport/ID document</li>
              <li>Verify guest information</li>
              <li>Mark as "Ready for Check-in" when approved</li>
            </ul>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();


