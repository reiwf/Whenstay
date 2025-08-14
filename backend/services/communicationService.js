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

    if (error) throw error;

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
      external_thread_id: c.external_thread_id
    }));

    const { error } = await this.supabase
      .from('thread_channels')
      .insert(channelRows);

    if (error) throw error;
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

    // Insert delivery record (trigger will set queued_at automatically)
    const { error: deliveryError } = await this.supabase
      .from('message_deliveries')
      .insert({
        message_id: message.id,
        channel,
        status: 'queued'
      });

    if (deliveryError) throw deliveryError;

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

    // Insert message
    const { error: msgError, data: message } = await this.supabase
      .from('messages')
      .insert({
        thread_id,
        origin_role,
        direction: 'incoming',
        channel,
        content,
        sent_at: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Insert delivery record (trigger will set delivered_at automatically)
    const { error: deliveryError } = await this.supabase
      .from('message_deliveries')
      .insert({
        message_id: message.id,
        channel,
        provider_message_id,
        status: 'delivered'
      });

    if (deliveryError) throw deliveryError;

    // Update thread last message info
    await this.updateThreadLastMessage(thread_id, content);

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
        case 'inapp':
          // In-app messages: queued → sent → delivered
          await this.updateDeliveryStatus(messageId, channel, 'sent');
          // Simulate brief delay for sent → delivered transition
          setTimeout(async () => {
            await this.updateDeliveryStatus(messageId, channel, 'delivered');
          }, 1000);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }
    } catch (error) {
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

  async sendEmail(messageId, content, data) {
    // TODO: Implement email service integration
    console.log('Email send:', { messageId, content });
    await this.updateDeliveryStatus(messageId, 'email', 'sent');
  }

  async sendSMS(messageId, content, data) {
    // TODO: Implement SMS service integration
    console.log('SMS send:', { messageId, content });
    await this.updateDeliveryStatus(messageId, 'sms', 'sent');
  }

  async sendBeds24(messageId, content, data) {
    // TODO: Implement Beds24 API integration
    console.log('Beds24 send:', { messageId, content });
    await this.updateDeliveryStatus(messageId, 'beds24', 'sent');
  }

  async updateDeliveryStatus(messageId, channel, status, errorMessage = null) {
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
        // Failed status doesn't get a timestamp, but we log the error
        break;
      default:
        console.warn(`Unknown delivery status: ${status}`);
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await this.supabase
      .from('message_deliveries')
      .update(updateData)
      .eq('message_id', messageId)
      .eq('channel', channel);

    if (error) throw error;
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

  // ===== HELPER METHODS =====

  async findOrCreateThreadByReservation(reservationId, initialData = {}) {
    // Check if thread exists for this reservation
    const { data: existing } = await this.supabase
      .from('message_threads')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('status', 'open')
      .single();

    if (existing) {
      return existing;
    }

    // Create new thread
    return await this.createThread({
      reservation_id: reservationId,
      subject: initialData.subject || null, // Let trigger handle it
      ...initialData
    });
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
