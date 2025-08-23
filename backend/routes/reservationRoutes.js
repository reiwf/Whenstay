const express = require('express');
const router = express.Router();
const beds24Service = require('../services/beds24Service');
const reservationService = require('../services/reservationService');
const guestServicesService = require('../services/guestServicesService');
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

// GUEST SERVICES ADMIN ENDPOINTS

// Get all services (available and enabled) for a reservation
router.get('/:id/services', adminAuth, async (req, res) => {
  try {
    const { id: reservationId } = req.params;

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Get all services and their status for this reservation
    const allServices = await guestServicesService.getAllServices();
    const enabledServices = await guestServicesService.getEnabledServicesForReservation(reservationId);
    const purchasedServices = await guestServicesService.getPurchasedServicesForReservation(reservationId);

    // Combine the data
    const servicesWithStatus = allServices.map(service => {
      const enabled = enabledServices.find(e => e.service_id === service.id);
      const purchased = purchasedServices.find(p => p.service_id === service.id);

      return {
        ...service,
        is_enabled: !!enabled,
        enabled_at: enabled?.enabled_at || null,
        enabled_by: enabled?.enabled_by || null,
        is_purchased: !!purchased,
        purchased_at: purchased?.purchased_at || null,
        purchase_amount: purchased?.amount || null,
        stripe_payment_intent_id: purchased?.stripe_payment_intent_id || null,
        can_enable: service.is_active && service.admin_approval_required
      };
    });

    res.status(200).json({
      message: 'Services retrieved successfully',
      data: {
        reservation: {
          id: reservation.id,
          booking_name: reservation.booking_name,
          check_in_date: reservation.check_in_date,
          check_out_date: reservation.check_out_date,
          status: reservation.status
        },
        services: servicesWithStatus
      }
    });
  } catch (error) {
    console.error('Error fetching reservation services:', error);
    res.status(500).json({ error: 'Failed to fetch reservation services' });
  }
});

// Enable a service for a reservation
router.post('/:id/services/:serviceId/enable', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;
    const { enabled_by } = req.body; // Admin user ID who enabled the service

    // Validate service ID
    const serviceIdNum = parseInt(serviceId);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if service exists and requires admin approval
    const service = await guestServicesService.getServiceById(serviceIdNum);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    if (!service.admin_approval_required) {
      return res.status(400).json({ 
        error: 'This service does not require admin approval and is automatically available' 
      });
    }

    if (!service.is_active) {
      return res.status(400).json({ error: 'Service is not active' });
    }

    // Enable the service for the reservation
    const result = await guestServicesService.enableServiceForReservation(
      reservationId,
      serviceIdNum,
      enabled_by || null
    );

    res.status(200).json({
      message: 'Service enabled successfully',
      data: {
        reservation_id: reservationId,
        service_id: serviceIdNum,
        service_name: service.name,
        enabled_at: result.enabled_at,
        enabled_by: result.enabled_by
      }
    });
  } catch (error) {
    console.error('Error enabling service for reservation:', error);
    if (error.message.includes('already enabled')) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to enable service for reservation' });
    }
  }
});

// Disable a service for a reservation
router.delete('/:id/services/:serviceId/enable', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;

    // Validate service ID
    const serviceIdNum = parseInt(serviceId);
    if (isNaN(serviceIdNum)) {
      return res.status(400).json({ error: 'Invalid service ID' });
    }

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Check if service is enabled for this reservation
    const enabledServices = await guestServicesService.getEnabledServicesForReservation(reservationId);
    const enabledService = enabledServices.find(s => s.service_id === serviceIdNum);

    if (!enabledService) {
      return res.status(404).json({ error: 'Service is not enabled for this reservation' });
    }

    // Check if service has been purchased
    const purchasedServices = await guestServicesService.getPurchasedServicesForReservation(reservationId);
    const purchasedService = purchasedServices.find(s => s.service_id === serviceIdNum);

    if (purchasedService) {
      return res.status(400).json({ 
        error: 'Cannot disable service that has already been purchased by the guest' 
      });
    }

    // Disable the service
    const result = await guestServicesService.disableServiceForReservation(reservationId, serviceIdNum);

    res.status(200).json({
      message: 'Service disabled successfully',
      data: {
        reservation_id: reservationId,
        service_id: serviceIdNum,
        disabled_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error disabling service for reservation:', error);
    res.status(500).json({ error: 'Failed to disable service for reservation' });
  }
});

// Get purchased services for a reservation (admin view)
router.get('/:id/services/purchased', adminAuth, async (req, res) => {
  try {
    const { id: reservationId } = req.params;

    // Check if reservation exists
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Get purchased services with full details
    const purchasedServices = await guestServicesService.getPurchasedServicesForReservation(reservationId);

    // Calculate total amount and effective times
    const totalAmount = purchasedServices.reduce((sum, service) => sum + (service.amount || 0), 0);
    
    // Get effective times with service overrides
    const effectiveTimes = await guestServicesService.calculateEffectiveTimes(
      reservationId,
      reservation.check_in_date,
      reservation.check_out_date,
      reservation.access_time,
      reservation.departure_time || '11:00:00'
    );

    res.status(200).json({
      message: 'Purchased services retrieved successfully',
      data: {
        reservation: {
          id: reservation.id,
          booking_name: reservation.booking_name,
          check_in_date: reservation.check_in_date,
          check_out_date: reservation.check_out_date,
          original_access_time: reservation.access_time,
          original_departure_time: reservation.departure_time || '10:00:00'
        },
        purchased_services: purchasedServices,
        summary: {
          total_services: purchasedServices.length,
          total_amount: totalAmount,
          currency: purchasedServices[0]?.currency || 'JPY',
          effective_access_time: effectiveTimes.accessTime,
          effective_departure_time: effectiveTimes.departureTime,
          time_modifications: {
            access_time_changed: effectiveTimes.accessTime !== reservation.access_time,
            departure_time_changed: effectiveTimes.departureTime !== (reservation.departure_time || '10:00:00')
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching purchased services:', error);
    res.status(500).json({ error: 'Failed to fetch purchased services' });
  }
});

// Get all available services (admin management)
router.get('/services/all', adminAuth, async (req, res) => {
  try {
    const services = await guestServicesService.getAllServices();

    res.status(200).json({
      message: 'All services retrieved successfully',
      data: {
        services
      }
    });
  } catch (error) {
    console.error('Error fetching all services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

module.exports = router;
