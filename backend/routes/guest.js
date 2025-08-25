const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const translationService = require('../services/translationService');
const { supabaseAdmin } = require('../config/supabase');
const supabase = supabaseAdmin; // Use admin client to bypass RLS policies

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

// GET /api/guest/:token/profile - Get guest profile with reservation history
router.get('/:token/profile', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get guest profile data with complete reservation history
    const profileData = await reservationService.getGuestProfile(token);

    if (!profileData) {
      return res.status(404).json({ error: 'Guest profile not found or invalid token' });
    }

    res.json(profileData);
  } catch (error) {
    console.error('Error fetching guest profile:', error);
    res.status(500).json({ error: 'Failed to fetch guest profile' });
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

// GET /api/guest/:token/property-translations - Get property translations for guest
router.get('/:token/property-translations', async (req, res) => {
  try {
    const { token } = req.params;
    const { language = 'en' } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Validate language code
    const supportedLanguages = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({ 
        error: 'Unsupported language code',
        supported: supportedLanguages 
      });
    }

    // Get guest dashboard data to validate token and get property ID
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const propertyId = dashboardData.property?.id;
    if (!propertyId) {
      return res.status(404).json({ error: 'Property not found for this reservation' });
    }

    console.log(`🌐 [GUEST TRANSLATIONS] Getting translations for property: ${propertyId}, language: ${language}`);

    // Get property translations using the translation service
    const translations = await translationService.getPropertyTranslations(propertyId, language);

    console.log(`🌐 [GUEST TRANSLATIONS] Found ${translations.length} translations for property: ${propertyId}`);

    // Convert translations array to object for easier frontend consumption
    const translationData = translations.reduce((acc, translation) => {
      acc[translation.field_name] = translation.translated_text;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        propertyId,
        language,
        translations: translationData,
        supportedLanguages
      }
    });

  } catch (error) {
    console.error('Error fetching guest property translations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch property translations',
      message: error.message 
    });
  }
});

