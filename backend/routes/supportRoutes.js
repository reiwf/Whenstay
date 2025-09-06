const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');

// POST /api/support/contact - Handle contact form submissions
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and message are required fields'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format'
      });
    }

    // Prepare email content
    const emailSubject = subject ? `Contact Form: ${subject}` : 'Contact Form Submission - Staylabel';
    const emailContent = `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
      <h3>Message:</h3>
      <div style="background: #f8f9fa; padding: 16px; border-left: 4px solid #2563eb; border-radius: 4px;">
        ${message.replace(/\n/g, '<br>')}
      </div>
      <hr style="margin: 20px 0;">
      <p style="font-size: 12px; color: #666;">
        This message was sent via the Staylabel support page contact form.<br>
        Time: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
      </p>
    `;

    // Send email using existing email service
    const result = await emailService.sendGenericMessage(
      'info@staylabel.com',
      'Staylabel Support Team',
      emailSubject,
      emailContent
    );

    if (result && result.success) {
      console.log('Support contact email sent successfully:', result.emailMessageId);
      
      res.json({
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon.',
        messageId: result.emailMessageId
      });
    } else {
      throw new Error('Failed to send email');
    }

  } catch (error) {
    console.error('Error handling contact form submission:', error);
    
    res.status(500).json({
      success: false,
      error: 'An error occurred while sending your message. Please try again later.'
    });
  }
});

// GET /api/support/status - Get support system status (for debugging)
router.get('/status', async (req, res) => {
  try {
    const emailStatus = emailService.getServiceStatus();
    
    res.json({
      success: true,
      status: {
        emailService: emailStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting support status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get support status'
    });
  }
});

module.exports = router;
