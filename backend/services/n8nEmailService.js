const fetch = require('node-fetch');

class N8nEmailService {
  constructor() {
    this.n8nWebhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
    this.enabled = !!process.env.N8N_EMAIL_WEBHOOK_URL;
    
    if (!this.enabled) {
      console.warn('N8N_EMAIL_WEBHOOK_URL not configured - n8n email service disabled');
    }
  }

  // Send email through n8n workflow with threading support
  async sendEmail(emailData, threadingData = {}, attachments = []) {
    try {
      if (!this.enabled) {
        throw new Error('N8N email service not configured');
      }

      // Prepare the payload for n8n webhook
      const payload = {
        to: emailData.to,
        from: emailData.from || process.env.ADMIN_EMAIL || 'chat@staylabel.com',
        subject: emailData.subject,
        htmlContent: emailData.html || emailData.htmlContent,
        textContent: emailData.text || emailData.textContent || this.htmlToText(emailData.html),
        attachments: attachments || [],
        threading: {
          messageId: threadingData.messageId || null,
          inReplyTo: threadingData.inReplyTo || null,
          references: threadingData.references || null,
          threadId: threadingData.threadId || null
        },
        trackingData: {
          reservationId: emailData.reservationId || null,
          messageId: emailData.messageId || null,
          threadId: emailData.threadId || null
        }
      };

      console.log('Sending email through n8n:', {
        to: payload.to,
        subject: payload.subject,
        hasThreading: !!(threadingData.inReplyTo || threadingData.threadId),
        attachmentCount: attachments.length,
        webhookUrl: this.n8nWebhookUrl
      });

      console.log('N8N Payload being sent:', JSON.stringify(payload, null, 2));

      // Send to n8n webhook
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Whenstay-Backend/1.0'
        },
        body: JSON.stringify(payload),
        timeout: 30000 // 30 second timeout
      });

      console.log('N8N Response status:', response.status, response.statusText);
      console.log('N8N Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`N8N webhook failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      console.log('Raw N8N response:', result);
      
      // Handle asynchronous N8N workflow response
      // If N8N returns { message: 'Workflow was started' }, it means Gmail data will come via webhook later
      const isAsyncResponse = result.message === 'Workflow was started' || !result.messageId;
      
      // Extract Gmail-specific response data that should come from the N8N workflow
      const gmailData = {
        emailMessageId: result.emailMessageId || result.gmail_message_id || result.messageId,
        emailThreadId: result.emailThreadId || result.gmail_thread_id || result.threadId,
        emailInReplyTo: result.emailInReplyTo || result.in_reply_to || result.inReplyTo || null,
        emailReferences: result.emailReferences || result.references || null,
        status: result.status || 'sent'
      };
      
      // Handle references array from N8N - convert to space-separated string for storage
      if (gmailData.emailReferences && Array.isArray(gmailData.emailReferences)) {
        gmailData.emailReferences = gmailData.emailReferences.join(' ');
      }
      
      console.log('N8N email sent successfully:', {
        messageId: result.messageId || result.id,
        gmailData: gmailData,
        isAsyncResponse: isAsyncResponse,
        fullResponse: result
      });

      // For async responses, we won't have Gmail data immediately
      // The data will need to be updated via webhook when Gmail responds
      return {
        success: true,
        messageId: result.messageId || result.id,
        threadId: gmailData.emailThreadId,
        emailMessageId: gmailData.emailMessageId,
        emailThreadId: gmailData.emailThreadId,
        emailInReplyTo: gmailData.emailInReplyTo,
        emailReferences: gmailData.emailReferences,
        status: gmailData.status,
        provider: 'n8n-email',
        isAsyncResponse: isAsyncResponse,
        fullResponse: result
      };

    } catch (error) {
      console.error('N8N email service error:', error);
      
      // Categorize error types
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error('N8N service unavailable - connection failed');
      } else if (error.message.includes('timeout')) {
        throw new Error('N8N service timeout - request took too long');
      } else if (error.message.includes('webhook failed')) {
        throw new Error(`N8N workflow error: ${error.message}`);
      } else {
        throw new Error(`N8N email service error: ${error.message}`);
      }
    }
  }

  // Send generic message email through n8n with reservation context
  async sendGenericMessage(guestEmail, guestName, subject, messageContent, reservationData = {}, messageId = null) {
    try {
      // Prepare email data
      const emailData = {
        to: guestEmail,
        subject: subject || 'Message from Staylabel',
        html: this.getGenericMessageTemplate(guestName, messageContent, reservationData),
        messageId,
        reservationId: reservationData.reservationId,
        threadId: reservationData.threadId
      };

      // Prepare threading data from reservation context
      const threadingData = {
        messageId: reservationData.emailMessageId || null,
        inReplyTo: reservationData.emailInReplyTo || null,
        references: reservationData.emailReferences || null,
        threadId: reservationData.emailThreadId || null
      };

      // Handle attachments if provided
      const attachments = reservationData.attachments || [];

      // Send through n8n
      const result = await this.sendEmail(emailData, threadingData, attachments);

      // Store email metadata for future threading with all Gmail threading data
      if (messageId && result.emailMessageId) {
        await this.storeEmailMetadata(messageId, {
          email_message_id: result.emailMessageId,
          email_thread_id: result.emailThreadId,
          email_in_reply_to: result.emailInReplyTo,
          email_references: result.emailReferences,
          n8n_response: result
        });
      }

      return result;

    } catch (error) {
      console.error('Error sending generic message through n8n:', error);
      throw error;
    }
  }

  // Generate branded message template with modern design
  getGenericMessageTemplate(guestName, messageContent, reservationData = {}) {
    const propertyName = reservationData.propertyName || 'Staylabel';
    const checkInDate = reservationData.checkInDate ? new Date(reservationData.checkInDate).toLocaleDateString() : '';
    const reservationId = reservationData.reservationId || '';
    
    // Convert plain text to HTML paragraphs
    const formattedContent = this.formatMessageContent(messageContent);
    
    // Use the new branded email template
    return this.buildBrandEmailHTML({
      propertyName,
      guestName,
      formattedContent,
      checkInDate,
      reservationId,
      logoUrl: '' // Could be configured later with process.env.BRAND_LOGO_URL
    });
  }

  // Modern branded email template with Staylabel design
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

  // Simple HTML to text conversion for fallback
  htmlToText(html) {
    if (!html) return '';
    
    return html
      // Remove style tags and their contents completely
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove script tags and their contents
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Convert block elements to line breaks
      .replace(/<\/?(div|p|h[1-6]|li|tr|td|th)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      // Remove all other HTML tags
      .replace(/<[^>]*>/g, '')
      // Convert HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple line breaks with double
      .replace(/^\s+|\s+$/g, '') // Trim start and end
      .replace(/[ \t]+/g, ' ') // Replace multiple spaces with single space
      .trim();
  }

  // Store email metadata for threading
  async storeEmailMetadata(messageId, metadata) {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      
      // Store Gmail threading data in email_metadata table using upsert
      const { error } = await supabaseAdmin
        .from('email_metadata')
        .upsert({
          message_id: messageId,
          email_message_id: metadata.email_message_id,
          email_thread_id: metadata.email_thread_id,
          email_in_reply_to: metadata.email_in_reply_to,
          email_references: metadata.email_references,
          email_name: metadata.email_name,
          email_provider_data: metadata.n8n_response,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'message_id' 
        });

      if (error) {
        console.error('Error storing email metadata in email_metadata table:', error);
        throw error;
      }

      console.log(`Stored n8n email metadata for message ${messageId}:`, {
        email_message_id: metadata.email_message_id,
        email_thread_id: metadata.email_thread_id,
        email_in_reply_to: metadata.email_in_reply_to,
        email_references: metadata.email_references,
        email_name: metadata.email_name
      });
    } catch (error) {
      console.error('Failed to store email metadata:', error);
      // Don't throw error to avoid breaking email sending
    }
  }

  // Get service status for debugging
  getServiceStatus() {
    return {
      enabled: this.enabled,
      webhookUrl: this.n8nWebhookUrl ? '[CONFIGURED]' : null,
      provider: 'n8n-email'
    };
  }

  // Test N8N webhook connectivity
  async testWebhookConnectivity() {
    try {
      if (!this.enabled) {
        return {
          success: false,
          error: 'N8N email service not configured - N8N_EMAIL_WEBHOOK_URL missing'
        };
      }

      console.log('Testing N8N webhook connectivity:', this.n8nWebhookUrl);

      // Send a simple test payload
      const testPayload = {
        test: true,
        message: 'Connectivity test from Whenstay backend',
        timestamp: new Date().toISOString()
      };

      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Whenstay-Backend/1.0'
        },
        body: JSON.stringify(testPayload),
        timeout: 10000 // 10 second timeout for test
      });

      console.log('N8N Test Response status:', response.status, response.statusText);
      
      const responseText = await response.text();
      console.log('N8N Test Response body:', responseText);

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
        webhookUrl: this.n8nWebhookUrl
      };

    } catch (error) {
      console.error('N8N webhook connectivity test failed:', error);
      return {
        success: false,
        error: error.message,
        code: error.code,
        webhookUrl: this.n8nWebhookUrl
      };
    }
  }

  // Validate email data before sending
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
    
    if (!emailData.html && !emailData.htmlContent && !emailData.text && !emailData.textContent) {
      errors.push('Email content (HTML or text) is required');
    }
    
    if (!this.enabled) {
      errors.push('N8N email service not configured');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new N8nEmailService();
