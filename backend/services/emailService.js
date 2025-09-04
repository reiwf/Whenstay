const { Resend } = require('resend');

class EmailService {
  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.fromEmail = process.env.ADMIN_EMAIL || 'chat@staylabel.com';
    this.invitationFromEmail = process.env.INVITATION_FROM_EMAIL || 'register@staylabel.com';
    this.frontendUrl = process.env.FRONTEND_URL || 'https://app.staylabel.com';
    
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
        subject: 'Complete Your Online Check-in - Staylabel',
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
        subject: 'Check-in Completed - Staylabel',
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

  // Send user invitation email
  async sendUserInvitation(email, invitationToken, role) {
    try {
      const invitationUrl = `${this.frontendUrl}/accept-invitation/${invitationToken}`;
      
      const emailData = {
        from: `"Register" <${this.invitationFromEmail}>`,
        to: email,
        subject: 'You\'re invited to join Staylabel',
        html: this.getUserInvitationTemplate(email, invitationUrl, role)
      };

      const result = await this.resend.emails.send(emailData);
      console.log('User invitation sent:', result.id);
      return result;
    } catch (error) {
      console.error('Error sending user invitation:', error);
      throw new Error('Failed to send user invitation email');
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
            <h1>Welcome to Staylabel!</h1>
          </div>
          <div class="content">
            <h2>Hello ${guestName},</h2>
            <p>Thank you for choosing Staylabel! We're excited to welcome you on <strong>${new Date(checkInDate).toLocaleDateString()}</strong>.</p>
            
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
            
            <p>Best regards,<br>The Staylabel Team</p>
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
            
            <p>Best regards,<br>The Staylabel Team</p>
          </div>
          <div class="footer">
            <p>Thank you for choosing Staylabel. We're committed to making your stay exceptional.</p>
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

  // User invitation email template
  getUserInvitationTemplate(email, invitationUrl, role) {
    return `
      <!DOCTYPE html>
        <html lang="en" style="mso-line-height-rule:exactly;">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width">
          <meta http-equiv="x-ua-compatible" content="ie=edge">
          <title>Welcome to Staylabel</title>
          <style>
            /* Dark-mode hint (supported clients only) */
            @media (prefers-color-scheme: dark) {
              body, .bg { background:#0B0B0C !important; }
              .card { background:#161617 !important; border-color:#262626 !important; }
              .text { color:#F3F4F6 !important; }
              .muted { color:#B3B3B3 !important; }
              .chip { background:#201A16 !important; }
            }
            @media only screen and (max-width:600px) {
              .container { width:100% !important; }
              .p-24 { padding:16px !important; }
              .h-24 { height:16px !important; }
            }
          </style>
        </head>
        <body class="bg" style="margin:0; padding:0; background:#F6F7F9; -webkit-font-smoothing:antialiased; -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%;">
          <!-- preheader (hidden) -->
          <div style="display:none; font-size:0; line-height:0; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
            Your Staylabel invite is ready—set your password to join the team.
          </div>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F6F7F9;">
            <tr>
              <td align="center" style="padding:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:100%;">
                  
                  <!-- Header -->
                  <tr>
                    <td style="padding:0 0 16px 0;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr>
                          <td align="left" style="padding:0;">
                            <!-- Brand chip -->
                            <div style="display:inline-block; padding:10px 14px; background:#FF6B00; color:#0A0A0A; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; font-weight:800; border-radius:10px;">
                              Staylabel
                            </div>
                          </td>
                          <td align="right" style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:12px; color:#6B7280;">
                            <span class="muted">Invitation</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Card -->
                  <tr>
                    <td class="card" style="background:#FFFFFF; border:1px solid #E5E7EB; border-radius:14px; padding:0;">
                      <!-- Accent bar -->
                      <div style="height:4px; width:100%; background:#FF6B00; border-top-left-radius:14px; border-top-right-radius:14px;"></div>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                        <tr><td class="h-24" style="height:24px; line-height:24px;">&nbsp;</td></tr>
                        <tr>
                          <td class="p-24" style="padding:0 24px;">
                            <h1 class="text" style="margin:0 0 8px 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:22px; line-height:30px; color:#0A0A0A;">
                              Welcome to Staylabel!
                            </h1>
                            <p class="text" style="margin:0 0 16px 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#111827;">
                              You’ve been invited to join our property management platform. We’re excited to have you on board!
                            </p>

                            <!-- Info chip -->
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                              <tr>
                                <td class="chip" style="background:#FFF7F0; border:1px solid #E5E7EB; border-left:4px solid #FF6B00; border-radius:10px; padding:16px;">
                                  <div class="text" style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#0A0A0A;">
                                    <strong>Your invitation details</strong><br>
                                    Email: ${email}<br>
                                    This invitation will expire in <strong>24 hours</strong>.
                                  </div>
                                </td>
                              </tr>
                            </table>

                            <div style="height:16px; line-height:16px;">&nbsp;</div>

                            <!-- CTA Button -->
                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                              <tr>
                                <td align="center" bgcolor="#FF6B00" style="border-radius:10px;">
                                  <a href="${invitationUrl}"
                                    style="display:inline-block; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; font-weight:700; color:#0A0A0A; text-decoration:none; padding:12px 24px; border-radius:10px; background:#FF6B00;">
                                    Accept Invitation &amp; Set Password
                                  </a>
                                </td>
                              </tr>
                            </table>

                            <div style="height:16px; line-height:16px;">&nbsp;</div>

                            <!-- Bullet list -->
                            <p class="text" style="margin:0 0 8px 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#0A0A0A;">
                              During setup you’ll be able to:
                            </p>
                            <ul style="margin:0 0 16px 20px; padding:0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#111827;">
                              <li>Create your secure password</li>
                              <li>Complete your profile information</li>
                              <li>Access your dashboard and start using the platform</li>
                            </ul>

                            <p class="text" style="margin:0 0 0 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#111827;">
                              <strong>Important:</strong> This link is unique to you and expires in 24 hours. If it expires, please request a new invitation.
                            </p>

                            <div style="height:20px; line-height:20px;">&nbsp;</div>

                            <p class="text" style="margin:0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:#0A0A0A; font-weight:600;">
                              The Staylabel Team
                            </p>
                          </td>
                        </tr>
                        <tr><td class="h-24" style="height:24px; line-height:24px;">&nbsp;</td></tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:16px 4px 0; text-align:center; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:12px; line-height:18px; color:#6B7280;">
                      This invitation was sent to ${email}. If you didn’t expect it, you can safely ignore this email. For security reasons, this link will expire in 24 hours.
                    </td>
                  </tr>
                  <tr><td style="height:24px; line-height:24px;">&nbsp;</td></tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
    `;
  }

  // Send generic message email through message panel with advanced threading
  async sendGenericMessage(guestEmail, guestName, subject, messageContent, reservationData = {}, messageId = null) {
    try {
      console.log('Sending email via Resend with HTML template:', { 
        to: guestEmail, 
        messageId, 
        hasReservationData: Object.keys(reservationData).length > 0 
      });

      // Get threading context if messageId is provided
      let threadingContext = null;
      if (messageId) {
        threadingContext = await this.getThreadingContext(messageId, reservationData);
      }

      // Generate unique Message-ID for this email
      const newMessageId = this.generateMessageId(reservationData.reservationId, messageId);
      
      // Prepare email headers with threading support
      const headers = {
        'Reply-To': this.fromEmail,
        'Message-ID': `<${newMessageId}@staylabel.com>`
      };

      // Add threading headers if we have context
      if (threadingContext && threadingContext.shouldThread) {
        if (threadingContext.inReplyTo) {
          headers['In-Reply-To'] = threadingContext.inReplyTo;
        }
        if (threadingContext.references) {
          headers['References'] = threadingContext.references;
        }
        console.log('Adding threading headers:', {
          inReplyTo: threadingContext.inReplyTo,
          references: threadingContext.references
        });
      }

      const emailData = {
        from: this.fromEmail,
        to: guestEmail,
        subject: subject || 'Message from Staylabel',
        html: this.getBrandedMessageTemplate(guestName, messageContent, reservationData),
        headers
      };

      const result = await this.resend.emails.send(emailData);
      console.log('Resend email sent successfully:', result.id);

      // Store email metadata for threading if messageId is provided
      if (messageId) {
        await this.storeEmailMetadata(messageId, {
          email_message_id: result.id,
          email_thread_id: threadingContext?.threadId || newMessageId,
          email_in_reply_to: threadingContext?.inReplyTo || null,
          email_references: threadingContext?.references || null,
          resend_message_id: result.id,
          email_provider_data: {
            resend_response: result,
            headers: headers,
            sent_at: new Date().toISOString()
          }
        });
      }

      return { 
        ...result, 
        emailThreadId: threadingContext?.threadId || newMessageId,
        emailMessageId: result.id,
        success: true,
        provider: 'resend'
      };
    } catch (error) {
      console.error('Error sending generic message email via Resend:', error);
      
      // Categorize Resend errors
      if (error.name === 'validation_error') {
        throw new Error(`Email validation error: ${error.message}`);
      } else if (error.name === 'rate_limit_exceeded') {
        throw new Error(`Rate limit exceeded: ${error.message}`);
      } else if (error.name === 'api_key_invalid') {
        throw new Error(`Invalid Resend API key: ${error.message}`);
      } else {
        throw new Error(`Failed to send message email: ${error.message}`);
      }
    }
  }

  // Generic message email template for message panel content
  getGenericMessageTemplate(guestName, messageContent, reservationData = {}) {
    const propertyName = reservationData.propertyName || 'Staylabel';
    const checkInDate = reservationData.checkInDate ? new Date(reservationData.checkInDate).toLocaleDateString() : null;
    const reservationId = reservationData.reservationId || null;
    
    // Convert plain text to HTML paragraphs
    const formattedContent = this.formatMessageContent(messageContent);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message from ${propertyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; }
          .message-content { 
            background: #f8f9fa; 
            padding: 20px; 
            border-left: 4px solid #2563eb; 
            margin: 20px 0;
            border-radius: 5px;
          }
          .reservation-info {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            font-size: 14px;
          }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .signature { margin-top: 20px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Message from ${propertyName}</h1>
          </div>
          <div class="content">
            <h2>Hello ${guestName},</h2>
            
            <div class="message-content">
              ${formattedContent}
            </div>
            
            ${checkInDate ? `
            <div class="reservation-info">
              <strong>Reservation Details:</strong><br>
              ${reservationId ? `Reservation ID: ${reservationId}<br>` : ''}
              ${checkInDate ? `Check-in Date: ${checkInDate}<br>` : ''}
              Property: ${propertyName}
            </div>
            ` : ''}
            
            <p>If you have any questions or need assistance, please don't hesitate to reply to this email or contact us directly.</p>
            
            <div class="signature">
              <p>Best regards,<br>
              The ${propertyName} Team</p>
            </div>
          </div>
          <div class="footer">
            <p>This message was sent regarding your reservation with ${propertyName}. If you believe you received this in error, please contact us.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Helper method to format plain text message content to HTML
  formatMessageContent(content) {
    if (!content) return '';
    
    // Convert line breaks to paragraphs
    const paragraphs = content
      .split(/\n\s*\n/) // Split on double line breaks
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .map(paragraph => {
        // Handle single line breaks within paragraphs
        const formattedParagraph = paragraph.replace(/\n/g, '<br>');
        return `<p>${formattedParagraph}</p>`;
      });
    
    return paragraphs.join('');
  }

  // Helper method to get email service status for debugging
  getServiceStatus() {
    return {
      configured: !!process.env.RESEND_API_KEY,
      fromEmail: this.fromEmail,
      frontendUrl: this.frontendUrl,
      hasResendInstance: !!this.resend
    };
  }

  // Helper method to validate email data before sending
  validateEmailData(emailData) {
    const errors = [];
    
    if (!emailData.to) {
      errors.push('Recipient email address is required');
    } else if (!/\S+@\S+\.\S+/.test(emailData.to)) {
      errors.push('Invalid recipient email address format');
    }
    
    if (!emailData.subject) {
      errors.push('Email subject is required');
    }
    
    if (!emailData.html && !emailData.text) {
      errors.push('Email content (HTML or text) is required');
    }
    
    if (!process.env.RESEND_API_KEY) {
      errors.push('Resend API key not configured');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get threading context from email_metadata table for proper thread continuation
  async getThreadingContext(messageId, reservationData = {}) {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      
      // Get the message and its thread
      const { data: message, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('thread_id')
        .eq('id', messageId)
        .single();

      if (msgError || !message) {
        console.log('No message found for threading context');
        return { shouldThread: false };
      }

      // Get the latest email metadata from this thread for threading
      const { data: latestEmailMessage, error: threadError } = await supabaseAdmin
        .from('messages')
        .select(`
          id,
          created_at,
          email_metadata!inner(
            email_message_id,
            email_thread_id,
            email_in_reply_to,
            email_references
          )
        `)
        .eq('thread_id', message.thread_id)
        .eq('channel', 'email')
        .not('email_metadata.email_message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (threadError) {
        console.error('Error getting threading context:', threadError);
        return { shouldThread: false };
      }

      if (!latestEmailMessage?.email_metadata) {
        console.log('No previous email metadata found for threading');
        return { shouldThread: false };
      }

      const metadata = latestEmailMessage.email_metadata;
      
      // Build References chain
      const references = [];
      if (metadata.email_references) {
        references.push(metadata.email_references);
      }
      if (metadata.email_message_id) {
        references.push(`<${metadata.email_message_id}@staylabel.com>`);
      }

      return {
        shouldThread: true,
        threadId: metadata.email_thread_id,
        inReplyTo: `<${metadata.email_message_id}@staylabel.com>`,
        references: references.join(' '),
        latestMessageId: metadata.email_message_id
      };

    } catch (error) {
      console.error('Error getting threading context:', error);
      return { shouldThread: false };
    }
  }

  // Generate unique Message-ID for email headers
  generateMessageId(reservationId, messageId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    if (reservationId && messageId) {
      return `msg-${reservationId}-${messageId}-${timestamp}-${random}`;
    } else if (reservationId) {
      return `msg-${reservationId}-${timestamp}-${random}`;
    } else if (messageId) {
      return `msg-${messageId}-${timestamp}-${random}`;
    } else {
      return `msg-${timestamp}-${random}`;
    }
  }

  // Generate unique email thread ID for threading
  generateEmailThreadId(reservationId, messageId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    if (reservationId && messageId) {
      return `thread-${reservationId}-${messageId}-${timestamp}-${random}`;
    } else if (reservationId) {
      return `thread-${reservationId}-${timestamp}-${random}`;
    } else {
      return `thread-${timestamp}-${random}`;
    }
  }

  // Branded message template (ported from n8nEmailService)
  getBrandedMessageTemplate(guestName, messageContent, reservationData = {}) {
    const propertyName = reservationData.propertyName || 'Staylabel';
    const checkInDate = reservationData.checkInDate ? new Date(reservationData.checkInDate).toLocaleDateString() : '';
    const reservationId = reservationData.reservationId || '';
    
    // Convert plain text to HTML paragraphs
    const formattedContent = this.formatMessageContent(messageContent);
    
    // Use the branded email template
    return this.buildBrandEmailHTML({
      propertyName,
      guestName,
      formattedContent,
      checkInDate,
      reservationId,
      logoUrl: '' // Could be configured later with process.env.BRAND_LOGO_URL
    });
  }

  // Modern branded email template with Staylabel design (ported from n8nEmailService)
  buildBrandEmailHTML({
    propertyName,
    guestName,
    formattedContent,
    checkInDate = "",
    reservationId = "",
    logoUrl = ""
  }) {
    const BRAND_ORANGE = "#ff6a0063";
    const BRAND_BLACK  = "#0A0A0A";
    const BG           = "#F6F7F9";
    const CARD_BG      = "#FFFFFF";
    const MUTED_TEXT   = "#6B7280";
    const BORDER       = "#E5E7EB";

    const preheaderText = `Message from ${propertyName}${reservationId ? ` • Reservation ${reservationId}` : ""}`;

    // helper snippet: reservation block if we have dates/id
    const reservationBlock = checkInDate
      ? `
        <tr>
          <td style="padding: 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: #FFF7F0; border: 1px solid ${BORDER}; border-radius: 10px;">
              <tr>
                <td style="padding: 14px 16px; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif; font-size: 14px; line-height: 20px; color: ${BRAND_BLACK};">
                  <div style="font-weight:700; margin-bottom:6px;">Reservation Details</div>
                  ${reservationId ? `<div style="color:${BRAND_BLACK};"><strong>ID:</strong> ${reservationId}</div>` : ""}
                  <div style="color:${BRAND_BLACK};"><strong>Check-in:</strong> ${checkInDate}</div>
                  <div style="color:${BRAND_BLACK};"><strong>Property:</strong> ${propertyName}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:16px; line-height:16px;">&nbsp;</td></tr>
      `
      : "";

    return `
<!DOCTYPE html>
<html lang="en" style="mso-line-height-rule: exactly;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="x-ua-compatible" content="ie=edge">
  <title>Message from ${propertyName}</title>
  <style>
    /* Dark-mode support (where available) */
    @media (prefers-color-scheme: dark) {
      body, .bg { background: #0B0B0C !important; }
      .card { background: #161617 !important; border-color: #262626 !important; }
      .muted { color: #B3B3B3 !important; }
      .text { color: #F3F4F6 !important; }
      .accent { background: ${BRAND_ORANGE} !important; color: #0A0A0A !important; }
      .chip { background: #201A16 !important; }
    }
    /* Mobile tweaks */
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .p-24 { padding: 16px !important; }
      .h-24 { height: 16px !important; }
    }
  </style>
</head>
<body class="bg" style="margin:0; padding:0; background:${BG}; -webkit-font-smoothing:antialiased; -ms-text-size-adjust:100%; -webkit-text-size-adjust:100%;">
  <!-- preheader (hidden) -->
  <div style="display:none; font-size:0; line-height:0; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">
    ${preheaderText}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BG};">
    <tr>
      <td align="center" style="padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px; max-width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:0 0 16px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td align="left" style="padding:0;">
                    ${logoUrl
                      ? `<img src="${logoUrl}" width="44" height="44" alt="${propertyName} logo" style="display:block; border:0; outline:none; text-decoration:none; border-radius:12px; background:${BRAND_ORANGE};" />`
                      : `<div style="display:inline-block; padding:10px 14px; background:${BRAND_ORANGE}; color:${BRAND_BLACK}; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-weight:800; border-radius:10px;">${propertyName}</div>`
                    }
                  </td>
                  <td align="right" style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:12px; color:${MUTED_TEXT};">
                    <span class="muted">Automated message</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background:${CARD_BG}; border:1px solid ${BORDER}; border-radius:14px; padding: 0;">
              <!-- Top bar accent -->
              <div class="accent" style="height:4px; width:100%; background:${BRAND_ORANGE}; border-top-left-radius:14px; border-top-right-radius:14px;"></div>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr><td class="h-24" style="height:24px; line-height:24px;">&nbsp;</td></tr>
                <tr>
                  <td class="p-24" style="padding: 0 24px;">
                    <h1 class="text" style="margin:0 0 8px 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:20px; line-height:28px; color:${BRAND_BLACK};">
                      Hello ${guestName},
                    </h1>
                    <p class="muted" style="margin:0 0 16px 0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:${MUTED_TEXT};">
                      You have a new message from <strong style="color:${BRAND_BLACK};">${propertyName}</strong>:
                    </p>

                    <!-- Message content bubble -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td class="chip" style="background:#F8F9FB; border:1px solid ${BORDER}; border-left:4px solid ${BRAND_ORANGE}; border-radius:10px; padding:16px;">
                          <div class="text" style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:${BRAND_BLACK};">
                            ${formattedContent}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <div style="height:16px; line-height:16px;">&nbsp;</div>

                    ${reservationBlock}

                    <p class="muted" style="margin:0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:${MUTED_TEXT};">
                      If you have any questions, just reply to this email and we'll help you out.
                    </p>

                    <div style="height:20px; line-height:20px;">&nbsp;</div>

                    <!-- Signature -->
                    <p class="text" style="margin:0; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:14px; line-height:22px; color:${BRAND_BLACK}; font-weight:600;">
                      The ${propertyName} Team
                    </p>
                  </td>
                </tr>
                <tr><td class="h-24" style="height:24px; line-height:24px;">&nbsp;</td></tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 4px 0; text-align:center; font-family:Arial,'Helvetica Neue',Helvetica,sans-serif; font-size:12px; line-height:18px; color:${MUTED_TEXT};">
              This message relates to your reservation with ${propertyName}. If you believe you received it in error, please contact us.
            </td>
          </tr>
          <tr><td style="height:24px; line-height:24px;">&nbsp;</td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  // Store email metadata for threading using dedicated email_metadata table
  async storeEmailMetadata(messageId, metadata) {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      
      // Store in email_metadata table using upsert
      const { error } = await supabaseAdmin
        .from('email_metadata')
        .upsert({
          message_id: messageId,
          email_message_id: metadata.email_message_id,
          email_thread_id: metadata.email_thread_id,
          email_in_reply_to: metadata.email_in_reply_to,
          email_references: metadata.email_references,
          email_name: metadata.email_name,
          email_provider_data: metadata.email_provider_data,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'message_id' 
        });

      if (error) {
        console.error('Error storing email metadata in email_metadata table:', error);
        throw error;
      }

      console.log(`Stored Resend email metadata for message ${messageId}:`, {
        email_message_id: metadata.email_message_id,
        email_thread_id: metadata.email_thread_id,
        email_in_reply_to: metadata.email_in_reply_to,
        email_references: metadata.email_references,
        provider: 'resend'
      });
    } catch (error) {
      console.error('Failed to store email metadata:', error);
      // Don't throw error to avoid breaking email sending
    }
  }
}

module.exports = new EmailService();
