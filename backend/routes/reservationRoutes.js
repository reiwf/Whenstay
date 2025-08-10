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
    const reservation = await reservationService.createReservation(testReservation);
    
    // Update status to invited
    await reservationService.updateReservationStatus(reservation.id, 'invited');
    
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

// Update reservation
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('PUT /reservations/:id - Received data:', { id, updateData });

    const { data: existingReservation, error: fetchError } = await require('../config/supabase').supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching existing reservation:', fetchError);
      return res.status(404).json({ error: 'Reservation not found', details: fetchError.message });
    }

    if (!existingReservation) {
      console.error('Reservation not found for ID:', id);
      return res.status(404).json({ error: 'Reservation not found' });
    }

    console.log('Existing reservation found:', existingReservation.id);

    const reservationUpdateData = {};

    if (updateData.bookingName !== undefined) reservationUpdateData.booking_name = updateData.bookingName;
    if (updateData.bookingEmail !== undefined) reservationUpdateData.booking_email = updateData.bookingEmail;
    if (updateData.bookingPhone !== undefined) reservationUpdateData.booking_phone = updateData.bookingPhone;
    if (updateData.bookingLastname !== undefined) reservationUpdateData.booking_lastname = updateData.bookingLastname;

    if (updateData.guestName !== undefined) reservationUpdateData.booking_name = updateData.guestName;
    if (updateData.guestEmail !== undefined) reservationUpdateData.booking_email = updateData.guestEmail;
    if (updateData.phoneNumber !== undefined) reservationUpdateData.booking_phone = updateData.phoneNumber;

    if (updateData.checkInDate !== undefined) reservationUpdateData.check_in_date = updateData.checkInDate;
    if (updateData.checkOutDate !== undefined) reservationUpdateData.check_out_date = updateData.checkOutDate;
    if (updateData.numGuests !== undefined) reservationUpdateData.num_guests = updateData.numGuests;
    if (updateData.numAdults !== undefined) reservationUpdateData.num_adults = updateData.numAdults;
    if (updateData.numChildren !== undefined) reservationUpdateData.num_children = updateData.numChildren;
    if (updateData.totalAmount !== undefined) reservationUpdateData.total_amount = updateData.totalAmount;
    if (updateData.price !== undefined) reservationUpdateData.price = updateData.price;
    if (updateData.commission !== undefined) reservationUpdateData.commission = updateData.commission;
    if (updateData.currency !== undefined) reservationUpdateData.currency = updateData.currency;
    if (updateData.status !== undefined) reservationUpdateData.status = updateData.status;
    if (updateData.beds24BookingId !== undefined) reservationUpdateData.beds24_booking_id = updateData.beds24BookingId;
    if (updateData.specialRequests !== undefined) reservationUpdateData.special_requests = updateData.specialRequests;
    if (updateData.bookingSource !== undefined) reservationUpdateData.booking_source = updateData.bookingSource;
    if (updateData.comments !== undefined) reservationUpdateData.comments = updateData.comments;

    if (updateData.apiReference !== undefined) reservationUpdateData.apiReference = updateData.apiReference;
    if (updateData.rateDescription !== undefined) reservationUpdateData.rateDescription = updateData.rateDescription;
    if (updateData.apiMessage !== undefined) reservationUpdateData.apiMessage = updateData.apiMessage;
    if (updateData.bookingTime !== undefined) reservationUpdateData.bookingTime = updateData.bookingTime;
    if (updateData.timeStamp !== undefined) reservationUpdateData.timeStamp = updateData.timeStamp;
    if (updateData.lang !== undefined) reservationUpdateData.lang = updateData.lang;

    if (updateData.propertyId !== undefined) reservationUpdateData.property_id = updateData.propertyId;
    if (updateData.roomTypeId !== undefined) reservationUpdateData.room_type_id = updateData.roomTypeId;
    if (updateData.roomUnitId !== undefined) reservationUpdateData.room_unit_id = updateData.roomUnitId;

    if (updateData.guestFirstname !== undefined) reservationUpdateData.guest_firstname = updateData.guestFirstname;
    if (updateData.guestLastname !== undefined) reservationUpdateData.guest_lastname = updateData.guestLastname;
    if (updateData.guestMail !== undefined) reservationUpdateData.guest_mail = updateData.guestMail;
    if (updateData.guestPersonalEmail !== undefined) reservationUpdateData.guest_mail = updateData.guestPersonalEmail;
    if (updateData.guestContact !== undefined) reservationUpdateData.guest_contact = updateData.guestContact;
    if (updateData.guestAddress !== undefined) reservationUpdateData.guest_address = updateData.guestAddress;
    if (updateData.estimatedCheckinTime !== undefined) reservationUpdateData.estimated_checkin_time = updateData.estimatedCheckinTime;
    if (updateData.travelPurpose !== undefined) reservationUpdateData.travel_purpose = updateData.travelPurpose;
    if (updateData.emergencyContactName !== undefined) reservationUpdateData.emergency_contact_name = updateData.emergencyContactName;
    if (updateData.emergencyContactPhone !== undefined) reservationUpdateData.emergency_contact_phone = updateData.emergencyContactPhone;
    if (updateData.passportUrl !== undefined) reservationUpdateData.passport_url = updateData.passportUrl;
    if (updateData.agreementAccepted !== undefined) reservationUpdateData.agreement_accepted = updateData.agreementAccepted;
    if (updateData.adminVerified !== undefined) reservationUpdateData.admin_verified = updateData.adminVerified;
    if (updateData.accessRead !== undefined) reservationUpdateData.access_read = updateData.accessRead;

    console.log('Mapped update data:', reservationUpdateData);

    const { data: updatedReservation, error: updateError } = await require('../config/supabase').supabaseAdmin
      .from('reservations')
      .update(reservationUpdateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return res.status(500).json({
        error: 'Failed to update reservation',
        details: updateError.message,
        code: updateError.code
      });
    }

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

// Create new reservation
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      guestName,
      guestEmail,
      checkInDate,
      checkOutDate,
      roomNumber,
      numGuests,
      totalAmount,
      currency,
      phoneNumber,
      beds24BookingId
    } = req.body;

    if (!guestName || !guestEmail || !checkInDate || !checkOutDate) {
      return res.status(400).json({ error: 'Guest name, email, check-in date, and check-out date are required' });
    }

    const reservationData = {
      guestName,
      guestEmail,
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
