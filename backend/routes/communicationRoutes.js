const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { adminAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(adminAuth);

// GET /api/communication/threads - List message threads (inbox)
router.get('/threads', async (req, res) => {
  try {
    const { status = 'open', limit = 50, offset = 0, needs_linking } = req.query;
    const userId = req.user.id;

    // Get basic threads first - try with group and email threading columns, fall back if they don't exist
    let threads, error;
    
    try {
      let query = supabaseAdmin
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
          needs_linking,
          email_thread_id,
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
            is_group_master,
            group_room_count,
            booking_group_master_id,
            properties (
              id,
              name
            )
          )
        `)
        .eq('status', status);
      
      // Add needs_linking filter if specified
      if (needs_linking !== undefined) {
        query = query.eq('needs_linking', needs_linking === 'true');
      }
      
      const result = await query
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      
      threads = result.data;
      error = result.error;
    } catch (schemaError) {
      // If email threading or group columns don't exist, fall back to basic query
      if (schemaError.message && schemaError.message.includes('does not exist')) {
        console.warn('Email threading or group booking columns not found, falling back to basic query');
        
        let fallbackQuery = supabaseAdmin
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
          .eq('status', status);
        
        const fallbackResult = await fallbackQuery
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1);
        
        threads = fallbackResult.data;
        error = fallbackResult.error;
      } else {
        throw schemaError;
      }
    }

    if (error) throw error;

    // Optimized batch query for unread counts
    const threadIds = threads.map(t => t.id);
    
    if (threadIds.length === 0) {
      return res.json({
        threads: [],
        total: 0
      });
    }

    // Get all participants for these threads in one query
    const { data: participants } = await supabaseAdmin
      .from('message_participants')
      .select('thread_id, last_read_at')
      .eq('user_id', userId)
      .in('thread_id', threadIds);

    // Create a map of thread_id -> last_read_at for quick lookup
    const participantMap = new Map();
    participants?.forEach(p => {
      participantMap.set(p.thread_id, p.last_read_at || '1970-01-01T00:00:00Z');
    });

    // Get unread counts for all threads efficiently by grouping similar queries
    const unreadCountQueries = threadIds.map(async (threadId) => {
      const lastReadAt = participantMap.get(threadId) || '1970-01-01T00:00:00Z';
      
      const { count } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('thread_id', threadId)
        .eq('direction', 'incoming')
        .gt('created_at', lastReadAt);

      return { threadId, unreadCount: count || 0 };
    });

    // Execute all unread count queries in parallel (still multiple queries but much faster)
    const unreadResults = await Promise.all(unreadCountQueries);

    // Create map for quick lookup
    const unreadMap = new Map();
    unreadResults.forEach(result => {
      unreadMap.set(result.threadId, result.unreadCount);
    });

    // Attach unread counts to threads
    const threadsWithUnread = threads.map(thread => ({
      ...thread,
      unread_count: unreadMap.get(thread.id) || 0
    }));

    res.json({
      threads: threadsWithUnread,
      total: threadsWithUnread.length
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
    const { data: messages, error } = await supabaseAdmin
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
        is_unsent,
        unsent_at,
        unsent_by,
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

    // For messages with images, allow longer content due to HTML image tags
    const hasImages = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi.test(content);
    const maxLength = hasImages ? 10000 : 1000; // Allow 10KB for messages with images
    
    if (content.trim().length > maxLength) {
      return res.status(400).json({ 
        error: `Message content too long (max ${hasImages ? '10000' : '1000'} characters)` 
      });
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
    await supabaseAdmin.rpc('mark_messages_read', {
      p_thread_id: threadId,
      p_user_id: userId,
      p_last_message_id: message.id
    });

    // Get the complete message data with delivery status
    const { data: completeMessage } = await supabaseAdmin
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

    const { data, error } = await supabaseAdmin
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
    const { data: threadChannels, error: channelsError } = await supabaseAdmin
      .from('thread_channels')
      .select('channel, external_thread_id')
      .eq('thread_id', threadId);

    if (channelsError) throw channelsError;

    // Get participant external addresses (phone/email)
    const { data: participants, error: participantsError } = await supabaseAdmin
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

    let query = supabaseAdmin
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
    const { data: scheduledId, error } = await supabaseAdmin.rpc('schedule_message', {
      p_thread_id: thread_id,
      p_template_id: template_id,
      p_channel: channel,
      p_run_at: run_at,
      p_payload: payload
    });

    if (error) throw error;

    // Update the scheduled message with creator info
    const { data: scheduledMessage, error: updateError } = await supabaseAdmin
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
    const { error } = await supabaseAdmin.rpc('mark_messages_read', {
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

// DELETE /api/communication/messages/:messageId/unsend - Unsend a specific message
router.delete('/messages/:messageId/unsend', async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const communicationService = require('../services/communicationService');
    
    // Unsend the message
    const result = await communicationService.unsendMessage(messageId, userId);

    res.json(result);

  } catch (error) {
    console.error('Error unsending message:', error);
    
    // Return appropriate HTTP status codes based on error type
    if (error.message.includes('cannot be unsent')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else if (error.message.includes('already unsent')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to unsend message' });
    }
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
    const { data: threadId, error } = await supabaseAdmin.rpc('create_message_thread', {
      p_reservation_id: reservation_id,
      p_subject: subject,
      p_guest_external_address: guest_external_address,
      p_guest_display_name: guest_display_name
    });

    if (error) throw error;

    // Get the complete thread data
    const { data: thread } = await supabaseAdmin
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

// POST /api/communication/group-message - Send message to group booking
router.post('/group-message', async (req, res) => {
  try {
    const { reservation_id, content, channel = 'inapp', parent_message_id } = req.body;
    const userId = req.user.id;

    if (!reservation_id) {
      return res.status(400).json({ error: 'reservation_id is required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Use the communication service for group message handling
    const communicationService = require('../services/communicationService');
    
    const message = await communicationService.sendGroupMessage({
      reservation_id: reservation_id,
      channel: channel,
      content: content.trim(),
      origin_role: 'host',
      parent_message_id: parent_message_id
    });

    // Mark thread as read for the sender
    await supabaseAdmin.rpc('mark_messages_read', {
      p_thread_id: message.thread_id,
      p_user_id: userId,
      p_last_message_id: message.id
    });

    // Get the complete message data with delivery status
    const { data: completeMessage } = await supabaseAdmin
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
    console.error('Error sending group message:', error);
    res.status(500).json({ error: 'Failed to send group message' });
  }
});

// GET /api/communication/group/:masterReservationId/threads - Get all threads for a group booking
router.get('/group/:masterReservationId/threads', async (req, res) => {
  try {
    const { masterReservationId } = req.params;

    const communicationService = require('../services/communicationService');
    
    // Get all threads for this group booking
    const threads = await communicationService.getGroupBookingThreads(masterReservationId);

    res.json({ threads });

  } catch (error) {
    console.error('Error fetching group booking threads:', error);
    res.status(500).json({ error: 'Failed to fetch group booking threads' });
  }
});

// PUT /api/communication/threads/:id/link - Link unlinked thread to reservation
router.put('/threads/:threadId/link', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reservation_id } = req.body;

    if (!reservation_id) {
      return res.status(400).json({ error: 'reservation_id is required' });
    }

    // Update thread to link it to the reservation
    const { data: thread, error } = await supabaseAdmin
      .from('message_threads')
      .update({ 
        reservation_id: reservation_id,
        needs_linking: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select()
      .single();

    if (error) throw error;

    res.json({ thread, message: 'Thread linked successfully' });

  } catch (error) {
    console.error('Error linking thread:', error);
    res.status(500).json({ error: 'Failed to link thread' });
  }
});

// POST /api/communication/threads/:id/merge - Merge unlinked thread with existing thread
router.post('/threads/:sourceThreadId/merge', async (req, res) => {
  try {
    const { sourceThreadId } = req.params;
    const { target_thread_id } = req.body;

    if (!target_thread_id) {
      return res.status(400).json({ error: 'target_thread_id is required' });
    }

    // Move all messages from source thread to target thread
    const { error: moveError } = await supabaseAdmin
      .from('messages')
      .update({ thread_id: target_thread_id })
      .eq('thread_id', sourceThreadId);

    if (moveError) throw moveError;

    // Update target thread's last message info
    const { data: lastMessage } = await supabaseAdmin
      .from('messages')
      .select('created_at, content')
      .eq('thread_id', target_thread_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastMessage) {
      await supabaseAdmin
        .from('message_threads')
        .update({
          last_message_at: lastMessage.created_at,
          last_message_preview: lastMessage.content.substring(0, 160),
          updated_at: new Date().toISOString()
        })
        .eq('id', target_thread_id);
    }

    // Delete the source thread
    const { error: deleteError } = await supabaseAdmin
      .from('message_threads')
      .delete()
      .eq('id', sourceThreadId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Threads merged successfully' });

  } catch (error) {
    console.error('Error merging threads:', error);
    res.status(500).json({ error: 'Failed to merge threads' });
  }
});

// PUT /api/communication/threads/:id/reject - Mark unlinked thread as spam/rejected
router.put('/threads/:threadId/reject', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { reason = 'spam' } = req.body;

    // Update thread status to archived and mark as resolved
    const { data: thread, error } = await supabaseAdmin
      .from('message_threads')
      .update({ 
        status: 'archived',
        needs_linking: false,
        subject: `[${reason.toUpperCase()}] ${thread?.subject || 'Unknown Thread'}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select()
      .single();

    if (error) throw error;

    res.json({ thread, message: `Thread marked as ${reason}` });

  } catch (error) {
    console.error('Error rejecting thread:', error);
    res.status(500).json({ error: 'Failed to reject thread' });
  }
});

// GET /api/communication/threads/:id/suggestions - Get matching suggestions for unlinked thread
router.get('/threads/:threadId/suggestions', async (req, res) => {
  try {
    const { threadId } = req.params;

    // Get the thread details
    const { data: thread, error: threadError } = await supabaseAdmin
      .from('message_threads')
      .select(`
        id,
        subject,
        email_thread_id,
        created_at,
        messages (
          content,
          created_at
        )
      `)
      .eq('id', threadId)
      .single();

    if (threadError) throw threadError;

    // Get guest email from first message if available
    let guestEmail = null;
    if (thread.messages && thread.messages.length > 0) {
      // Extract email from message content or metadata
      const firstMessage = thread.messages[0];
      const emailMatch = firstMessage.content.match(/[\w\.-]+@[\w\.-]+\.\w+/);
      if (emailMatch) {
        guestEmail = emailMatch[0];
      }
    }

    let suggestions = [];

    // Strategy 1: Find reservations by guest email
    if (guestEmail) {
      const { data: emailMatches } = await supabaseAdmin
        .from('reservations')
        .select(`
          id,
          booking_name,
          booking_email,
          check_in_date,
          check_out_date,
          properties (name)
        `)
        .ilike('booking_email', `%${guestEmail}%`)
        .order('check_in_date', { ascending: false })
        .limit(5);

      if (emailMatches) {
        suggestions.push(...emailMatches.map(r => ({
          ...r,
          confidence: 'high',
          match_reason: 'Email match'
        })));
      }
    }

    // Strategy 2: Find recent reservations by name similarity (if subject contains a name)
    if (thread.subject && suggestions.length < 5) {
      const nameMatch = thread.subject.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/);
      if (nameMatch) {
        const name = nameMatch[0];
        const { data: nameMatches } = await supabaseAdmin
          .from('reservations')
          .select(`
            id,
            booking_name,
            booking_email,
            check_in_date,
            check_out_date,
            properties (name)
          `)
          .ilike('booking_name', `%${name}%`)
          .gte('check_in_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
          .order('check_in_date', { ascending: false })
          .limit(3);

        if (nameMatches) {
          suggestions.push(...nameMatches.map(r => ({
            ...r,
            confidence: 'medium',
            match_reason: `Name similarity: ${name}`
          })));
        }
      }
    }

    // Strategy 3: Find recent reservations without threads (if still need more suggestions)
    if (suggestions.length < 5) {
      const { data: recentMatches } = await supabaseAdmin
        .from('reservations')
        .select(`
          id,
          booking_name,
          booking_email,
          check_in_date,
          check_out_date,
          properties (name)
        `)
        .gte('check_in_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .is('id', null) // This is a placeholder - we'd need a LEFT JOIN to find reservations without threads
        .order('check_in_date', { ascending: false })
        .limit(2);

      if (recentMatches) {
        suggestions.push(...recentMatches.map(r => ({
          ...r,
          confidence: 'low',
          match_reason: 'Recent reservation'
        })));
      }
    }

    // Remove duplicates and limit to 5
    const uniqueSuggestions = suggestions
      .filter((suggestion, index, self) => 
        index === self.findIndex(s => s.id === suggestion.id)
      )
      .slice(0, 5);

    res.json({ suggestions: uniqueSuggestions });

  } catch (error) {
    console.error('Error getting thread suggestions:', error);
    res.status(500).json({ error: 'Failed to get thread suggestions' });
  }
});

// GET /api/communication/reservation/:reservationId/group-info - Get group booking info for a reservation
router.get('/reservation/:reservationId/group-info', async (req, res) => {
  try {
    console.log(`🔍 [DEBUG] /reservation/${req.params.reservationId}/group-info request received`);
    
    const { reservationId } = req.params;

    // First, check if the reservation exists with basic fields
    console.log(`🔍 [DEBUG] Querying basic reservation data...`);
    const { data: basicReservation, error: basicError } = await supabaseAdmin
      .from('reservations')
      .select('id, booking_name')
      .eq('id', reservationId)
      .single();

    if (basicError) {
      console.error(`❌ [DEBUG] Basic reservation query error:`, basicError);
      if (basicError.code === 'PGRST116') {
        return res.status(404).json({ error: 'group Reservation not found' });
      }
      throw basicError;
    }

    console.log(`✅ [DEBUG] Basic reservation found:`, basicReservation);

    // Try to get group booking details, but handle case where migration hasn't been run
    let reservation = basicReservation;
    let hasGroupColumns = false;
    
    try {
      const { data: groupReservation, error: groupError } = await supabaseAdmin
        .from('reservations')
        .select(`
          id,
          booking_name,
          is_group_master,
          group_room_count,
          booking_group_master_id,
          booking_group_ids
        `)
        .eq('id', reservationId)
        .single();

      if (groupError) {
        // Check if error is due to missing columns (schema not migrated)
        if (groupError.code === 'PGRST202' || groupError.message.includes('does not exist')) {
          console.warn('Group booking columns not found, migration may not have been run:', groupError.message);
          hasGroupColumns = false;
        } else {
          throw groupError;
        }
      } else {
        reservation = groupReservation;
        hasGroupColumns = true;
      }
    } catch (error) {
      // Fallback to basic reservation if group booking columns don't exist
      console.warn('Group booking query failed, falling back to basic reservation data:', error.message);
      hasGroupColumns = false;
    }

    // Check if this is a group booking (only if columns exist and have values)
    const isGroupBooking = hasGroupColumns && (
      reservation.is_group_master === true || 
      (reservation.booking_group_master_id != null && reservation.booking_group_master_id !== '')
    );
    let groupReservations = [reservation];
    
    if (isGroupBooking) {
      try {
        const reservationService = require('../services/reservationService');
        
        const masterId = reservation.is_group_master 
          ? reservation.id 
          : reservation.booking_group_master_id;
        
        if (masterId) {
          groupReservations = await reservationService.getGroupBookingReservations(masterId);
        }
      } catch (serviceError) {
        console.warn('Could not fetch group reservations:', serviceError.message);
        // Continue with single reservation
      }
    }

    res.json({
      isGroupBooking: isGroupBooking,
      isMaster: hasGroupColumns ? (reservation.is_group_master === true) : false,
      masterReservationId: hasGroupColumns && reservation.is_group_master 
        ? reservation.id 
        : (hasGroupColumns && reservation.booking_group_master_id ? reservation.booking_group_master_id : null),
      totalRooms: hasGroupColumns && reservation.group_room_count ? reservation.group_room_count : 1,
      groupReservations: groupReservations && groupReservations.length > 0 ? groupReservations : [reservation]
    });

  } catch (error) {
    console.error('Error fetching group booking info:', error);
    res.status(500).json({ error: 'Failed to fetch group booking info' });
  }
});

module.exports = router;
