const express = require('../$node_modules/express/index.js');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const databaseService = require('../services/databaseService');
const emailService = require('../services/emailService');

// Middleware to capture raw body for webhook signature verification
const captureRawBody = (req, res, next) => {
  req.rawBody = '';
  req.on('data', chunk => {
    req.rawBody += chunk;
  });
  req.on('end', () => {
    next();
  });
};

// Beds24 webhook endpoint
router.post('/beds24', captureRawBody, async (req, res) => {
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
    const eventExists = await databaseService.webhookEventExists(eventId);
    if (eventExists) {
      console.log('Webhook event already processed:', eventId);
      return res.status(200).json({ message: 'Event already processed' });
    }

    // Log the webhook event
    const loggedEvent = await databaseService.logWebhookEvent(
      eventType,
      eventId,
      webhookData,
      false
    );

    try {
      // Process the webhook based on event type
      await processWebhookEvent(eventType, webhookData);
      
      // Mark event as processed
      if (loggedEvent) {
        await databaseService.markWebhookEventProcessed(loggedEvent.id);
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
    // Process webhook data to extract booking information
    const bookingInfo = beds24Service.processWebhookData(webhookData);
    
    console.log('Processing new booking:', bookingInfo);
    
    // Check if reservation already exists
    const existingReservation = await databaseService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (existingReservation) {
      console.log('Reservation already exists:', bookingInfo.beds24BookingId);
      return;
    }

    // Validate required fields
    if (!bookingInfo.guestEmail || !bookingInfo.guestName) {
      console.error('Missing required guest information:', bookingInfo);
      throw new Error('Missing required guest information');
    }

    // Create reservation in database
    const reservation = await databaseService.createReservation(bookingInfo);
    
    // Update status to invited
    await databaseService.updateReservationStatus(reservation.id, 'invited');
    
    // Send check-in invitation email
    await emailService.sendCheckinInvitation(
      bookingInfo.guestEmail,
      bookingInfo.guestName,
      reservation.check_in_token,
      bookingInfo.checkInDate
    );
    
    console.log(`Check-in invitation sent for reservation: ${reservation.id}`);
    
  } catch (error) {
    console.error('Error handling new booking:', error);
    throw error;
  }
}

// Handle booking update webhook
async function handleBookingUpdate(webhookData) {
  try {
    const bookingInfo = beds24Service.processWebhookData(webhookData);
    
    console.log('Processing booking update:', bookingInfo);
    
    // Find existing reservation
    const existingReservation = await databaseService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (!existingReservation) {
      console.log('Reservation not found, treating as new booking');
      await handleNewBooking(webhookData);
      return;
    }

    // Update reservation details if needed
    // For now, we'll just log the update
    console.log('Booking update processed for reservation:', existingReservation.id);
    
  } catch (error) {
    console.error('Error handling booking update:', error);
    throw error;
  }
}

// Handle booking cancellation webhook
async function handleBookingCancellation(webhookData) {
  try {
    const bookingInfo = beds24Service.processWebhookData(webhookData);
    
    console.log('Processing booking cancellation:', bookingInfo);
    
    // Find existing reservation
    const existingReservation = await databaseService.getReservationByBeds24Id(
      bookingInfo.beds24BookingId
    );
    
    if (existingReservation) {
      // Update status to cancelled
      await databaseService.updateReservationStatus(existingReservation.id, 'cancelled');
      console.log('Reservation cancelled:', existingReservation.id);
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
      currency: 'USD'
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
