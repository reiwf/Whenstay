const { supabaseAdmin } = require('../config/supabase');

class CommunicationService {
  constructor() {
    this.supabase = supabaseAdmin;
  }

  // ===== THREAD MANAGEMENT =====
  
  async createThread(data) {
    const { error, data: thread } = await this.supabase
      .from('message_threads')
      .insert({
        reservation_id: data.reservation_id || null,
        subject: data.reservation_id 
          ? (data.subject || null)  // Let trigger handle it if reservation exists
          : (data.subject || 'New Conversation'), // Fallback only if no reservation
        status: 'open'
      })
      .select()
      .single();

    if (error) {
      console.error(`❌ [CREATE THREAD ERROR] Failed to create thread:`, error);
      throw error;
    }

    // Create initial participants if provided
    if (data.participants) {
      await this.addParticipants(thread.id, data.participants);
    }

    // Create channel mappings if provided
    if (data.channels) {
      await this.addThreadChannels(thread.id, data.channels);
    }

    return thread;
  }

  async getThreads(filters = {}) {
    let query = this.supabase
      .from('message_threads')
      .select(`
        *,
        thread_channels(*),
        message_participants(*)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.reservation_id) {
      query = query.eq('reservation_id', filters.reservation_id);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updateThreadStatus(threadId, status, reason = null) {
    const { error } = await this.supabase
      .from('message_threads')
      .update({ 
        status, 
        updated_at: new Date().toISOString(),
        ...(reason && { closure_reason: reason })
      })
      .eq('id', threadId);

    if (error) throw error;
    return { success: true };
  }

  async addParticipants(threadId, participants) {
    const participantRows = participants.map(p => ({
      thread_id: threadId,
      participant_type: p.type,
      user_id: p.user_id || null,
      guest_id: p.guest_id || null,
      external_address: p.external_address || null,
      display_name: p.display_name || null
    }));

    const { error } = await this.supabase
      .from('message_participants')
      .insert(participantRows);

    if (error) throw error;
  }

  async addThreadChannels(threadId, channels) {
    
    const channelRows = channels.map(c => ({
      thread_id: threadId,
      channel: c.channel,
      external_thread_id: c.external_thread_id || threadId // Use threadId as fallback if external_thread_id is null
    }));

    const { error, data } = await this.supabase
      .from('thread_channels')
      .insert(channelRows)
      .select();

    if (error) {
      console.error('Error inserting thread channels:', error);
      throw error;
    }
    return data;
  }

  // ===== MESSAGE MANAGEMENT =====

  async sendMessage(data) {
    const { thread_id, channel, content, origin_role = 'host', parent_message_id = null } = data;

    // Insert message
    const { error: msgError, data: message } = await this.supabase
      .from('messages')
      .insert({
        thread_id,
        parent_message_id,
        origin_role,
        direction: 'outgoing',
        channel,
        content
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Insert delivery record with database trigger error handling
    try {
      const { error: deliveryError } = await this.supabase
        .from('message_deliveries')
        .insert({
          message_id: message.id,
          channel,
          status: 'queued',
          queued_at: new Date().toISOString() // Manually set to bypass trigger
        });

      if (deliveryError) {
        // Handle trigger error during insert
        if (deliveryError.code === '20000' && deliveryError.message?.includes('case not found')) {
          // Insert with minimal data that won't trigger the CASE statement
          const { error: retryError } = await this.supabase
            .from('message_deliveries')
            .insert({
              message_id: message.id,
              channel,
              status: 'sent', // Use a status that works with trigger
              queued_at: new Date().toISOString(),
              sent_at: new Date().toISOString()
            });
          if (retryError) throw retryError;
        } else {
          throw deliveryError;
        }
      }
    } catch (error) {
      console.error('Error inserting delivery record:', error);
      throw error;
    }

    // Update thread last message info
    await this.updateThreadLastMessage(thread_id, content);

    // Route to appropriate channel service
    await this.routeToChannel(message.id, channel, content, data);

    return message;
  }

  async receiveMessage(data) {
    const { thread_id, channel, content, origin_role = 'guest', provider_message_id } = data;

    // Check for duplicate using provider message ID
    if (provider_message_id) {
      const { data: existing } = await this.supabase
        .from('message_deliveries')
        .select('id')
        .eq('channel', channel)
        .eq('provider_message_id', provider_message_id)
        .single();

      if (existing) {
        return { duplicate: true };
      }
    }

    // Auto-reopen thread if it's closed and receiving a new message
    await this.autoReopenClosedThread(thread_id, origin_role);

    // Process signed URLs in content before storing
    let processedContent = content;
    try {
      const imageProcessingService = require('./imageProcessingService');
      processedContent = await imageProcessingService.processMessageImages(content, `temp_${Date.now()}`);
    } catch (imageError) {
      console.error('Error processing images in message content:', imageError);
      // Continue with original content if image processing fails
    }

    // Insert message
    const { error: msgError, data: message } = await this.supabase
      .from('messages')
      .insert({
        thread_id,
        origin_role,
        direction: 'incoming',
        channel,
        content: processedContent,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // If image processing was needed and we have a real message ID now, update the processed content
    if (processedContent !== content) {
      try {
        const imageProcessingService = require('./imageProcessingService');
        const finalContent = await imageProcessingService.processMessageImages(content, message.id);
        if (finalContent !== processedContent) {
          await imageProcessingService.updateMessageContent(message.id, finalContent);
        }
      } catch (imageError) {
        console.error('Error reprocessing images with final message ID:', imageError);
        // Non-critical error, continue
      }
    }

    // Insert delivery record with database trigger error handling
    try {
      const { error: deliveryError } = await this.supabase
        .from('message_deliveries')
        .insert({
          message_id: message.id,
          channel,
          provider_message_id,
          status: 'delivered',
          delivered_at: new Date().toISOString() // Manually set to bypass trigger
        });

      if (deliveryError) {
        // Handle trigger error during insert
        if (deliveryError.code === '20000' && deliveryError.message?.includes('case not found')) {
          // Insert with minimal data that won't trigger the CASE statement
          const { error: retryError } = await this.supabase
            .from('message_deliveries')
            .insert({
              message_id: message.id,
              channel,
              provider_message_id,
              status: 'sent', // Use a status that works with trigger
              queued_at: new Date().toISOString(),
              sent_at: new Date().toISOString(),
              delivered_at: new Date().toISOString()
            });
          if (retryError) throw retryError;
        } else {
          throw deliveryError;
        }
      }
    } catch (error) {
      console.error('Error inserting delivery record for received message:', error);
      throw error;
    }

    // Update thread last message info (use processed content for preview)
    await this.updateThreadLastMessage(thread_id, processedContent);

    return message;
  }

  async getMessages(threadId, options = {}) {
    let query = this.supabase
      .from('messages')
      .select(`
        *,
        message_deliveries(*),
        message_attachments(*)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async updateThreadLastMessage(threadId, content) {
    const preview = content.length > 160 ? content.substring(0, 157) + '...' : content;
    
    const { error } = await this.supabase
      .from('message_threads')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (error) throw error;
  }

  // ===== CHANNEL ROUTING =====

  async routeToChannel(messageId, channel, content, data) {
    try {
      switch (channel) {
        case 'whatsapp':
          await this.sendWhatsApp(messageId, content, data);
          break;
        case 'email':
          await this.sendEmail(messageId, content, data);
          break;
        case 'sms':
          await this.sendSMS(messageId, content, data);
          break;
        case 'beds24':
          await this.sendBeds24(messageId, content, data);
          break;
        case 'airbnb':
          await this.sendBeds24(messageId, content, data);
          break;
        case 'booking.com':
          await this.sendBeds24(messageId, content, data);
          break;
        case 'inapp':
          await this.updateDeliveryStatus(messageId, channel, 'sent');

          setTimeout(async () => {
            await this.updateDeliveryStatus(messageId, channel, 'delivered');
          }, 1000);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
      // Update delivery status to failed and throw error for all channels
      await this.updateDeliveryStatus(messageId, channel, 'failed', error.message);
      throw error;
    }
  }

  // Placeholder channel implementations
  async sendWhatsApp(messageId, content, data) {
    // TODO: Implement WhatsApp Business API integration
    console.log('WhatsApp send:', { messageId, content });
    await this.updateDeliveryStatus(messageId, 'whatsapp', 'sent');
  }

  // Helper method to get Gmail threading context for a thread
  async getThreadGmailContext(threadId) {
    try {
      // Get the latest Gmail message data from this thread using email_metadata table
      const { data: latestGmailMessage } = await this.supabase
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
        .eq('thread_id', threadId)
        .eq('channel', 'email')
        .not('email_metadata.email_message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestGmailMessage?.email_metadata) {
        const metadata = latestGmailMessage.email_metadata;
        return {
          latestGmailMessageId: metadata.email_message_id,
          gmailThreadId: metadata.email_thread_id,
          inReplyTo: metadata.email_in_reply_to,
          references: metadata.email_references
        };
      }

      // No Gmail threading data found
      return {
        latestGmailMessageId: null,
        gmailThreadId: null,
        inReplyTo: null,
        references: null
      };

    } catch (error) {
      console.error('Error getting Gmail threading context:', error);
      return {
        latestGmailMessageId: null,
        gmailThreadId: null,
        inReplyTo: null,
        references: null
      };
    }
  }

  async sendEmail(messageId, content, data) {
    try {
      console.log('Sending email via n8n with HTML template:', { messageId, content });

      // FIXED: Use resilient separate queries instead of complex inner joins
      // Step 1: Get the basic message data
      const { data: message, error: msgError } = await this.supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();

      if (msgError || !message) {
        throw new Error('Message not found');
      }

      // Step 2: Get thread information (fixed column names)
      const { data: thread, error: threadError } = await this.supabase
        .from('message_threads')
        .select(`
          id,
          reservation_id,
          subject,
          reservations(
            id,
            booking_name,
            booking_lastname,
            booking_email,
            check_in_date,
            check_out_date,
            properties(name)
          )
        `)
        .eq('id', message.thread_id)
        .single();

      if (threadError) {
        throw new Error(`Thread not found for message ${messageId}: ${threadError.message}`);
      }

      // Step 3: Get channel mapping (use left join, don't fail if missing)
      const { data: emailChannels } = await this.supabase
        .from('thread_channels')
        .select('channel, external_thread_id')
        .eq('thread_id', thread.id)
        .eq('channel', 'email');

      // Step 4: Get Gmail threading context
      const gmailContext = await this.getThreadGmailContext(thread.id);
      console.log('Gmail threading context:', gmailContext);

      // Get Gmail threadId from channel mapping (may be null for new conversations)
      const emailChannel = emailChannels?.find(tc => tc.channel === 'email');
      const externalThreadId = emailChannel?.external_thread_id;
      
      // Use Gmail threading context or fallback to external thread ID
      const gmailThreadId = gmailContext.gmailThreadId || externalThreadId;

      // ENHANCEMENT: If no email channel mapping exists, create one for future use
      if (!emailChannel && gmailContext.gmailThreadId) {
        try {
          console.log(`Creating missing email channel mapping for thread ${thread.id} with Gmail threadId ${gmailContext.gmailThreadId}`);
          await this.addThreadChannels(thread.id, [{
            channel: 'email',
            external_thread_id: gmailContext.gmailThreadId
          }]);
        } catch (channelError) {
          console.warn('Could not create email channel mapping (non-critical):', channelError.message);
          // Continue - this is not critical for sending emails
        }
      }

      // Determine recipient email and name
      let recipientEmail, recipientName;
      
      if (thread.reservations) {
        // Thread linked to reservation - use booking_email
        const reservation = thread.reservations;
        recipientName = reservation.booking_lastname 
          ? `${reservation.booking_name} ${reservation.booking_lastname}`
          : reservation.booking_name || 'Guest';
        recipientEmail = reservation.booking_email;
      } else {
        // Standalone thread - get recipient from participants
        const { data: participant } = await this.supabase
          .from('message_participants')
          .select('external_address, display_name')
          .eq('thread_id', thread.id)
          .eq('participant_type', 'guest')
          .single();
        
        if (participant) {
          recipientEmail = participant.external_address;
          recipientName = participant.display_name || participant.external_address;
        }
      }

      // ENHANCEMENT: If no recipient found, try to get it from thread participants
      if (!recipientEmail) {
        const { data: guestParticipant } = await this.supabase
          .from('message_participants')
          .select('external_address, display_name')
          .eq('thread_id', thread.id)
          .eq('participant_type', 'guest')
          .not('external_address', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (guestParticipant?.external_address) {
          recipientEmail = guestParticipant.external_address;
          recipientName = guestParticipant.display_name || recipientEmail;
          console.log(`Using email from thread participants: ${recipientEmail}`);
        }
      }
      
      if (!recipientEmail) {
        throw new Error('No recipient email found for this thread');
      }

      // Prepare Gmail threading headers using the retrieved context
      const threadingHeaders = {};
      if (gmailContext.latestGmailMessageId) {
        threadingHeaders['In-Reply-To'] = gmailContext.latestGmailMessageId;
        
        // Build References header from existing references chain
        const references = [];
        if (gmailContext.references) {
          references.push(gmailContext.references);
        }
        references.push(gmailContext.latestGmailMessageId);
        threadingHeaders['References'] = references.join(' ');
      }

      // Prepare reservation data for HTML template
      const reservationData = thread.reservations ? {
        reservationId: thread.reservations.id,
        propertyName: thread.reservations.properties?.name || 'Staylabel',
        checkInDate: thread.reservations.check_in_date,
        checkOutDate: thread.reservations.check_out_date
      } : {};

      // Use n8nEmailService with HTML template functionality
      const n8nEmailService = require('./n8nEmailService');
      
      // Prepare threading data for Gmail threading
      const threadingData = {
        messageId: gmailContext.latestGmailMessageId,
        inReplyTo: gmailContext.latestGmailMessageId,
        references: gmailContext.references,
        threadId: gmailThreadId
      };

      console.log('Sending HTML templated email via n8nEmailService:', {
        to: recipientEmail,
        threadId: gmailThreadId,
        hasThreadingData: Object.keys(threadingData).length > 0,
        hasReservationData: Object.keys(reservationData).length > 0
      });

      // Send using n8nEmailService with HTML template
      const result = await n8nEmailService.sendGenericMessage(
        recipientEmail,
        recipientName,
        `Re: ${thread.subject || 'Message from Staylabel'}`,
        content,
        {
          ...reservationData,
          threadId: message.thread_id,
          emailThreadId: gmailThreadId,
          emailInReplyTo: gmailContext.latestGmailMessageId,
          emailReferences: gmailContext.references
        },
        messageId
      );

      console.log('N8N email service response:', result);

      // Update delivery status to sent
      await this.updateDeliveryStatus(messageId, 'email', 'sent');

      console.log(`Successfully sent email ${messageId} to ${recipientEmail} via n8n`);

    } catch (error) {
      console.error('Error sending email via n8n:', error);
      
      // Categorize the error type for appropriate handling
      const isConfigError = error.message?.includes('N8N_EMAIL_WEBHOOK_URL not configured');
      const isEmailError = error.message?.includes('No recipient email found');
      const isDataError = error.message?.includes('Message not found');
      const isWebhookError = error.message?.includes('N8N webhook failed');

      // Handle different error types appropriately
      if (isConfigError) {
        await this.updateDeliveryStatus(messageId, 'email', 'failed', `Configuration error: ${error.message}`);
        throw error;
      } else if (isEmailError) {
        await this.updateDeliveryStatus(messageId, 'email', 'failed', `Email address missing: ${error.message}`);
        throw error;
      } else if (isDataError) {
        await this.updateDeliveryStatus(messageId, 'email', 'failed', error.message);
        throw error;
      } else if (isWebhookError) {
        await this.updateDeliveryStatus(messageId, 'email', 'failed', `Webhook error: ${error.message}`);
        throw error;
      } else {
        await this.updateDeliveryStatus(messageId, 'email', 'failed', `Unknown error: ${error.message}`);
        throw error;
      }
    }
  }

  async sendSMS(messageId, content, data) {
    // TODO: Implement SMS service integration
    console.log('SMS send:', { messageId, content });
    await this.updateDeliveryStatus(messageId, 'sms', 'sent');
  }

  async sendBeds24(messageId, content, data) {
    try {
      console.log('Sending message via Beds24 (supports Airbnb, Booking.com, and Beds24):', { messageId, content });

      // Get the message and thread information to find the booking ID
      const { data: message, error: msgError } = await this.supabase
        .from('messages')
        .select(`
          *,
          message_threads!inner(
            reservation_id,
            reservations!inner(beds24_booking_id)
          )
        `)
        .eq('id', messageId)
        .single();

      if (msgError || !message) {
        throw new Error('Message not found');
      }

      const beds24BookingId = message.message_threads.reservations?.beds24_booking_id;
      if (!beds24BookingId) {
        throw new Error('No Beds24 booking ID found for this message thread');
      }

      // Use Beds24 service to send the message
      const beds24Service = require('./beds24Service');
      await beds24Service.sendMessage(beds24BookingId, content, {
        messageId,
        threadId: message.thread_id
      });

      // Update delivery status to sent - use the actual channel from the message
      await this.updateDeliveryStatus(messageId, message.channel, 'sent');

      console.log(`Successfully sent message ${messageId} via Beds24 for booking ${beds24BookingId}`);

    } catch (error) {
      console.error('Error sending message via Beds24:', error);
      
      // Categorize the error type to determine appropriate handling
      const isSystemError = error.message?.includes('Message not found') || 
                           error.message?.includes('No Beds24 booking ID found');
      const isAuthError = error.message?.includes('Not authorized') || 
                         error.message?.includes('token') || 
                         error.message?.includes('401') || 
                         error.message?.includes('403');
      const isNotFoundError = error.message?.includes('Booking not found');
      const isRateLimited = error.message?.includes('Rate limit exceeded') || 
                           error.message?.includes('429');
      const isServerError = error.message?.includes('500') || 
                           error.message?.includes('502') || 
                           error.message?.includes('503') || 
                           error.message?.includes('504');

      // Handle different error types appropriately
      if (isSystemError) {
        // System/data errors: fail immediately, don't retry
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', error.message);
        throw error;
      } else if (isAuthError) {
        // Authentication errors: fail but could potentially be retried after token refresh
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', `Authentication error: ${error.message}`);
        throw error;
      } else if (isNotFoundError) {
        // Booking not found: fail, this booking may not exist in Beds24
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', `Booking not found in Beds24: ${error.message}`);
        throw error;
      } else if (isRateLimited) {
        // Rate limiting: mark as failed but could be retried later
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', `Rate limited: ${error.message}`);
        throw error;
      } else if (isServerError) {
        // Server errors (5xx): These are temporary external service issues
        console.log('Beds24 API server error detected - this is a temporary external service issue');
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', `Beds24 server error (temporary): ${error.message}`);
        // Still throw error - don't hide server errors by marking as sent
        throw new Error(`Beds24 server temporarily unavailable: ${error.message}`);
      } else {
        // Unknown errors: fail safely
        await this.updateDeliveryStatus(messageId, data.channel || 'beds24', 'failed', `Unknown error: ${error.message}`);
        throw error;
      }
    }
  }


  async updateDeliveryStatus(messageId, channel, status, errorMessage = null) {
    try {
      const updateData = { status };

      // Set the appropriate timestamp field based on status
      switch (status) {
        case 'queued':
          updateData.queued_at = new Date().toISOString();
          break;
        case 'sent':
          updateData.sent_at = new Date().toISOString();
          break;
        case 'delivered':
          updateData.delivered_at = new Date().toISOString();
          break;
        case 'read':
          updateData.read_at = new Date().toISOString();
          break;
        case 'failed':
          // WORKAROUND: For failed status, manually set all timestamp fields to avoid trigger issues
          // This prevents the database trigger from encountering the 'failed' status in the CASE statement
          updateData.updated_at = new Date().toISOString();
          // Get current record to preserve existing timestamps
          const { data: currentRecord } = await this.supabase
            .from('message_deliveries')
            .select('queued_at, sent_at, delivered_at, read_at')
            .eq('message_id', messageId)
            .eq('channel', channel)
            .single();
          
          if (currentRecord) {
            // Preserve existing timestamps
            if (currentRecord.queued_at) updateData.queued_at = currentRecord.queued_at;
            if (currentRecord.sent_at) updateData.sent_at = currentRecord.sent_at;
            if (currentRecord.delivered_at) updateData.delivered_at = currentRecord.delivered_at;
            if (currentRecord.read_at) updateData.read_at = currentRecord.read_at;
          }
          break;
        default:
          console.warn(`Unknown delivery status: ${status}`);
          updateData.updated_at = new Date().toISOString();
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await this.supabase
        .from('message_deliveries')
        .update(updateData)
        .eq('message_id', messageId)
        .eq('channel', channel);

      if (error) {
        console.error('Database update error:', error);
        // If we still get a trigger error, try a direct update with minimal data
        if (error.code === '20000' && error.message?.includes('case not found')) {
          console.log('Attempting workaround for trigger error...');
          const minimalUpdate = { 
            status: 'sent', // Use a status that works with the trigger
            error_message: `Original status: ${status}. ${errorMessage || ''}`,
            updated_at: new Date().toISOString()
          };
          
          const { error: retryError } = await this.supabase
            .from('message_deliveries')
            .update(minimalUpdate)
            .eq('message_id', messageId)
            .eq('channel', channel);
            
          if (retryError) throw retryError;
          return; // Success with workaround
        }
        throw error;
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      throw error;
    }
  }

  // ===== READ STATUS MANAGEMENT =====

  async markMessageAsRead(messageId, channel = 'inapp') {
    try {
      // Update delivery status to 'read' with timestamp
      await this.updateDeliveryStatus(messageId, channel, 'read');
      
      // Get the message to trigger real-time updates if needed
      const { data: message } = await this.supabase
        .from('messages')
        .select('thread_id, content')
        .eq('id', messageId)
        .single();

      if (message) {
        // Optionally trigger real-time notification for read status
        await this.notifyDeliveryStatusChange(message.thread_id, messageId, 'read');
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  async markThreadMessagesAsRead(threadId, beforeMessageId = null) {
    try {
      // Get all unread messages in the thread
      let query = this.supabase
        .from('messages')
        .select(`
          id,
          message_deliveries!inner(status)
        `)
        .eq('thread_id', threadId)
        .eq('direction', 'incoming')
        .neq('message_deliveries.status', 'read');

      if (beforeMessageId) {
        query = query.lte('created_at', (
          await this.supabase
            .from('messages')
            .select('created_at')
            .eq('id', beforeMessageId)
            .single()
        ).data.created_at);
      }

      const { data: messages, error } = await query;
      if (error) throw error;

      // Mark each message as read
      const markReadPromises = messages.map(msg => 
        this.markMessageAsRead(msg.id, 'inapp')
      );

      await Promise.all(markReadPromises);

      return { success: true, marked_count: messages.length };
    } catch (error) {
      console.error('Error marking thread messages as read:', error);
      throw error;
    }
  }

  async notifyDeliveryStatusChange(threadId, messageId, status) {
    // Trigger real-time notification for delivery status change
    const { error } = await this.supabase
      .channel(`thread-${threadId}`)
      .send({
        type: 'broadcast',
        event: 'delivery_status_change',
        payload: { messageId, status, timestamp: new Date().toISOString() }
      });

    if (error) console.error('Real-time delivery status notification error:', error);
  }

  // ===== TEMPLATE MANAGEMENT =====

  async getTemplates(filters = {}) {
    let query = this.supabase
      .from('message_templates')
      .select('*')
      .order('name');

    if (filters.channel) {
      query = query.eq('channel', filters.channel);
    }

    if (filters.language) {
      query = query.eq('language', filters.language);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async renderTemplate(templateId, variables = {}) {
    const { data: template, error } = await this.supabase
      .from('message_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) throw error;

    // Simple template variable substitution
    let rendered = template.content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, value || '');
    }

    return {
      ...template,
      rendered_content: rendered
    };
  }

  // ===== SCHEDULED MESSAGES =====

  async scheduleMessage(data) {
    const { thread_id, template_id, channel, run_at, payload = {}, created_by } = data;

    const { error, data: scheduled } = await this.supabase
      .from('scheduled_messages')
      .insert({
        thread_id,
        template_id,
        channel,
        run_at,
        payload,
        status: 'queued',
        created_by
      })
      .select()
      .single();

    if (error) throw error;
    return scheduled;
  }

  async getDueScheduledMessages(limit = 50) {
    const { data, error } = await this.supabase
      .from('scheduled_messages')
      .select(`
        *,
        message_templates(*),
        message_threads(*)
      `)
      .eq('status', 'queued')
      .lte('run_at', new Date().toISOString())
      .order('run_at')
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async processScheduledMessage(scheduledId) {
    const { data: scheduled, error: fetchError } = await this.supabase
      .from('scheduled_messages')
      .select(`
        *,
        message_templates(*),
        message_threads(*)
      `)
      .eq('id', scheduledId)
      .single();

    if (fetchError) throw fetchError;

    try {
      // Render template with payload variables
      const rendered = await this.renderTemplate(scheduled.template_id, scheduled.payload);

      // Send the message
      const message = await this.sendMessage({
        thread_id: scheduled.thread_id,
        channel: scheduled.channel,
        content: rendered.rendered_content,
        origin_role: 'system'
      });

      // Mark scheduled message as sent
      await this.supabase
        .from('scheduled_messages')
        .update({ status: 'sent' })
        .eq('id', scheduledId);

      return message;
    } catch (error) {
      // Mark as failed
      await this.supabase
        .from('scheduled_messages')
        .update({ 
          status: 'failed',
          last_error: error.message 
        })
        .eq('id', scheduledId);

      throw error;
    }
  }

  // ===== UNSEND MESSAGE =====

  async unsendMessage(messageId, userId) {
    try {
      // Get message details before unsending
      const { data: message, error: msgError } = await this.supabase
        .from('messages')
        .select(`
          id,
          thread_id,
          content,
          created_at,
          is_unsent,
          origin_role,
          channel
        `)
        .eq('id', messageId)
        .single();

      if (msgError || !message) {
        throw new Error('Message not found');
      }

      if (message.is_unsent) {
        throw new Error('Message is already unsent');
      }

      // Check if this is a guest user (fake user ID)
      const isGuestUser = userId.startsWith('guest_');

      if (isGuestUser) {
        // For guest users, do manual validation
        
        // Only allow guests to unsend their own messages
        if (message.origin_role !== 'guest') {
          throw new Error('You can only unsend your own messages');
        }

        // Only allow in-app messages
        if (message.channel !== 'inapp') {
          throw new Error('You can only unsend in-app messages');
        }

        // Check 24 hour time limit
        const messageTime = new Date(message.created_at);
        const now = new Date();
        const hoursDifference = (now - messageTime) / (1000 * 60 * 60);
        
        if (hoursDifference >= 24) {
          throw new Error('You can only unsend messages within 24 hours');
        }
      } else {
        // For admin/host users, use database function if it exists
        try {
          const { data: canUnsend, error: checkError } = await this.supabase
            .rpc('can_unsend_message', {
              message_id: messageId,
              user_id: userId
            });

          if (checkError) {
            console.error('Error checking unsend permission:', checkError);
            throw new Error('Failed to verify unsend permissions');
          }

          if (!canUnsend) {
            throw new Error('Message cannot be unsent - either too old, wrong channel, already unsent, or insufficient permissions');
          }
        } catch (error) {
          // If database function doesn't exist, fall back to basic checks
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            console.warn('can_unsend_message function not found, falling back to basic checks');
            
            // Basic validation for admin users
            const messageTime = new Date(message.created_at);
            const now = new Date();
            const hoursDifference = (now - messageTime) / (1000 * 60 * 60);
            
            if (hoursDifference >= 24) {
              throw new Error('Message cannot be unsent after 24 hours');
            }
            
            if (message.channel !== 'inapp') {
              throw new Error('Only in-app messages can be unsent');
            }
          } else {
            throw error;
          }
        }
      }

      // Mark message as unsent
      // For guest users, extract the reservation UUID from the guest_<uuid> format
      const unsentBy = isGuestUser ? userId.replace('guest_', '') : userId;
      
      const { error: updateError } = await this.supabase
        .from('messages')
        .update({
          is_unsent: true,
          unsent_at: new Date().toISOString(),
          unsent_by: unsentBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('Error updating message unsent status:', updateError);
        throw new Error('Failed to unsend message');
      }

      // Update thread last message info if this was the latest message
      await this.updateThreadLastMessageAfterUnsend(message.thread_id);

      // Notify real-time subscribers about the unsent message
      await this.notifyMessageUnsent(message.thread_id, messageId);

      return {
        success: true,
        messageId,
        threadId: message.thread_id,
        unsentAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error in unsendMessage:', error);
      throw error;
    }
  }

  async updateThreadLastMessageAfterUnsend(threadId) {
    try {
      // Get the most recent non-unsent message in the thread
      const { data: lastMessage, error } = await this.supabase
        .from('messages')
        .select('content, created_at')
        .eq('thread_id', threadId)
        .eq('is_unsent', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error getting last message after unsend:', error);
        return;
      }

      if (lastMessage) {
        // Update thread with last non-unsent message
        const preview = lastMessage.content.length > 160 
          ? lastMessage.content.substring(0, 157) + '...' 
          : lastMessage.content;

        await this.supabase
          .from('message_threads')
          .update({
            last_message_at: lastMessage.created_at,
            last_message_preview: preview,
            updated_at: new Date().toISOString()
          })
          .eq('id', threadId);
      } else {
        // No messages left in thread, clear last message info
        await this.supabase
          .from('message_threads')
          .update({
            last_message_at: null,
            last_message_preview: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', threadId);
      }
    } catch (error) {
      console.error('Error updating thread after unsend:', error);
      // Non-critical error, don't throw
    }
  }

  async notifyMessageUnsent(threadId, messageId) {
    try {
      // Trigger real-time notification for unsent message
      // Use the same channel name format as the frontend subscription: messages_thread_${threadId}
      const { error } = await this.supabase
        .channel(`messages_thread_${threadId}`)
        .send({
          type: 'broadcast',
          event: 'message_unsent',
          payload: { 
            messageId, 
            threadId,
            timestamp: new Date().toISOString() 
          }
        });

      if (error) console.error('Real-time unsend notification error:', error);
    } catch (error) {
      console.error('Error in notifyMessageUnsent:', error);
      // Non-critical error, don't throw
    }
  }

  // ===== REAL-TIME EVENTS =====

  async notifyNewMessage(threadId, message) {
    // Trigger real-time notification
    const { error } = await this.supabase
      .channel(`thread-${threadId}`)
      .send({
        type: 'broadcast',
        event: 'new_message',
        payload: { message }
      });

    if (error) console.error('Real-time notification error:', error);
  }

  // ===== GROUP BOOKING METHODS =====

  async getGroupBookingInfo(reservationId) {
    try {
      // Get reservation details to check if it's part of a group booking
      const { data: reservation, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          booking_group_master_id,
          is_group_master,
          group_room_count,
          booking_group_ids,
          booking_name,
          check_in_date,
          check_out_date,
          beds24_booking_id
        `)
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        console.warn(`Reservation ${reservationId} not found for group booking info`);
        return { isGroupBooking: false };
      }

      // Check if this is a group booking
      const isGroupBooking = reservation.is_group_master || !!reservation.booking_group_master_id;
      
      if (!isGroupBooking) {
        return { isGroupBooking: false };
      }

      let masterReservationId;

      if (reservation.is_group_master) {
        // This reservation is the master
        masterReservationId = reservation.id;
      } else {
        // This reservation is a child - need to find the master reservation by Beds24 booking ID
        const masterBeds24Id = reservation.booking_group_master_id;
        
        // Find the master reservation using the Beds24 booking ID
        const { data: masterReservation, error: masterError } = await this.supabase
          .from('reservations')
          .select('id')
          .eq('beds24_booking_id', masterBeds24Id)
          .eq('is_group_master', true)
          .single();

        if (masterError || !masterReservation) {
          console.error(`❌ [GROUP INFO] Master reservation not found for Beds24 ID: ${masterBeds24Id}`, masterError);
          return { isGroupBooking: false };
        }

        masterReservationId = masterReservation.id;
      }

      // Get all reservations in the group using the master reservation ID and Beds24 master ID
      const masterBeds24Id = reservation.is_group_master 
        ? reservation.beds24_booking_id 
        : reservation.booking_group_master_id;

      const { data: groupReservations } = await this.supabase
        .from('reservations')
        .select(`
          id,
          booking_name,
          check_in_date,
          check_out_date,
          is_group_master,
          beds24_booking_id,
          room_types(name),
          room_units(unit_number)
        `)
        .or(`id.eq.${masterReservationId},booking_group_master_id.eq.${masterBeds24Id}`)
        .order('is_group_master', { ascending: false })
        .order('created_at', { ascending: true });

      const result = {
        isGroupBooking: true,
        isMaster: reservation.is_group_master,
        masterReservationId, // This is now guaranteed to be a proper UUID
        totalRooms: reservation.group_room_count || groupReservations?.length || 1,
        groupReservations: groupReservations || []
      };
      return result;
    } catch (error) {
      console.error('❌ [GROUP INFO] Error getting group booking info:', error);
      return { isGroupBooking: false };
    }
  }

  async findGroupBookingThread(reservationId) {
    try {
     
      // Get reservation details to check if it's part of a group booking
      const { data: reservation } = await this.supabase
        .from('reservations')
        .select('booking_group_master_id, is_group_master, beds24_booking_id')
        .eq('id', reservationId)
        .single();

      if (!reservation) {
        return null;
      }
      // Check if this is a group booking
      const isGroupBooking = reservation.is_group_master || !!reservation.booking_group_master_id;
      
      if (!isGroupBooking) {
        return null;
      }

      // FIXED LOGIC: Use the Beds24 booking master ID to find the master reservation first,
      // then get all reservations in the group using internal reservation IDs
      let masterBeds24BookingId;
      let masterReservationId;

      if (reservation.is_group_master) {
        // This reservation is the master
        masterBeds24BookingId = reservation.beds24_booking_id;
        masterReservationId = reservationId;
      } else {
        // This reservation is a child, find the master reservation
        masterBeds24BookingId = reservation.booking_group_master_id;
        
        // Find the master reservation by its Beds24 booking ID
        const { data: masterReservation } = await this.supabase
          .from('reservations')
          .select('id')
          .eq('beds24_booking_id', masterBeds24BookingId)
          .eq('is_group_master', true)
          .single();

        if (!masterReservation) {
          return null;
        }

        masterReservationId = masterReservation.id;
      }

      // Find all reservations that belong to this group booking using the master reservation ID
      const { data: groupReservations, error: groupError } = await this.supabase
        .from('reservations')
        .select('id, beds24_booking_id, is_group_master')
        .or(`id.eq.${masterReservationId},booking_group_master_id.eq.${masterBeds24BookingId}`);

      if (groupError) {
        console.error(`❌ Error finding group reservations:`, groupError);
        return null;
      }

      if (!groupReservations || groupReservations.length === 0) {
        return null;
      }

      const reservationIds = groupReservations.map(r => r.id);

      // Look for existing threads for any reservation in the group
      const { data: existingThreads, error: threadError } = await this.supabase
        .from('message_threads')
        .select(`
          *,
          thread_channels(channel, external_thread_id)
        `)
        .in('reservation_id', reservationIds)
        .order('created_at', { ascending: false });

      if (threadError) {
        console.error(`❌ Error finding existing threads:`, threadError);
        return null;
      }

      if (existingThreads && existingThreads.length > 0) {
        const existingThread = existingThreads[0]; // Get the most recent thread

        // If there are multiple threads, we need to merge them (this is the fix for existing duplicate threads)
        if (existingThreads.length > 1) {
          console.warn(`⚠️  Found ${existingThreads.length} threads for group booking ${masterReservationId}. This indicates duplicate threads were created.`);
          console.warn(`   All threads:`, existingThreads.map(t => ({
            id: t.id,
            reservation_id: t.reservation_id,
            created_at: t.created_at
          })));
        }

        return existingThread;
      }

      return null;
    } catch (error) {
      console.error('❌ Error finding group booking thread:', error);
      return null;
    }
  }

  async generateGroupAwareSubject(reservationId) {
    try {
      const { data: reservation } = await this.supabase
        .from('reservations')
        .select(`
          booking_name,
          booking_email,
          check_in_date,
          check_out_date,
          is_group_master,
          group_room_count,
          properties(name)
        `)
        .eq('id', reservationId)
        .single();

      if (!reservation) {
        return null; // Let database trigger handle it
      }

      const propertyName = reservation.properties?.name || 'Property';
      const guestName = reservation.booking_name || 'Guest';
      const checkIn = reservation.check_in_date;
      
      if (reservation.is_group_master && reservation.group_room_count > 1) {
        return `${guestName} - Group Booking (${reservation.group_room_count} rooms) - ${propertyName} - ${checkIn}`;
      } else if (reservation.is_group_master) {
        return `${guestName} - Group Booking - ${propertyName} - ${checkIn}`;
      } else {
        return null; // Let database trigger handle single bookings
      }
    } catch (error) {
      console.error('Error generating group-aware subject:', error);
      return null; // Fallback to database trigger
    }
  }

  async sendGroupMessage(data) {
    const { reservation_id, channel, content, origin_role = 'host', parent_message_id = null } = data;

    try {
      // Get group booking information
      const reservationService = require('./reservationService');
      const isGroupBooking = await reservationService.isGroupBooking(reservation_id);

      if (!isGroupBooking) {
        // Not a group booking, use regular sendMessage
        const thread = await this.findOrCreateThreadByReservation(reservation_id);
        return await this.sendMessage({
          thread_id: thread.id,
          channel,
          content,
          origin_role,
          parent_message_id
        });
      }

      // For group bookings, send to the unified group thread
      const thread = await this.findOrCreateThreadByReservation(reservation_id);
      
      // Send the message to the unified thread
      const message = await this.sendMessage({
        thread_id: thread.id,
        channel,
        content,
        origin_role,
        parent_message_id
      });

      return message;

    } catch (error) {
      console.error('Error sending group message:', error);
      throw error;
    }
  }

  async getGroupBookingThreads(masterReservationId) {
    try {
      // Get all reservations in the group
      const reservationService = require('./reservationService');
      const groupReservations = await reservationService.getGroupBookingReservations(masterReservationId);

      if (!groupReservations || groupReservations.length === 0) {
        return [];
      }

      const reservationIds = groupReservations.map(r => r.id);

      // Get all threads for reservations in this group
      const { data: threads, error } = await this.supabase
        .from('message_threads')
        .select(`
          *,
          thread_channels(*),
          message_participants(*)
        `)
        .in('reservation_id', reservationIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return threads || [];
    } catch (error) {
      console.error('Error getting group booking threads:', error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  // Auto-reopen closed threads when new messages arrive
  async autoReopenClosedThread(threadId, originRole = 'guest') {
    try {
      // Get current thread status
      const { data: thread, error } = await this.supabase
        .from('message_threads')
        .select('status')
        .eq('id', threadId)
        .single();

      if (error) {
        console.error('Error getting thread status for auto-reopen:', error);
        return;
      }

      // Only reopen if thread is closed (not archived)
      if (thread.status === 'closed') {
        
        const { error: updateError } = await this.supabase
          .from('message_threads')
          .update({ 
            status: 'open',
            updated_at: new Date().toISOString()
          })
          .eq('id', threadId);

        if (updateError) {
          console.error('Error auto-reopening closed thread:', updateError);
        } else {         
        }
      }
    } catch (error) {
      console.error('Error in autoReopenClosedThread:', error);
      // Don't throw error - this is a non-critical operation
    }
  }

  // Find recent outbound message that matches webhook echo
  async findRecentOutboundMessage(threadId, content, webhookTime, timeWindowMinutes = 10) {
    try {
      const timeWindow = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
      
      const { data: messages, error } = await this.supabase
        .from('messages')
        .select(`
          *,
          message_deliveries(*)
        `)
        .eq('thread_id', threadId)
        .eq('direction', 'outgoing')
        .eq('origin_role', 'host')
        .eq('content', content)
        .gte('created_at', timeWindow.toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error finding recent outbound message:', error);
        return null;
      }

      if (messages && messages.length > 0) {
        const message = messages[0];
        // Check if any delivery record doesn't already have provider_message_id
        const deliveryWithoutProvider = message.message_deliveries?.find(d => !d.provider_message_id);
        if (deliveryWithoutProvider) {
          return message;
        }
      }

      return null;
    } catch (error) {
      console.error('Error in findRecentOutboundMessage:', error);
      return null;
    }
  }

  // Update delivery record with provider message ID from webhook echo
  async updateDeliveryProviderMessageId(messageId, channel, providerMessageId) {
    try {
      const { error } = await this.supabase
        .from('message_deliveries')
        .update({
          provider_message_id: providerMessageId,
          updated_at: new Date().toISOString()
        })
        .eq('message_id', messageId)
        .eq('channel', channel);

      if (error) {
        console.error('Error updating delivery provider message ID:', error);
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('Error in updateDeliveryProviderMessageId:', error);
      throw error;
    }
  }

  async findOrCreateThreadByReservation(reservationId, initialData = {}) {    
    // If this reservation is part of a group, look for existing threads for other reservations in the same group
    const groupThread = await this.findGroupBookingThread(reservationId);
    if (groupThread) {
      
      // Auto-reopen if needed
      if (groupThread.status !== 'open') {
        await this.updateThreadStatus(groupThread.id, 'open');
        groupThread.status = 'open';
      }
      
      // Add channel mappings if needed
      if (initialData.channels && Array.isArray(initialData.channels)) {
        for (const channelData of initialData.channels) {
          const existingChannelMapping = groupThread.thread_channels?.find(
            tc => tc.channel === channelData.channel && tc.external_thread_id === channelData.external_thread_id
          );
          
          if (!existingChannelMapping) {
            try {
              await this.addThreadChannels(groupThread.id, [channelData]);
            } catch (error) {
              if (error.code === 'error map') {
              } else {
                throw error;
              }
            }
          }
        }
      }      
      return groupThread;
    }
      
    // SECOND: Try to find thread by reservation_id with any status (not just 'open')
    const { data: existingByReservation } = await this.supabase
      .from('message_threads')
      .select(`
        *,
        thread_channels(channel, external_thread_id)
      `)
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingByReservation) {
      
      // If thread is closed/archived but we're getting new messages, auto-reopen it
      if (existingByReservation.status !== 'open') {
        await this.updateThreadStatus(existingByReservation.id, 'open');
        existingByReservation.status = 'open';
      }
      
      // Check if we need to add channel mappings
      if (initialData.channels && Array.isArray(initialData.channels)) {
        for (const channelData of initialData.channels) {
          const existingChannelMapping = existingByReservation.thread_channels?.find(
            tc => tc.channel === channelData.channel && tc.external_thread_id === channelData.external_thread_id
          );
          
          if (!existingChannelMapping) {
            try {
              await this.addThreadChannels(existingByReservation.id, [channelData]);
            } catch (error) {
              console.error(`Error adding channel mapping: ${error.message}`);
              // If it's a unique constraint violation, the mapping may have been added by another process
              if (error.code === 'error map') {
              } else {
                throw error;
              }
            }
          } else {
          }
        }
      }
      
      return existingByReservation;
    }

    // This handles cases where the same external conversation spans multiple reservations
    if (initialData.channels && Array.isArray(initialData.channels)) {
      for (const channelData of initialData.channels) {
        const { data: existingChannelThread } = await this.supabase
          .from('thread_channels')
          .select(`
            *,
            message_threads(*)
          `)
          .eq('channel', channelData.channel)
          .eq('external_thread_id', channelData.external_thread_id)
          .maybeSingle();

        if (existingChannelThread?.message_threads) {

          
          // Update the thread to associate with this reservation if it's not already
          if (existingChannelThread.message_threads.reservation_id !== reservationId) {
            const { error: updateError } = await this.supabase
              .from('message_threads')
              .update({ 
                reservation_id: reservationId,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingChannelThread.message_threads.id);

            if (updateError) {
              console.error('Error updating thread reservation_id:', updateError);
            } else {
              existingChannelThread.message_threads.reservation_id = reservationId;
            }
          }

          // Auto-reopen if closed
          if (existingChannelThread.message_threads.status !== 'open') {
            await this.updateThreadStatus(existingChannelThread.message_threads.id, 'open');
            existingChannelThread.message_threads.status = 'open';
          }

          return existingChannelThread.message_threads;
        }
      }
    }    
    // Create new thread with group booking awareness
    const newThread = await this.createThread({
      reservation_id: reservationId,
      subject: initialData.subject || await this.generateGroupAwareSubject(reservationId), // Generate group-aware subject if needed
      ...initialData
    });
    
    return newThread;
  }

  async findOrCreateThreadByChannel(channel, externalThreadId, initialData = {}) {
    // Check if thread exists for this external ID
    const { data: existing } = await this.supabase
      .from('thread_channels')
      .select(`
        *,
        message_threads(*)
      `)
      .eq('channel', channel)
      .eq('external_thread_id', externalThreadId)
      .single();

    if (existing?.message_threads) {
      return existing.message_threads;
    }

    // Create new thread
    const thread = await this.createThread(initialData);
    
    // Add channel mapping
    await this.addThreadChannels(thread.id, [{
      channel,
      external_thread_id: externalThreadId
    }]);

    return thread;
  }

  async getThreadStats(threadId) {
    const { data: messages, error } = await this.supabase
      .from('messages')
      .select('origin_role, direction')
      .eq('thread_id', threadId);

    if (error) throw error;

    const stats = {
      total_messages: messages.length,
      guest_messages: messages.filter(m => m.origin_role === 'guest').length,
      host_messages: messages.filter(m => m.origin_role === 'host').length,
      assistant_messages: messages.filter(m => m.origin_role === 'assistant').length,
      incoming: messages.filter(m => m.direction === 'incoming').length,
      outgoing: messages.filter(m => m.direction === 'outgoing').length
    };

    return stats;
  }
}

module.exports = new CommunicationService();
