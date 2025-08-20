const express = require('express');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const reservationService = require('../services/reservationService');
const emailService = require('../services/emailService');
const communicationService = require('../services/communicationService');
const automationService = require('../services/automationService');
const stripeService = require('../services/stripeService');
const { adminAuth } = require('../middleware/auth');

// Beds24 webhook endpoint
router.post('/beds24', async (req, res) => {
  try {
    console.log('Received Beds24 webhook:', req.body);
    
    // Verify webhook signature if configured
    const signature = req.headers['x-beds24-signature'] || req.headers['signature'];
    if (signature && !beds24Service.verifyWebhookSignature(req.rawBody, signature)) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = req.body;
    
    // Extract event information
    const eventType = webhookData.event || webhookData.type || 'booking_update';
    const eventId = webhookData.eventId || webhookData.id || `${Date.now()}-${Math.random()}`;
    
    // Check if we've already processed this event
    const eventExists = await reservationService.webhookEventExists(eventId);
    if (eventExists) {
      console.log('Webhook event already processed:', eventId);
      return res.status(200).json({ message: 'Event already processed' });
    }

    // Log the webhook event to reservation_webhook_logs table
    const loggedEvent = await reservationService.logReservationWebhook(
      webhookData.booking?.id || webhookData.beds24BookingId,
      webhookData,
      false
    );

    try {
      // Process the webhook based on event type
      await processWebhookEvent(eventType, webhookData);
      
      // Mark event as processed (handle gracefully if column doesn't exist)
      if (loggedEvent) {
        try {
          await reservationService.markWebhookEventProcessed(loggedEvent.id);
        } catch (error) {
          console.log('Note: Webhook event processed successfully, but logging update failed (non-critical):', error.message);
        }
      }
      
      res.status(200).json({ message: 'Webhook processed successfully' });
    } catch (processingError) {
      console.error('Error processing webhook:', processingError);
      res.status(500).json({ error: 'Failed to process webhook' });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/events', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const { data: events, error } = await require('../config/supabase').supabaseAdmin
      .from('webhook_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    res.status(200).json({
      events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: events.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.status(500).json({ error: 'Failed to fetch webhook events' });
  }
});

// Process different types of webhook events
async function processWebhookEvent(eventType, webhookData) {
  console.log(`Processing webhook event: ${eventType}`);
  
  switch (eventType.toLowerCase()) {
    case 'booking_new':
    case 'booking_created':
    case 'new_booking':
      await handleNewBooking(webhookData);
      break;
      
    case 'booking_modified':
    case 'booking_updated':
    case 'booking_update':  // Add missing event type from Beds24
      await handleBookingUpdate(webhookData);
      break;
      
    case 'booking_cancelled':
    case 'booking_deleted':
      await handleBookingCancellation(webhookData);
      break;
      
    default:
      console.log(`Unhandled event type: ${eventType}`);
      // For unknown events, try to process as new booking first, 
      // then check if it's an update to existing reservation
      const bookingInfo = await beds24Service.processWebhookData(webhookData);
      const existingReservation = await reservationService.getReservationByBeds24Id(
        bookingInfo.beds24BookingId
      );
      
      if (existingReservation) {
        console.log(`Found existing reservation for ${eventType}, processing as booking update`);
        await handleBookingUpdate(webhookData);
      } else {
        console.log(`No existing reservation found for ${eventType}, processing as new booking`);
        await handleNewBooking(webhookData);
      }
  }

  // Process messages if they exist in the webhook data
  await processWebhookMessages(webhookData);
}

// Process messages from Beds24 webhook
async function processWebhookMessages(webhookData) {
  try {
    const messages = webhookData.messages;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('No messages found in webhook data');
      return;
    }

    console.log(`Processing ${messages.length} messages from webhook`);

    // Get booking information to find the reservation
    const booking = webhookData.booking || webhookData;
    const beds24BookingId = booking.id || booking.beds24BookingId;
    const apiSource = booking.apiSource || 'unknown';
    const channel = apiSource.toLowerCase();

    if (!beds24BookingId) {
      console.error('Cannot process messages: No booking ID found in webhook data');
      return;
    }

    // Find the reservation to get thread context
    const reservation = await reservationService.getReservationByBeds24Id(beds24BookingId.toString());
    
    if (!reservation) {
      console.error(`Cannot process messages: Reservation not found for Beds24 booking ID: ${beds24BookingId}`);
      return;
    }

    // Find or create communication thread for this reservation
    const thread = await communicationService.findOrCreateThreadByReservation(
      reservation.id,
      {
        channels: [{ channel, external_thread_id: beds24BookingId.toString() }]
      }
    );

    console.log(`Processing messages for thread: ${thread.id}, reservation: ${reservation.id}, channel: ${channel}`);

    // Process each message
    for (const message of messages) {
      try {
        await processIndividualMessage(message, thread.id, channel);
      } catch (messageError) {
        console.error('Error processing individual message:', {
          messageId: message.id,
          error: messageError.message
        });
        // Continue processing other messages even if one fails
      }
    }

    console.log(`Successfully processed ${messages.length} messages for reservation ${reservation.id}`);

  } catch (error) {
    console.error('Error processing webhook messages:', error);
    // Don't throw error to avoid breaking the main webhook processing
  }
}

// Process an individual message from Beds24
async function processIndividualMessage(message, threadId, channel) {
  // console.log('Processing message:', {
  //   id: message.id,
  //   source: message.source,
  //   time: message.time,
  //   read: message.read,
  //   channel: channel,
  //   content: message.message?.substring(0, 50) + '...'
  // });

  // Check if this is an echo of our outbound message (host source)
  if (message.source === 'host') {
    // console.log(`Checking for outbound message echo: ${message.id}`);
    
    try {
      // Look for recent outbound messages with matching content
      const recentOutbound = await communicationService.findRecentOutboundMessage(
        threadId,
        message.message || '',
        message.time
      );

      if (recentOutbound) {
        // This is an echo of our outbound message - backfill the provider_message_id
        // console.log(`Found matching outbound message ${recentOutbound.id} for webhook echo ${message.id}`);
        
        await communicationService.updateDeliveryProviderMessageId(
          recentOutbound.id,
          channel,
          message.id.toString()
        );

        // console.log(`Successfully backfilled provider_message_id ${message.id} for outbound message ${recentOutbound.id}, skipping duplicate creation`);
        return; // Skip creating duplicate message
      } else {
        // console.log(`No matching outbound message found for host message ${message.id}, processing as new message`);
      }
    } catch (echoError) {
      console.error('Error checking for outbound message echo:', echoError);
      // Continue with normal processing if echo detection fails
    }
  }

  // Map message source to origin role
  const originRole = message.source === 'guest' ? 'guest' : 'host';

  // Prepare message data for communication service
  const messageData = {
    thread_id: threadId,
    channel: channel, // Use dynamic channel from apiSource
    content: message.message || '',
    origin_role: originRole,
    provider_message_id: message.id.toString(),
    read: message.read || false
  };

  // Add message timestamp if available
  if (message.time) {
    messageData.sent_at = message.time;
  }

  // Receive the message through communication service
  const result = await communicationService.receiveMessage(messageData);

  if (result.duplicate) {
    // console.log(`Message ${message.id} already exists, skipping`);
    return;
  }

  // If message is marked as read, update delivery status
  if (message.read) {
    try {
      await communicationService.updateDeliveryStatus(
        result.id,
        channel,
        'read'
      );
      console.log(`Marked message ${result.id} as read`);
    } catch (readError) {
      console.error('Error updating message read status:', readError);
    }
  }

  // console.log(`Successfully processed message ${message.id} as message ${result.id}`);
}

// Handle new booking webhook
async function handleNewBooking(webhookData) {
  try {
    // Process webhook data to extract booking information with enhanced mapping
    const bookingInfo = await beds24Service.processWebhookData(webhookData);
    
    console.log('Processing new booking:', {
      beds24BookingId: bookingInfo.beds24BookingId,
      bookingFirstname: bookingInfo.bookingFirstname,
      propertyId: bookingInfo.propertyId,
      roomTypeId: bookingInfo.roomTypeId,
      roomUnitId: bookingInfo.roomUnitId
    });
    
    // Check if reservation already exists
    const existingReservation = await reservationService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (existingReservation) {
      console.log('Reservation already exists, updating with new data:', bookingInfo.beds24BookingId);
      
      // Update existing reservation with new data (handles extensions, modifications, etc.)
      const updatedReservation = await reservationService.updateReservation(
        existingReservation.id, 
        bookingInfo
      );
      
      console.log(`Updated existing reservation: ${updatedReservation.id} for Beds24 booking: ${bookingInfo.beds24BookingId}`);
      return;
    }

    // Validate required fields
    if (!bookingInfo.beds24BookingId) {
      console.error('Missing booking ID:', bookingInfo);
      throw new Error('Missing booking ID');
    }

    if (!bookingInfo.checkInDate || !bookingInfo.checkOutDate) {
      console.error('Missing check-in or check-out dates:', bookingInfo);
      throw new Error('Missing check-in or check-out dates');
    }

    // Create new reservation in database with complete field mapping
    const reservation = await reservationService.createReservation(bookingInfo);
    
    console.log(`Created new reservation: ${reservation.id} for Beds24 booking: ${bookingInfo.beds24BookingId}`);
    
    // Process automation rules for the new reservation
    try {
      await automationService.processReservationAutomation(reservation, false);
      console.log(`Automation processing completed for new reservation: ${reservation.id}`);
    } catch (automationError) {
      console.error(`Error processing automation for new reservation ${reservation.id}:`, automationError);
      // Don't throw error - automation failure shouldn't break webhook processing
    }
    
  } catch (error) {
    console.error('Error handling new booking:', error);
    throw error;
  }
}

// Handle booking update webhook
async function handleBookingUpdate(webhookData) {
  try {
    // Process webhook data with enhanced mapping
    const bookingInfo = await beds24Service.processWebhookData(webhookData);
    
    console.log('Processing booking update:', {
      beds24BookingId: bookingInfo.beds24BookingId,
      bookingFirstname: bookingInfo.bookingFirstname,
      checkInDate: bookingInfo.checkInDate,
      checkOutDate: bookingInfo.checkOutDate
    });
    
    // Find existing reservation
    const existingReservation = await reservationService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (!existingReservation) {
      console.log('Reservation not found, treating as new booking');
      await handleNewBooking(webhookData);
      return;
    }

    // Update reservation with new data
    const updatedReservation = await reservationService.updateReservation(
      existingReservation.id, 
      bookingInfo
    );
    
    console.log(`Updated reservation: ${updatedReservation.id} for Beds24 booking: ${bookingInfo.beds24BookingId}`);
    
    // Process automation rules for the updated reservation (will cancel existing and reschedule)
    try {
      await automationService.processReservationAutomation(updatedReservation, true);
      console.log(`Automation processing completed for updated reservation: ${updatedReservation.id}`);
    } catch (automationError) {
      console.error(`Error processing automation for updated reservation ${updatedReservation.id}:`, automationError);
      // Don't throw error - automation failure shouldn't break webhook processing
    }
    
  } catch (error) {
    console.error('Error handling booking update:', error);
    throw error;
  }
}

// Handle booking cancellation webhook
async function handleBookingCancellation(webhookData) {
  try {
    // Process webhook data to get booking ID
    const bookingInfo = await beds24Service.processWebhookData(webhookData);
    
    console.log('Processing booking cancellation:', {
      beds24BookingId: bookingInfo.beds24BookingId
    });
    
    // Find existing reservation
    const existingReservation = await reservationService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (existingReservation) {
      // Update status to cancelled
      await reservationService.updateReservationStatus(existingReservation.id, 'cancelled');
      console.log(`Cancelled reservation: ${existingReservation.id} for Beds24 booking: ${bookingInfo.beds24BookingId}`);
      
      // Cancel any pending scheduled messages for this reservation
      try {
        await automationService.handleReservationCancellation(existingReservation.id);
        console.log(`Cancelled scheduled messages for reservation: ${existingReservation.id}`);
      } catch (automationError) {
        console.error(`Error cancelling scheduled messages for reservation ${existingReservation.id}:`, automationError);
        // Don't throw error - automation failure shouldn't break webhook processing
      }
    } else {
      console.log(`Reservation not found for cancellation: ${bookingInfo.beds24BookingId}`);
    }
    
  } catch (error) {
    console.error('Error handling booking cancellation:', error);
    throw error;
  }
}

// Stripe webhook endpoint
router.post('/stripe', async (req, res) => {
  try {
    console.log('Received Stripe webhook');
    
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!endpointSecret) {
      console.warn('STRIPE_WEBHOOK_SECRET not configured - webhook NOT verified');
    }

    let event;
    
    if (endpointSecret) {
      try {
        // req.body is a Buffer here because of express.raw
        event = stripeService.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }
    } else {
      // For local testing without verification:
      event = JSON.parse(req.body.toString('utf8'));
    }

    console.log('Stripe event:', event.id, event.type);

    // Idempotency guard (recommended to prevent duplicate processing)
    const alreadyHandled = await stripeService.hasProcessedEvent(event.id);
    if (alreadyHandled) {
      console.log('Event already processed:', event.id);
      return res.status(200).json({ received: true, duplicate: true });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        // Mark paid only if the session is paid
        const session = event.data.object;
        await stripeService.handleCheckoutSessionCompleted(session);
        break;
      }
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        await stripeService.handlePaymentSuccess(pi);
        break;
      }
      case 'payment_intent.payment_failed': {
        await stripeService.handlePaymentFailure(event.data.object);
        break;
      }
      case 'payment_intent.canceled': {
        await stripeService.handlePaymentCanceled(event.data.object);
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    // Mark event stored AFTER successful handling
    await stripeService.markEventProcessed(event.id);

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Test endpoint for webhook testing
router.post('/test', async (req, res) => {
  try {
    console.log('Test webhook received:', req.body);
    
    // Create a test booking
    const testBooking = {
      beds24BookingId: `test-${Date.now()}`,
      guestName: 'Test Guest',
      guestEmail: 'test@example.com',
      checkInDate: new Date().toISOString().split('T')[0],
      checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      roomNumber: '101',
      numGuests: 1,
      totalAmount: 100,
      currency: 'JPY'
    };
    
    await handleNewBooking({ booking: testBooking });
    
    res.status(200).json({ 
      message: 'Test webhook processed successfully',
      testBooking 
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