// GET /api/guest/:token/thread - Get existing communication thread for guest (READ-ONLY)
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

    // ENHANCED: Use group-aware thread lookup to find existing unified threads
    const communicationService = require('../services/communicationService');
    
    // Check if this is part of a group booking
    const groupInfo = await communicationService.getGroupBookingInfo(reservationId);

    let thread = null;

    if (groupInfo.isGroupBooking) {
      console.log(`🎯 [GUEST THREAD] Group booking detected! Looking for unified thread using master reservation: ${groupInfo.masterReservationId}`);
      
      // For group bookings, look for thread using master reservation ID
      const masterReservationId = groupInfo.masterReservationId;
      
      const { data: groupThread, error: groupThreadError } = await supabase
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
        .eq('reservation_id', masterReservationId)
        .in('status', ['open', 'closed']) // Include closed threads too
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (groupThreadError) throw groupThreadError;
      
      if (groupThread) {
        console.log(`✅ [GUEST THREAD] Found existing group thread: ${groupThread.id} for master reservation: ${masterReservationId}`);
        thread = groupThread;
      } else {
      }
    } else {

      
      // For individual bookings, look for thread using this reservation ID
      const { data: individualThread, error: individualThreadError } = await supabase
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
        .in('status', ['open', 'closed']) // Include closed threads too
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (individualThreadError) throw individualThreadError;
      
      if (individualThread) {
        console.log(`✅ [GUEST THREAD] Found existing individual thread: ${individualThread.id} for reservation: ${reservationId}`);
        thread = individualThread;
      } else {
      }
    }

    // CHANGED: No longer auto-create threads - return null if none exists
    if (thread) {
    } else {
    }

    res.json({ thread });

  } catch (error) {
    console.error('Error getting guest thread:', error);
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

    console.log(`📨 [GUEST MESSAGES] Getting messages for token: ${token}`);

    // Get reservation data to validate token
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;
    console.log(`📨 [GUEST MESSAGES] Found reservation: ${reservationId}`);

    // ENHANCED: Use group-aware thread lookup to find the unified thread
    const communicationService = require('../services/communicationService');
    
    // Check if this is part of a group booking
    const groupInfo = await communicationService.getGroupBookingInfo(reservationId);
    console.log(`📨 [GUEST MESSAGES] Group booking info:`, groupInfo);

    let thread = null;

    if (groupInfo.isGroupBooking) {
      console.log(`📨 [GUEST MESSAGES] Group booking detected! Looking for unified thread using master reservation: ${groupInfo.masterReservationId}`);
      
      // For group bookings, look for thread using master reservation ID
      const masterReservationId = groupInfo.masterReservationId;
      
      const { data: groupThread, error: groupThreadError } = await supabase
        .from('message_threads')
        .select('id, status')
        .eq('reservation_id', masterReservationId)
        .in('status', ['open', 'closed']) // Include closed threads too
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (groupThreadError) throw groupThreadError;
      
      if (groupThread) {
        console.log(`✅ [GUEST MESSAGES] Found existing group thread: ${groupThread.id} for master reservation: ${masterReservationId}`);
        thread = groupThread;
      } else {
        console.log(`❌ [GUEST MESSAGES] No existing group thread found for master reservation: ${masterReservationId}`);
      }
    } else {
      console.log(`📨 [GUEST MESSAGES] Individual booking detected. Looking for individual thread for reservation: ${reservationId}`);
      
      // For individual bookings, look for thread using this reservation ID
      const { data: individualThread, error: individualThreadError } = await supabase
        .from('message_threads')
        .select('id, status')
        .eq('reservation_id', reservationId)
        .in('status', ['open', 'closed']) // Include closed threads too
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (individualThreadError) throw individualThreadError;
      
      if (individualThread) {
        console.log(`✅ [GUEST MESSAGES] Found existing individual thread: ${individualThread.id} for reservation: ${reservationId}`);
        thread = individualThread;
      } else {
        console.log(`❌ [GUEST MESSAGES] No existing individual thread found for reservation: ${reservationId}`);
      }
    }

    if (!thread) {
      console.log(`📨 [GUEST MESSAGES] No thread found, returning empty messages array`);
      return res.json({ messages: [] });
    }

    console.log(`📨 [GUEST MESSAGES] Loading messages for thread: ${thread.id} (status: ${thread.status})`);

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

    console.log(`📨 [GUEST MESSAGES] Found ${messages.length} messages for thread: ${thread.id}`);

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

    console.log(`📨 [GUEST MESSAGE] Sending message for token: ${token}`);

    // Get reservation data to validate token
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;
    const bookingName = dashboardData.reservation.booking_name;
    const bookingLastname = dashboardData.reservation.booking_lastname;
    const guestEmail = dashboardData.reservation.guest_email;

    console.log(`📨 [GUEST MESSAGE] Found reservation: ${reservationId}, guest: ${bookingName}`);

    // Create full name for subject generation
    const fullGuestName = bookingLastname ? `${bookingName} ${bookingLastname}` : bookingName;

    // ENHANCED: Use group-aware thread creation through CommunicationService
    const communicationService = require('../services/communicationService');
    
    console.log(`📨 [GUEST MESSAGE] Using group-aware thread lookup/creation for reservation: ${reservationId}`);
    
    // Find or create thread using the unified group booking logic
    const thread = await communicationService.findOrCreateThreadByReservation(
      reservationId,
      {
        subject: fullGuestName, // Will be enhanced by group-aware logic if needed
        participants: [
          {
            type: 'guest',
            external_address: guestEmail,
            display_name: fullGuestName
          }
        ],
        channels: [
          {
            channel: 'inapp',
            external_thread_id: reservationId // Use reservation ID as fallback
          }
        ]
      }
    );

    console.log(`📨 [GUEST MESSAGE] Using thread: ${thread.id} (reservation: ${thread.reservation_id}) for guest message`);

    // Send the message using the CommunicationService to ensure delivery tracking
    const message = await communicationService.sendMessage({
      thread_id: thread.id,
      channel: 'inapp',
      content: content.trim(),
      origin_role: 'guest',
      parent_message_id: parent_message_id
    });

    console.log(`✅ [GUEST MESSAGE] Message sent successfully: ${message.id} in thread: ${thread.id}`);

    // Get the complete message data with delivery information
    const { data: messageWithDeliveries, error: getMessageError } = await supabase
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

    if (getMessageError) throw getMessageError;

    console.log(`📨 [GUEST MESSAGE] Returning message data: ${messageWithDeliveries.id}`);

    res.status(201).json({ 
      message: messageWithDeliveries,
      thread: thread // Include thread info so frontend can update its state
    });

  } catch (error) {
    console.error('Error sending guest message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// POST /api/guest/:token/messages/:messageId/read - Mark a message as read for guest
router.post('/:token/messages/:messageId/read', async (req, res) => {
  try {
    const { token, messageId } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    if (!messageId) {
      return res.status(400).json({ error: 'Message ID is required' });
    }

    // Get reservation data to validate token
    const dashboardData = await reservationService.getGuestAppData(token);
    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    const reservationId = dashboardData.reservation.id;

    // Verify the message belongs to this guest's thread
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select(`
        id,
        thread_id,
        message_threads!inner(reservation_id)
      `)
      .eq('id', messageId)
      .eq('message_threads.reservation_id', reservationId)
      .single();

    if (messageError || !message) {
      return res.status(404).json({ error: 'Message not found or access denied' });
    }

    // Use the communication service to mark message as read
    const communicationService = require('../services/communicationService');
    const result = await communicationService.markMessageAsRead(messageId, 'inapp');

    res.json(result);

  } catch (error) {
    console.error('Error marking guest message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// GET /api/guest/:token/services - Get available services for guest purchase
router.get('/:token/services', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get available services for this guest
    const guestServicesService = require('../services/guestServicesService');
    const services = await guestServicesService.getAvailableServicesForGuest(token);

    res.json(services);

  } catch (error) {
    console.error('Error fetching guest services:', error);
    res.status(500).json({ error: 'Failed to fetch available services' });
  }
});

// POST /api/guest/:token/services/:serviceId/purchase - Create Stripe checkout for service purchase
router.post('/:token/services/:serviceId/purchase', async (req, res) => {
  try {
    const { token, serviceId } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    if (!serviceId) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    console.log(`💳 [GUEST SERVICE PURCHASE] Creating checkout for service: ${serviceId}, token: ${token}`);

    // Get reservation data to validate token and get reservation ID
    const reservationData = await reservationService.getReservationByToken(token);
    if (!reservationData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    console.log(`💳 [GUEST SERVICE PURCHASE] Found reservation: ${reservationData.id}`);

    // Find the service by addon ID (not service_key)
    const guestServicesService = require('../services/guestServicesService');
    const availableServices = await guestServicesService.getAvailableServicesForGuest(token);
    const serviceToPurchase = availableServices.find(s => s.id === serviceId);

    if (!serviceToPurchase) {
      return res.status(404).json({ error: 'Service not found or not available for purchase' });
    }

    console.log(`💳 [GUEST SERVICE PURCHASE] Service found: ${serviceToPurchase.name} (${serviceToPurchase.service_type})`);

    // Create Stripe checkout session
    const checkoutSession = await guestServicesService.createServiceCheckout(
      reservationData.id,
      serviceToPurchase.service_type,
      token,
      req
    );

    console.log(`✅ [GUEST SERVICE PURCHASE] Checkout session created: ${checkoutSession.id}`);

    res.json({
      checkout_url: checkoutSession.checkoutUrl,
      checkout_session_id: checkoutSession.sessionId,
      service: {
        id: serviceToPurchase.id,
        name: serviceToPurchase.name,
        price: serviceToPurchase.price,
        currency: serviceToPurchase.currency
      }
    });

  } catch (error) {
    console.error('Error creating service checkout:', error);
    res.status(500).json({ 
      error: 'Failed to create checkout session',
      details: error.message 
    });
  }
});

module.exports = router;
