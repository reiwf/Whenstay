const express = require('express');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const reservationService = require('../services/reservationService');
const { adminAuth } = require('../middleware/auth');

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


// Manual Beds24 sync with authentication
router.post('/sync/beds24', adminAuth, async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;

    console.log(`Starting manual sync of Beds24 bookings (${daysBack} days back)`);

    const bookings = await beds24Service.syncRecentBookings(daysBack);

    let processedCount = 0;
    let errorCount = 0;

    for (const booking of bookings) {
      try {
        const existingReservation = await reservationService.getReservationByBeds24Id(
          booking.beds24BookingId
        );

        if (!existingReservation) {
          await reservationService.createReservation(booking);
          processedCount++;
        }
      } catch (error) {
        console.error('Error processing booking:', booking.beds24BookingId, error);
        errorCount++;
      }
    }

    res.status(200).json({
      message: 'Beds24 sync completed',
      totalBookings: bookings.length,
      processedCount,
      errorCount,
      skippedCount: bookings.length - processedCount - errorCount
    });
  } catch (error) {
    console.error('Error syncing Beds24 bookings:', error);
    res.status(500).json({ error: 'Failed to sync Beds24 bookings' });
  }
});

// Get all reservations with filters
router.get('/', adminAuth, async (req, res) => {
  try {
    const {
      status,
      propertyId,
      roomTypeId,
      checkInDate,
      checkInDateFrom,
      checkInDateTo,
      includeCancelled,
      page = 1,
      limit = 15,
      sortBy = 'check_in_date',
      sortOrder = 'desc'
    } = req.query;

    // Smart date defaulting: if no date filters provided, default to today's check-ins for performance
    let dateFilters = {};
    if (checkInDate) {
      dateFilters.checkInDate = checkInDate;
    } else if (checkInDateFrom || checkInDateTo) {
      if (checkInDateFrom) dateFilters.checkInDateFrom = checkInDateFrom;
      if (checkInDateTo) dateFilters.checkInDateTo = checkInDateTo;
    } else {
      // No date filters provided - default to today for performance
      dateFilters.checkInDate = new Date().toISOString().split('T')[0];
    }

    const filters = {
      status,
      propertyId,
      roomTypeId,
      ...dateFilters,
      includeCancelled: includeCancelled === 'true',
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sortBy,
      sortOrder
    };

    const reservations = await reservationService.getReservationsWithFullDetails(filters);

    res.status(200).json({
      message: 'Reservations retrieved successfully',
      data: {
        reservations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: reservations.length === parseInt(limit)
        }
      },
      filters: {
        status,
        propertyId,
        roomTypeId,
        checkInDate: dateFilters.checkInDate,
        checkInDateFrom: dateFilters.checkInDateFrom,
        checkInDateTo: dateFilters.checkInDateTo,
        sortBy,
        sortOrder,
        appliedDefaultToday: !checkInDate && !checkInDateFrom && !checkInDateTo
      }
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// Get specific reservation details
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await reservationService.getReservationFullDetails(id);

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    res.status(200).json({
      message: 'Reservation details retrieved successfully',
      data: {
        reservation
      }
    });
  } catch (error) {
    console.error('Error fetching reservation details:', error);
    res.status(500).json({ error: 'Failed to fetch reservation details' });
  }
});

// Update reservation (booking info only - guest info uses separate endpoints)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('PUT /reservations/:id - Received data:', { id, updateData });

    // Check if reservation exists
    const existingReservation = await reservationService.getReservationFullDetails(id);
    if (!existingReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    console.log('Existing reservation found:', existingReservation.id);

    // Prepare booking information updates (non-guest fields only)
    const reservationUpdateData = {};

    // Booking contact information (kept in reservations table)
    if (updateData.bookingFirstname !== undefined) reservationUpdateData.bookingFirstname = updateData.bookingFirstname;
    if (updateData.bookingLastname !== undefined) reservationUpdateData.bookingLastname = updateData.bookingLastname;
    if (updateData.bookingEmail !== undefined) reservationUpdateData.bookingEmail = updateData.bookingEmail;
    if (updateData.bookingPhone !== undefined) reservationUpdateData.bookingPhone = updateData.bookingPhone;

    // Reservation details
    if (updateData.checkInDate !== undefined) reservationUpdateData.checkInDate = updateData.checkInDate;
    if (updateData.checkOutDate !== undefined) reservationUpdateData.checkOutDate = updateData.checkOutDate;
    if (updateData.numGuests !== undefined) reservationUpdateData.numGuests = updateData.numGuests;
    if (updateData.numAdults !== undefined) reservationUpdateData.numAdults = updateData.numAdults;
    if (updateData.numChildren !== undefined) reservationUpdateData.numChildren = updateData.numChildren;
    if (updateData.totalAmount !== undefined) reservationUpdateData.totalAmount = updateData.totalAmount;
    if (updateData.price !== undefined) reservationUpdateData.price = updateData.price;
    if (updateData.commission !== undefined) reservationUpdateData.commission = updateData.commission;
    if (updateData.currency !== undefined) reservationUpdateData.currency = updateData.currency;
    if (updateData.status !== undefined) reservationUpdateData.status = updateData.status;
    if (updateData.beds24BookingId !== undefined) reservationUpdateData.beds24BookingId = updateData.beds24BookingId;
    if (updateData.specialRequests !== undefined) reservationUpdateData.specialRequests = updateData.specialRequests;
    if (updateData.bookingSource !== undefined) reservationUpdateData.bookingSource = updateData.bookingSource;
    if (updateData.comments !== undefined) reservationUpdateData.comments = updateData.comments;

    // Beds24 specific fields
    if (updateData.apiReference !== undefined) reservationUpdateData.apiReference = updateData.apiReference;
    if (updateData.rateDescription !== undefined) reservationUpdateData.rateDescription = updateData.rateDescription;
    if (updateData.apiMessage !== undefined) reservationUpdateData.apiMessage = updateData.apiMessage;
    if (updateData.bookingTime !== undefined) reservationUpdateData.bookingTime = updateData.bookingTime;
    if (updateData.timeStamp !== undefined) reservationUpdateData.timeStamp = updateData.timeStamp;
    if (updateData.lang !== undefined) reservationUpdateData.lang = updateData.lang;

    // Room assignment
    if (updateData.propertyId !== undefined) reservationUpdateData.propertyId = updateData.propertyId;
    if (updateData.roomTypeId !== undefined) reservationUpdateData.roomTypeId = updateData.roomTypeId;
    if (updateData.roomUnitId !== undefined) reservationUpdateData.roomUnitId = updateData.roomUnitId;

    // Access read flag (kept in reservations table)
    if (updateData.accessRead !== undefined) reservationUpdateData.accessRead = updateData.accessRead;

    console.log('Mapped reservation update data:', reservationUpdateData);

    // Update reservation using service
    const updatedReservation = await reservationService.updateReservation(id, reservationUpdateData);

    console.log('Reservation updated successfully:', updatedReservation.id);

    res.status(200).json({
      message: 'Reservation updated successfully',
      reservation: updatedReservation
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({
      error: 'Failed to update reservation',
      details: error.message
    });
  }
});

// Create or update guest information
router.put('/:id/guests/:guestNumber', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, guestNumber } = req.params;
    const guestInfo = req.body;

    console.log('PUT /reservations/:id/guests/:guestNumber - Received data:', { reservationId, guestNumber, guestInfo });

    // Validate guest number
    const guestNum = parseInt(guestNumber);
    if (isNaN(guestNum) || guestNum < 1) {
      return res.status(400).json({ error: 'Invalid guest number. Must be a positive integer.' });
    }

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Validate guest number against num_guests
    if (guestNum > (reservation.num_guests || 1)) {
      return res.status(400).json({ 
        error: `Guest number ${guestNum} exceeds reservation capacity of ${reservation.num_guests || 1} guests` 
      });
    }

    // Create or update guest using new service method
    const guestData = await reservationService.createOrUpdateGuest(reservationId, guestNum, guestInfo);

    // Get updated completion status
    const completionStatus = await reservationService.validateAllGuestsComplete(reservationId);

    res.status(200).json({
      message: 'Guest information updated successfully',
      data: {
        guest: guestData,
        completion: completionStatus
      }
    });
  } catch (error) {
    console.error('Error updating guest information:', error);
    res.status(500).json({
      error: 'Failed to update guest information',
      details: error.message
    });
  }
});

