const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const { supabase } = require('../config/supabase');

// Get guest dashboard data by check-in token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get guest dashboard data
    const dashboardData = await reservationService.getGuestAppData(token);

    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching guest dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch guest dashboard data' });
  }
});

// Update access_read status to true when guest views access code
router.post('/:token/access-read', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Update access_read to true
    const result = await reservationService.updateAccessRead(token);

    if (!result) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    res.json({ success: true, message: 'Access read status updated' });
  } catch (error) {
    console.error('Error updating access read status:', error);
    res.status(500).json({ error: 'Failed to update access read status' });
  }
});

// GET /api/guest/:token/thread - Get or create communication thread for guest
router.get('/:token/thread', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get reservation data to validate token and get reservation info
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;
    const bookingName = dashboardData.reservation.booking_name;
    const bookingLastname = dashboardData.reservation.booking_lastname;
    const guestEmail = dashboardData.reservation.guest_email;

    // Create full name for subject
    const fullGuestName = bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName;

    // Check if a thread already exists for this reservation
    const { data: existingThread, error: threadError } = await supabase
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
      .eq('reservation_id', reservationId)
      .eq('status', 'open')
      .maybeSingle();

    if (threadError) throw threadError;

    let thread = existingThread;

    // Create thread if it doesn't exist
    if (!thread) {
      const { data: threadId, error: createError } = await supabase.rpc('create_message_thread', {
        p_reservation_id: reservationId,
        p_subject: fullGuestName,
        p_guest_external_address: guestEmail,
        p_guest_display_name: fullGuestName
      });

      if (createError) throw createError;

      // Get the complete thread data
      const { data: newThread, error: getThreadError } = await supabase
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

      if (getThreadError) throw getThreadError;
      thread = newThread;
    }

    res.json({ thread });

  } catch (error) {
    console.error('Error getting/creating guest thread:', error);
    res.status(500).json({ error: 'Failed to get communication thread' });
  }
});

// GET /api/guest/:token/thread/messages - Get messages for guest's thread
router.get('/:token/thread/messages', async (req, res) => {
  try {
    const { token } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get reservation data to validate token
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;

    // Get thread for this reservation
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('status', 'open')
      .maybeSingle();

    if (threadError) throw threadError;

    if (!thread) {
      return res.json({ messages: [] });
    }

    // Get messages for the thread
    const { data: messages, error: messagesError } = await supabase
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
        )
      `)
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) throw messagesError;

    res.json({ messages });

  } catch (error) {
    console.error('Error fetching guest messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/guest/:token/thread/messages - Send message from guest
router.post('/:token/thread/messages', async (req, res) => {
  try {
    const { token } = req.params;
    const { content, parent_message_id } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.trim().length > 1000) {
      return res.status(400).json({ error: 'Message content too long (max 1000 characters)' });
    }

    // Get reservation data to validate token
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;
    const bookingName = dashboardData.reservation.booking_name;
    const bookingLastname = dashboardData.reservation.booking_lastname;
    const guestName = dashboardData.reservation.guest_name;
    const guestEmail = dashboardData.reservation.guest_email;

    // Create full name for subject
    const fullGuestName = bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName;

    // Get or create thread for this reservation
    let { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .select('id')
      .eq('reservation_id', reservationId)
      .eq('status', 'open')
      .maybeSingle();

    if (threadError) throw threadError;

    // Create thread if it doesn't exist
    if (!thread) {
      const { data: threadId, error: createError } = await supabase.rpc('create_message_thread', {
        p_reservation_id: reservationId,
        p_subject: fullGuestName,
        p_guest_external_address: guestEmail,
        p_guest_display_name: fullGuestName
      });

      if (createError) throw createError;
      thread = { id: threadId };
    }

    // Send the message using the existing send_message function
    const { data: messageId, error: sendError } = await supabase.rpc('send_message', {
      p_thread_id: thread.id,
      p_channel: 'inapp',
      p_content: content.trim(),
      p_origin_role: 'guest',
      p_parent_message_id: parent_message_id
    });

    if (sendError) throw sendError;

    // Get the complete message data to return
    const { data: message, error: getMessageError } = await supabase
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
      .eq('id', messageId)
      .single();

    if (getMessageError) throw getMessageError;

    res.status(201).json({ message });

  } catch (error) {
    console.error('Error sending guest message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
