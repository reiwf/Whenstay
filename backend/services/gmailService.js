const { google } = require('googleapis');
const { supabaseAdmin } = require('../config/supabase');

class GmailService {
  constructor() {
    this.gmail = null;
    this.auth = null;
    this.isPolling = false;
    this.pollInterval = null;
    this.lastHistoryId = null;
    
    // Initialize Gmail API if credentials are available
    this.initialize();
  }

  async initialize() {
    try {
      // Check if Gmail API credentials are configured
      if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
        console.warn('Gmail API credentials not configured - inbound email processing disabled');
        return;
      }

      // Set up OAuth2 client
      this.auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'urn:ietf:wg:oauth:2.0:oob' // Redirect URI for installed applications
      );

      // Set refresh token
      this.auth.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });

      console.log('Gmail API service initialized successfully');
    } catch (error) {
      console.error('Error initializing Gmail API:', error);
    }
  }

  // Start polling for new emails
  async startPolling(intervalMinutes = 1) {
    if (!this.gmail) {
      console.error('Gmail API not initialized - cannot start polling');
      return;
    }

    if (this.isPolling) {
      console.log('Gmail polling already active');
      return;
    }

    console.log(`Starting Gmail polling every ${intervalMinutes} minute(s)`);
    this.isPolling = true;

    // Get initial history ID
    await this.getInitialHistoryId();

    // Set up polling interval
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkForNewEmails();
      } catch (error) {
        console.error('Error during Gmail polling:', error);
      }
    }, intervalMinutes * 60 * 1000);

    // Do initial check
    await this.checkForNewEmails();
  }

  // Stop polling
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('Gmail polling stopped');
  }

  // Get initial history ID for incremental sync
  async getInitialHistoryId() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults: 1
      });

      if (response.data.messages && response.data.messages.length > 0) {
        const messageId = response.data.messages[0].id;
        const message = await this.gmail.users.messages.get({
          userId: 'me',
          id: messageId
        });
        this.lastHistoryId = message.data.historyId;
        console.log('Initial history ID set:', this.lastHistoryId);
      }
    } catch (error) {
      console.error('Error getting initial history ID:', error);
    }
  }

  // Check for new emails using incremental sync
  async checkForNewEmails() {
    try {
      if (!this.lastHistoryId) {
        // Fallback to checking recent messages
        await this.checkRecentMessages();
        return;
      }

      // Use history API for efficient incremental sync
      const response = await this.gmail.users.history.list({
        userId: 'me',
        startHistoryId: this.lastHistoryId
      });

      if (response.data.history) {
        for (const historyRecord of response.data.history) {
          if (historyRecord.messagesAdded) {
            for (const messageAdded of historyRecord.messagesAdded) {
              await this.processIncomingMessage(messageAdded.message.id);
            }
          }
        }
      }

      // Update history ID
      if (response.data.historyId) {
        this.lastHistoryId = response.data.historyId;
      }
    } catch (error) {
      console.error('Error checking for new emails:', error);
      // Fallback to recent messages check
      await this.checkRecentMessages();
    }
  }

  // Fallback method to check recent messages
  async checkRecentMessages() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const query = `to:chat@staylabel.com after:${Math.floor(oneHourAgo.getTime() / 1000)}`;

      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 20
      });

      if (response.data.messages) {
        for (const message of response.data.messages) {
          await this.processIncomingMessage(message.id);
        }
      }
    } catch (error) {
      console.error('Error checking recent messages:', error);
    }
  }

  // Process an incoming Gmail message
  async processIncomingMessage(gmailMessageId) {
    try {
      // Check if we've already processed this message
      const { data: existing } = await supabaseAdmin
        .from('gmail_processed_messages')
        .select('id')
        .eq('gmail_message_id', gmailMessageId)
        .single();

      if (existing) {
        return; // Already processed
      }

      // Get the full message from Gmail API
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: gmailMessageId,
        format: 'full'
      });

      const gmailMessage = response.data;

      // Parse the email
      const parsedEmail = this.parseGmailMessage(gmailMessage);
      
      // Skip if this is an outbound message (from our domain)
      if (this.isOutboundMessage(parsedEmail)) {
        console.log(`Skipping outbound message: ${gmailMessageId}`);
        return;
      }

      console.log(`Processing inbound email from: ${parsedEmail.from} - Subject: ${parsedEmail.subject}`);

      // Find or create thread using hybrid matching
      const matchResult = await this.matchEmailToThread(parsedEmail, gmailMessageId);

      // Create the message in our system
      const communicationService = require('./communicationService');
      const messageResult = await communicationService.receiveMessage({
        thread_id: matchResult.thread.id,
        channel: 'email',
        content: parsedEmail.content,
        origin_role: 'guest',
        provider_message_id: gmailMessageId,
        email_message_id: gmailMessageId,
        in_reply_to: parsedEmail.inReplyTo,
        email_references: parsedEmail.references
      });

      // Record that we've processed this message
      await supabaseAdmin
        .from('gmail_processed_messages')
        .insert({
          gmail_message_id: gmailMessageId,
          thread_id: matchResult.thread.id,
          message_id: messageResult.id
        });

      // Record matching details for analytics
      await supabaseAdmin
        .from('email_thread_matches')
        .insert({
          thread_id: matchResult.thread.id,
          gmail_message_id: gmailMessageId,
          match_method: matchResult.method,
          confidence_level: matchResult.confidence,
          match_details: matchResult.details
        });

      console.log(`Successfully processed email ${gmailMessageId} - Thread: ${matchResult.thread.id} - Confidence: ${matchResult.confidence}`);

    } catch (error) {
      console.error(`Error processing Gmail message ${gmailMessageId}:`, error);
    }
  }

  // Parse Gmail message into structured format
  parseGmailMessage(gmailMessage) {
    const headers = gmailMessage.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : null;
    };

    // Extract basic headers
    const from = getHeader('From');
    const to = getHeader('To');
    const subject = getHeader('Subject');
    const messageId = getHeader('Message-ID');
    const inReplyTo = getHeader('In-Reply-To');
    const references = getHeader('References');
    const date = getHeader('Date');

    // Parse email content
    const content = this.extractEmailContent(gmailMessage.payload);

    // Extract sender email address
    const senderEmail = this.extractEmailAddress(from);

    return {
      gmailMessageId: gmailMessage.id,
      messageId,
      from,
      to,
      senderEmail,
      subject,
      content,
      inReplyTo,
      references: references ? references.split(/\s+/) : [],
      date: date ? new Date(date) : new Date(),
      historyId: gmailMessage.historyId
    };
  }

  // Extract email address from "Name <email@domain.com>" format
  extractEmailAddress(fromHeader) {
    if (!fromHeader) return null;
    
    const match = fromHeader.match(/<([^>]+)>/);
    if (match) {
      return match[1].toLowerCase();
    }
    
    // If no angle brackets, assume the whole thing is an email
    return fromHeader.trim().toLowerCase();
  }

  // Extract email content from Gmail payload
  extractEmailContent(payload) {
    let content = '';

    if (payload.body && payload.body.data) {
      // Single part message
      content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    } else if (payload.parts) {
      // Multi-part message
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          content = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break; // Prefer plain text
        } else if (part.mimeType === 'text/html' && part.body && part.body.data && !content) {
          const htmlContent = Buffer.from(part.body.data, 'base64').toString('utf-8');
          content = this.htmlToPlainText(htmlContent);
        }
      }
    }

    // Clean up the content
    return this.cleanEmailContent(content);
  }

  // Convert HTML to plain text (basic implementation)
  htmlToPlainText(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  // Clean email content (remove signatures, previous messages, etc.)
  cleanEmailContent(content) {
    if (!content) return '';

    // Remove quoted text (lines starting with >)
    const lines = content.split('\n');
    const cleanLines = [];
    let inQuotedText = false;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip quoted lines
      if (trimmedLine.startsWith('>')) {
        inQuotedText = true;
        continue;
      }
      
      // Skip common email signature separators
      if (trimmedLine === '--' || trimmedLine.match(/^-{2,}$/)) {
        break;
      }
      
      // Skip lines that indicate forwarded/replied messages
      if (trimmedLine.match(/^(From:|Sent:|To:|Subject:|Date:)/i)) {
        break;
      }
      
      // Skip "On ... wrote:" patterns
      if (trimmedLine.match(/^On .* wrote:$/i)) {
        break;
      }
      
      // If we were in quoted text and hit a non-quoted line, we might be back to original content
      if (inQuotedText && !trimmedLine.startsWith('>') && trimmedLine.length > 0) {
        inQuotedText = false;
      }
      
      if (!inQuotedText) {
        cleanLines.push(line);
      }
    }

    return cleanLines.join('\n').trim();
  }

  // Check if this is an outbound message from our system
  isOutboundMessage(parsedEmail) {
    const fromDomain = parsedEmail.senderEmail ? parsedEmail.senderEmail.split('@')[1] : '';
    return fromDomain === 'staylabel.com' || fromDomain === 'yourhotel.com';
  }

  // Hybrid email-to-thread matching logic
  async matchEmailToThread(parsedEmail, gmailMessageId) {
    // Strategy 1: Try email headers first (highest confidence)
    if (parsedEmail.inReplyTo || parsedEmail.references.length > 0) {
      const headerMatch = await this.findThreadByEmailHeaders(parsedEmail);
      if (headerMatch) {
        return {
          thread: headerMatch,
          method: 'email_headers',
          confidence: 'high',
          details: {
            inReplyTo: parsedEmail.inReplyTo,
            references: parsedEmail.references
          }
        };
      }
    }

    // Strategy 2: Match by guest email to recent active thread
    if (parsedEmail.senderEmail) {
      const emailMatch = await this.findMostRecentActiveThread(parsedEmail.senderEmail);
      if (emailMatch) {
        return {
          thread: emailMatch,
          method: 'guest_email',
          confidence: 'medium',
          details: {
            senderEmail: parsedEmail.senderEmail,
            threadId: emailMatch.id
          }
        };
      }
    }

    // Strategy 3: Create unlinked thread for manual processing
    const unlinkedThread = await this.createUnlinkedThread(parsedEmail);
    return {
      thread: unlinkedThread,
      method: 'unlinked',
      confidence: 'low',
      details: {
        reason: 'no_match_found',
        senderEmail: parsedEmail.senderEmail,
        subject: parsedEmail.subject
      }
    };
  }

  // Find thread by email headers
  async findThreadByEmailHeaders(parsedEmail) {
    try {
      // Look for threads with matching email_message_id in the references chain
      const searchIds = [parsedEmail.inReplyTo, ...parsedEmail.references].filter(Boolean);
      
      if (searchIds.length === 0) return null;

      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select(`
          thread_id,
          message_threads!inner(*)
        `)
        .in('email_message_id', searchIds)
        .limit(1);

      if (messages && messages.length > 0) {
        return messages[0].message_threads;
      }

      return null;
    } catch (error) {
      console.error('Error finding thread by email headers:', error);
      return null;
    }
  }

  // Find most recent active thread for guest email
  async findMostRecentActiveThread(guestEmail) {
    try {
      const { data: threads } = await supabaseAdmin
        .from('message_threads')
        .select(`
          *,
          reservations!inner(
            guest_email,
            booking_email,
            check_in_date,
            check_out_date
          )
        `)
        .or(`reservations.guest_email.eq.${guestEmail},reservations.booking_email.eq.${guestEmail}`)
        .in('status', ['open', 'closed'])
        .gte('reservations.check_out_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Within last 30 days
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (threads && threads.length > 0) {
        return threads[0];
      }

      return null;
    } catch (error) {
      console.error('Error finding thread by guest email:', error);
      return null;
    }
  }

  // Create unlinked thread for unknown senders
  async createUnlinkedThread(parsedEmail) {
    try {
      const communicationService = require('./communicationService');
      
      const threadData = {
        subject: `[Unlinked] ${parsedEmail.subject || 'Email from ' + parsedEmail.senderEmail}`,
        status: 'open',
        needs_linking: true,
        participants: [
          {
            type: 'guest',
            external_address: parsedEmail.senderEmail,
            display_name: parsedEmail.from
          }
        ],
        channels: [
          {
            channel: 'email',
            external_thread_id: parsedEmail.gmailMessageId
          }
        ]
      };

      const thread = await communicationService.createThread(threadData);
      
      console.log(`Created unlinked thread ${thread.id} for unknown sender: ${parsedEmail.senderEmail}`);
      
      return thread;
    } catch (error) {
      console.error('Error creating unlinked thread:', error);
      throw error;
    }
  }

  // Get service status for debugging
  getStatus() {
    return {
      initialized: !!this.gmail,
      polling: this.isPolling,
      lastHistoryId: this.lastHistoryId,
      hasCredentials: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN)
    };
  }
}

module.exports = new GmailService();