// Get all guests for a reservation
router.get('/:id/guests', adminAuth, async (req, res) => {
  try {
    const { id: reservationId } = req.params;

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Get all guests for this reservation
    const guests = await reservationService.getReservationGuests(reservationId);
    
    // Get completion status
    const completionStatus = await reservationService.validateAllGuestsComplete(reservationId);

    res.status(200).json({
      message: 'Guests retrieved successfully',
      data: {
        guests,
        completion: completionStatus,
        reservation: {
          id: reservation.id,
          booking_name: reservation.booking_name,
          num_guests: reservation.num_guests
        }
      }
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({
      error: 'Failed to fetch guests',
      details: error.message
    });
  }
});

// Get specific guest by number
router.get('/:id/guests/:guestNumber', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, guestNumber } = req.params;

    // Validate guest number
    const guestNum = parseInt(guestNumber);
    if (isNaN(guestNum) || guestNum < 1) {
      return res.status(400).json({ error: 'Invalid guest number. Must be a positive integer.' });
    }

    // Get specific guest
    const guest = await reservationService.getGuestByNumber(reservationId, guestNum);
    
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    res.status(200).json({
      message: 'Guest retrieved successfully',
      data: { guest }
    });
  } catch (error) {
    console.error('Error fetching guest:', error);
    res.status(500).json({
      error: 'Failed to fetch guest',
      details: error.message
    });
  }
});

// Create new reservation
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      bookingFirstname,
      bookingLastname,
      bookingEmail,
      checkInDate,
      checkOutDate,
      roomNumber,
      numGuests,
      totalAmount,
      currency,
      phoneNumber,
      beds24BookingId
    } = req.body;

    if (!(bookingFirstname) || !bookingEmail || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Guest first name, email, check-in date, and check-out date are required' });
    }

    const reservationData = {
      bookingFirstname: bookingFirstname || null,
      bookingLastname: bookingLastname || null,
      bookingEmail: bookingEmail || null,
      bookingPhone: phoneNumber || null,
      checkInDate,
      checkOutDate,
      roomNumber: roomNumber || 'TBD',
      numGuests: numGuests || 1,
      totalAmount: totalAmount || 0,
      currency: currency || 'JPY',
      beds24BookingId: beds24BookingId || `MANUAL-${Date.now()}`
    };

    const reservation = await reservationService.createReservation(reservationData);

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// Send check-in invitation email
router.post('/:reservationId/send-invitation', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = await reservationService.getReservationById(reservationId);

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const emailService = require('../services/emailService');
    await emailService.sendCheckinInvitation(
      reservation.booking_email,
      reservation.booking_name,
      reservation.check_in_token,
      reservation.check_in_date
    );

    res.status(200).json({ message: 'Check-in invitation sent successfully' });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

module.exports = router;
