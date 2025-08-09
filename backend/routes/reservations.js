const express = require('express');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const databaseService = require('../services/databaseService');

// Get reservations from Beds24 (for testing/debugging)
router.get('/beds24', async (req, res) => {
  try {
    const { checkIn, checkOut, limit = 10 } = req.query;
    
    const params = {};
    if (checkIn) params.checkIn = checkIn;
    if (checkOut) params.checkOut = checkOut;
    
    const bookings = await beds24Service.getBookings(params);
    
    // Limit results for testing
    const limitedBookings = bookings.slice(0, parseInt(limit));
    
    res.status(200).json({
      message: 'Bookings fetched from Beds24',
      count: limitedBookings.length,
      total: bookings.length,
      bookings: limitedBookings
    });
  } catch (error) {
    console.error('Error fetching Beds24 bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings from Beds24' });
  }
});

// Get specific booking from Beds24
router.get('/beds24/:bookingId', async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await beds24Service.getBooking(bookingId);
    
    res.status(200).json({
      message: 'Booking fetched from Beds24',
      booking
    });
  } catch (error) {
    console.error('Error fetching Beds24 booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking from Beds24' });
  }
});

// Sync recent bookings from Beds24
router.post('/sync', async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;
    
    console.log(`Syncing Beds24 bookings (${daysBack} days back)`);
    
    const bookings = await beds24Service.syncRecentBookings(daysBack);
    
    let processedCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const booking of bookings) {
      try {
        // Check if reservation already exists
        const existingReservation = await databaseService.getReservationByBeds24Id(
          booking.beds24BookingId
        );
        
        if (!existingReservation) {
          const reservation = await databaseService.createReservation(booking);
          
          // Update status to invited and send email
          await databaseService.updateReservationStatus(reservation.id, 'invited');
          
          // Send check-in invitation
          const emailService = require('../services/emailService');
          await emailService.sendCheckinInvitation(
            booking.guestEmail,
            booking.guestName,
            reservation.check_in_token,
            booking.checkInDate
          );
          
          processedCount++;
        }
      } catch (error) {
        console.error('Error processing booking:', booking.beds24BookingId, error);
        errorCount++;
        errors.push({
          bookingId: booking.beds24BookingId,
          error: error.message
        });
      }
    }
    
    res.status(200).json({
      message: 'Beds24 sync completed',
      totalBookings: bookings.length,
      processedCount,
      errorCount,
      skippedCount: bookings.length - processedCount - errorCount,
      errors: errors.slice(0, 5) // Return first 5 errors
    });
  } catch (error) {
    console.error('Error syncing Beds24 bookings:', error);
    res.status(500).json({ error: 'Failed to sync Beds24 bookings' });
  }
});

// Test endpoint to create a sample reservation
router.post('/test', async (req, res) => {
  try {
    const testReservation = {
      beds24BookingId: `test-${Date.now()}`,
      guestName: req.body.guestName || 'Test Guest',
      guestEmail: req.body.guestEmail || 'test@example.com',
      checkInDate: req.body.checkInDate || new Date().toISOString().split('T')[0],
      checkOutDate: req.body.checkOutDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      roomNumber: req.body.roomNumber || '101',
      numGuests: req.body.numGuests || 1,
      totalAmount: req.body.totalAmount || 100,
      currency: req.body.currency || 'JPY'
    };
    
    // Create reservation
    const reservation = await databaseService.createReservation(testReservation);
    
    // Update status to invited
    await databaseService.updateReservationStatus(reservation.id, 'invited');
    
    // Send check-in invitation
    const emailService = require('../services/emailService');
    await emailService.sendCheckinInvitation(
      testReservation.guestEmail,
      testReservation.guestName,
      reservation.check_in_token,
      testReservation.checkInDate
    );
    
    res.status(201).json({
      message: 'Test reservation created successfully',
      reservation: {
        id: reservation.id,
        checkinToken: reservation.check_in_token,
        checkinUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/checkin/${reservation.check_in_token}`
      }
    });
  } catch (error) {
    console.error('Error creating test reservation:', error);
    res.status(500).json({ error: 'Failed to create test reservation' });
  }
});

module.exports = router;


