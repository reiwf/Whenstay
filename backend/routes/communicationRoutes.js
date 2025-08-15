const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { adminOnlyAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(adminOnlyAuth);

// GET /api/communication/threads - List message threads (inbox)
router.get('/threads', async (req, res) => {
  try {
    const { status = 'open', limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Get threads for properties owned by the user, with unread count
    const { data: threads, error } = await supabase
      .from('message_threads')
      .select(`
        id,
        reservation_id,
        subject,
        status,
        priority,
        last_message_at,
        last_message_preview,
        created_at,
        updated_at,
        thread_channels (
          channel,
          external_thread_id
        ),
        reservations (
          id,
          booking_name,
          booking_email,
          check_in_date,
          check_out_date,
          properties (
            id,
            name
          )
        )
      `)
      .eq('status', status)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Calculate unread counts for each thread
    const threadsWithUnread = await Promise.all(
      threads.map(async (thread) => {
        const { data: participant } = await supabase
          .from('message_participants')
          .select('last_read_at')
          .eq('thread_id', thread.id)
          .eq('user_id', userId)
          .maybeSingle();

        const lastReadAt = participant?.last_read_at || '1970-01-01T00:00:00Z';

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('thread_id', thread.id)
          .gt('created_at', lastReadAt);

        return {
          ...thread,
          unread_count: unreadCount || 0
        };
      })
    );

    res.json({
      threads: threadsWithUnread,
      total: threads.length
    });

  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch message threads' });
  }
});

// GET /api/communication/threads/:id/messages - Get messages for a thread
router.get('/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Get messages with delivery status
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        thread_id,
        parent_message_id,
        origin_role,
        direction,
        channel,
        content,
        sent_at,
        created_at,
        updated_at,
        message_deliveries (
          id,
          status,
          sent_at,
          delivered_at,
          read_at,
          error_message
        ),
        message_attachments (
          id,
          path,
          content_type,
          size_bytes
        )
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({ messages });

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/communication/threads/:id/messages - Send a new message
router.post('/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { content, channel = 'inapp', parent_message_id } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Use the communication service for proper status progression
    const communicationService = require('../services/communicationService');
    
    const message = await communicationService.sendMessage({
      thread_id: threadId,
      channel: channel,
      content: content.trim(),
      origin_role: 'host',
      parent_message_id: parent_message_id
    });

    // Mark thread as read for the sender
    await supabase.rpc('mark_messages_read', {
      p_thread_id: threadId,
      p_user_id: userId,
      p_last_message_id: message.id
    });

    // Get the complete message data with delivery status
    const { data: completeMessage } = await supabase
      .from('messages')
      .select(`
        id,
        thread_id,
        parent_message_id,
        origin_role,
        direction,
        channel,
        content,
        sent_at,
        created_at,
        message_deliveries (
          id,
          status,
          sent_at,
          delivered_at,
          read_at
        )
      `)
      .eq('id', message.id)
      .single();

    res.status(201).json({ message: completeMessage });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/communication/threads/:id/status - Update thread status (close/archive)
router.put('/threads/:threadId/status', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { status } = req.body;

    if (!['open', 'closed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('message_threads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', threadId)
      .select()
      .single();

    if (error) throw error;

    res.json({ thread: data });

  } catch (error) {
    console.error('Error updating thread status:', error);
    res.status(500).json({ error: 'Failed to update thread status' });
  }
});

// GET /api/communication/threads/:id/channels - Get available channels for a thread
router.get('/threads/:threadId/channels', async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get thread channels
    const { data: threadChannels, error: channelsError } = await supabase
      .from('thread_channels')
      .select('channel, external_thread_id')
      .eq('thread_id', threadId);

    if (channelsError) throw channelsError;

    // Get participant external addresses (phone/email)
    const { data: participants, error: participantsError } = await supabase
      .from('message_participants')
      .select('participant_type, external_address')
      .eq('thread_id', threadId)
      .not('external_address', 'is', null);

    if (participantsError) throw participantsError;

    // Determine available channels
    const availableChannels = ['inapp']; // Always available
    
    // Add channels based on thread configuration
    threadChannels.forEach(tc => {
      if (!availableChannels.includes(tc.channel)) {
        availableChannels.push(tc.channel);
      }
    });

    // Add channels based on participant contact info
    participants.forEach(p => {
      if (p.external_address) {
        if (p.external_address.includes('@') && !availableChannels.includes('email')) {
          availableChannels.push('email');
        }
        if (/^\+?\d+$/.test(p.external_address) && !availableChannels.includes('sms')) {
          availableChannels.push('sms');
        }
      }
    });

    res.json({ channels: availableChannels });

  } catch (error) {
    console.error('Error fetching thread channels:', error);
    res.status(500).json({ error: 'Failed to fetch thread channels' });
  }
});

// GET /api/communication/templates - List message templates
router.get('/templates', async (req, res) => {
  try {
    const { channel, property_id } = req.query;
    const userId = req.user.id;

    let query = supabase
      .from('message_templates')
      .select('id, name, channel, language, content, variables, created_at')
      .order('name');

    // Filter by channel if specified
    if (channel) {
      query = query.eq('channel', channel);
    }

    // Filter by property or show global templates
    if (property_id) {
      query = query.or(`property_id.eq.${property_id},property_id.is.null`);
    } else {
      query = query.is('property_id', null);
    }

    const { data: templates, error } = await query;

    if (error) throw error;

    res.json({ templates });

  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/communication/schedule - Schedule a message
router.post('/schedule', async (req, res) => {
  try {
    const { thread_id, template_id, channel, run_at, payload = {} } = req.body;
    const userId = req.user.id;

    if (!thread_id || !template_id || !channel || !run_at) {
      return res.status(400).json({ 
        error: 'thread_id, template_id, channel, and run_at are required' 
      });
    }

    // Schedule the message
    const { data: scheduledId, error } = await supabase.rpc('schedule_message', {
      p_thread_id: thread_id,
      p_template_id: template_id,
      p_channel: channel,
      p_run_at: run_at,
      p_payload: payload
    });

    if (error) throw error;

    // Update the scheduled message with creator info
    const { data: scheduledMessage, error: updateError } = await supabase
      .from('scheduled_messages')
      .update({ created_by: userId })
      .eq('id', scheduledId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(201).json({ scheduled_message: scheduledMessage });

  } catch (error) {
    console.error('Error scheduling message:', error);
    res.status(500).json({ error: 'Failed to schedule message' });
  }
});

// POST /api/communication/threads/:id/read - Mark messages as read
router.post('/threads/:threadId/read', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { last_message_id } = req.body;
    const userId = req.user.id;

    // Mark messages as read
    const { error } = await supabase.rpc('mark_messages_read', {
      p_thread_id: threadId,
      p_user_id: userId,
      p_last_message_id: last_message_id
    });

    if (error) throw error;

    res.json({ success: true });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// POST /api/communication/messages/:messageId/read - Mark a specific message as read
router.post('/messages/:messageId/read', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { channel = 'inapp' } = req.body;

    const communicationService = require('../services/communicationService');
    
    // Mark the specific message as read
    const result = await communicationService.markMessageAsRead(messageId, channel);

    res.json(result);

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// POST /api/communication/threads/:threadId/read-all - Mark all messages in thread as read
router.post('/threads/:threadId/read-all', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { before_message_id } = req.body;

    const communicationService = require('../services/communicationService');
    
    // Mark all messages in thread as read
    const result = await communicationService.markThreadMessagesAsRead(threadId, before_message_id);

    res.json(result);

  } catch (error) {
    console.error('Error marking thread messages as read:', error);
    res.status(500).json({ error: 'Failed to mark thread messages as read' });
  }
});

// POST /api/communication/threads - Create a new thread
router.post('/threads', async (req, res) => {
  try {
    const { 
      reservation_id, 
      subject, 
      guest_external_address, 
      guest_display_name 
    } = req.body;

    if (!reservation_id) {
      return res.status(400).json({ error: 'reservation_id is required' });
    }

    // Create thread with guest participant
    const { data: threadId, error } = await supabase.rpc('create_message_thread', {
      p_reservation_id: reservation_id,
      p_subject: subject,
      p_guest_external_address: guest_external_address,
      p_guest_display_name: guest_display_name
    });

    if (error) throw error;

    // Get the complete thread data
    const { data: thread } = await supabase
      .from('message_threads')
      .select(`
        id,
        reservation_id,
        subject,
        status,
        priority,
        last_message_at,
        last_message_preview,
        created_at,
        updated_at
      `)
      .eq('id', threadId)
      .single();

    res.status(201).json({ thread });

  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

module.exports = router;
