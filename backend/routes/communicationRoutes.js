const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { adminAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(adminAuth);

// GET /api/communication/threads - List message threads (inbox)
router.get('/threads', async (req, res) => {
  try {
    const { status = 'open', limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    // Get basic threads first - try with group columns, fall back if they don't exist
    let threads, error;
    
    try {
      const result = await supabaseAdmin
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
            is_group_master,
            group_room_count,
            booking_group_master_id,
            properties (
              id,
              name
            )
          )
        `)
        .eq('status', status)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);
      
      threads = result.data;
      error = result.error;
    } catch (groupError) {
      // If group columns don't exist, fall back to basic query
      if (groupError.message && groupError.message.includes('does not exist')) {
        console.warn('Group booking columns not found in threads query, falling back to basic query');
        
        const fallbackResult = await supabaseAdmin
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
        
        threads = fallbackResult.data;
        error = fallbackResult.error;
      } else {
        throw groupError;
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
