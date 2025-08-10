const express = require('express');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const reservationService = require('../services/reservationService');
const emailService = require('../services/emailService');
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
      await handleBookingUpdate(webhookData);
      break;
      
    case 'booking_cancelled':
    case 'booking_deleted':
      await handleBookingCancellation(webhookData);
      break;
      
    default:
      console.log(`Unhandled event type: ${eventType}`);
      // For unknown events, try to process as a new booking
      await handleNewBooking(webhookData);
  }
}

// Handle new booking webhook
async function handleNewBooking(webhookData) {
  try {
    // Process webhook data to extract booking information with enhanced mapping
    const bookingInfo = await beds24Service.processWebhookData(webhookData);
    
    console.log('Processing new booking:', {
      beds24BookingId: bookingInfo.beds24BookingId,
      bookingName: bookingInfo.bookingName,
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
      bookingName: bookingInfo.bookingName,
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
    } else {
      console.log(`Reservation not found for cancellation: ${bookingInfo.beds24BookingId}`);
    }
    
  } catch (error) {
    console.error('Error handling booking cancellation:', error);
    throw error;
  }
}

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
