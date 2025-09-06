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

/**
 * GET /api/reservations/beds24-bookings
 * Get bookings from Beds24 API and process them to save reservations to database
 * Query params: propertyId (required), arrival (required), arrivalTo (optional), processAndSave (optional)
 */
router.get('/beds24-bookings', adminAuth, async (req, res) => {
  try {
    const { propertyId, arrival, arrivalTo, processAndSave } = req.query;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
    }

    if (!arrival) {
      return res.status(400).json({
        success: false,
        error: 'Arrival date is required'
      });
    }

    // Call beds24Service getBookings with the specified parameters
    const response = await beds24Service.getBookings({
      propertyId: parseInt(propertyId),
      arrivalFrom: arrival,
      arrivalTo: arrivalTo || arrival, // If no arrivalTo specified, use same as arrival
      includeBookingGroup: true,
      includeInfoItems: true
    });

    // Extract bookings from Beds24 API response structure
    // Beds24 returns: { success: true, data: [...bookings] } 
    const bookingsArray = response?.data ? (Array.isArray(response.data) ? response.data : [response.data]) : [];
    let processedReservations = [];
    let processingResults = [];

    // If processAndSave is enabled, process each booking through processWebhookData
    if (processAndSave === 'true' && bookingsArray.length > 0) {
      console.log(`Processing ${bookingsArray.length} booking(s) from Beds24...`);
      
      for (const booking of bookingsArray) {
        try {
          // Process the booking data through the webhook processor
          const processedData = await beds24Service.processWebhookData({
            booking: booking,
            body: { 
              timeStamp: booking.modified || booking.bookingTime || new Date().toISOString() 
            }
          });

          // Check if reservation already exists
          const existingReservation = await reservationService.getReservationByBeds24Id(booking.id?.toString());

          let savedReservation;
          if (existingReservation) {
            // Update existing reservation
            console.log(`Updating existing reservation for Beds24 booking: ${booking.id}`);
            savedReservation = await reservationService.updateReservation(existingReservation.id, processedData);
            processingResults.push({
              beds24BookingId: booking.id,
              reservationId: savedReservation.id,
              action: 'updated',
              success: true,
              guestName: `${processedData.bookingFirstname || ''} ${processedData.bookingLastname || ''}`.trim(),
              checkIn: processedData.checkInDate,
              checkOut: processedData.checkOutDate
            });
          } else {
            // Create new reservation
            console.log(`Creating new reservation for Beds24 booking: ${booking.id}`);
            savedReservation = await reservationService.createReservation(processedData);
            processingResults.push({
              beds24BookingId: booking.id,
              reservationId: savedReservation.id,
              action: 'created',
              success: true,
              guestName: `${processedData.bookingFirstname || ''} ${processedData.bookingLastname || ''}`.trim(),
              checkIn: processedData.checkInDate,
              checkOut: processedData.checkOutDate
            });
          }

          processedReservations.push({
            ...savedReservation,
            beds24Data: booking,
            processedData: processedData
          });

        } catch (processingError) {
          console.error(`Error processing booking ${booking.id}:`, processingError);
          processingResults.push({
            beds24BookingId: booking.id,
            reservationId: null,
            action: 'failed',
            success: false,
            error: processingError.message,
            guestName: `${booking.firstName || ''} ${booking.lastName || ''}`.trim()
          });
        }
      }
    }

    // Prepare response data
    const responseData = {
      beds24Response: response, // Include the full Beds24 response for debugging
      rawBookings: bookingsArray,
      processedReservations: processedReservations,
      processingResults: processingResults,
      summary: {
        totalBookingsFetched: bookingsArray.length,
        totalProcessed: processingResults.length,
        successful: processingResults.filter(r => r.success).length,
        failed: processingResults.filter(r => !r.success).length,
        created: processingResults.filter(r => r.action === 'created').length,
        updated: processingResults.filter(r => r.action === 'updated').length,
        processAndSaveEnabled: processAndSave === 'true',
        beds24Success: response?.success || false,
        beds24Count: response?.count || 0
      }
    };
    
    const message = processAndSave === 'true' 
      ? `Fetched ${bookingsArray.length} booking(s) and processed ${processingResults.filter(r => r.success).length} successfully`
      : `Found ${bookingsArray.length} booking(s) from Beds24`;

    res.status(200).json({
      success: true,
      data: responseData,
      message: message
    });
  } catch (error) {
    console.error('Error fetching/processing Beds24 bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch/process Beds24 bookings',
      details: error.message
    });
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

    // Get all services and reservation-specific addon data
    const allServices = await guestServicesService.getAllServices();
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);

    // Combine the data
    const servicesWithStatus = allServices.map(service => {
      const addon = reservationAddons.find(a => a.service_id === service.id);

      return {
        ...service,
        is_enabled: addon?.admin_enabled || false,
        enabled_at: addon?.created_at || null,
        enabled_by: addon?.enabled_by || null,
        is_purchased: addon?.purchase_status === 'paid',
        purchased_at: addon?.purchased_at || null,
        purchase_amount: addon?.amount_paid || addon?.calculated_amount || null,
        purchase_status: addon?.purchase_status || 'not_available',
        stripe_payment_intent_id: addon?.stripe_payment_intent_id || null,
        calculated_amount: addon?.calculated_amount || service.price,
        is_tax_exempted: addon?.is_tax_exempted || false,
        can_enable: service.is_active && !addon?.admin_enabled
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

    // Get all services to find the one we want to enable
    const allServices = await guestServicesService.getAllServices();
    const service = allServices.find(s => s.id === serviceIdNum);
    
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

    // Enable the service for the reservation using service key
    const result = await guestServicesService.enableServiceForReservation(
      reservationId,
      service.service_key,
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
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const enabledService = reservationAddons.find(s => s.service_id === serviceIdNum && s.admin_enabled);

    if (!enabledService) {
      return res.status(404).json({ error: 'Service is not enabled for this reservation' });
    }

    // Check if service has been purchased
    const purchasedService = reservationAddons.find(s => s.service_id === serviceIdNum && s.purchase_status === 'paid');

    if (purchasedService) {
      return res.status(400).json({ 
        error: 'Cannot disable service that has already been purchased by the guest' 
      });
    }

    // Get service details to disable by service key
    const allServices = await guestServicesService.getAllServices();
    const serviceDetails = allServices.find(s => s.id === serviceIdNum);
    
    if (!serviceDetails) {
      return res.status(404).json({ error: 'Service details not found' });
    }

    // Disable the service
    const result = await guestServicesService.disableServiceForReservation(reservationId, serviceDetails.service_key, req.user?.id);

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

    // Get purchased services with full details - use the correct method
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const purchasedServices = reservationAddons.filter(addon => addon.purchase_status === 'paid');

    // Calculate total amount and effective times
    const totalAmount = purchasedServices.reduce((sum, service) => sum + (service.amount_paid || service.calculated_amount || 0), 0);
    
    // Get effective times with service overrides
    const effectiveTimes = await guestServicesService.calculateEffectiveTimes(reservationId);

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

// REFUND/VOID ENDPOINTS

// Refund a purchased service payment (full or partial)
router.post('/:id/services/:serviceId/refund', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;
    const { amount, reason = 'requested_by_customer' } = req.body;

    console.log('🔥 REFUND ENDPOINT HIT! Processing refund request:', { reservationId, serviceId, amount, reason });

    // Validate service ID
    console.log('🔍 Step 1: Validating service ID...');
    if (!serviceId || serviceId.trim() === '') {
      console.log('❌ Invalid service ID');
      return res.status(400).json({ error: 'Invalid service ID' });
    }
    console.log('✅ Service ID validated:', serviceId);

    // Check if reservation exists
    console.log('🔍 Step 2: Checking if reservation exists...');
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      console.log('❌ Reservation not found');
      return res.status(404).json({ error: 'Reservation not found' });
    }
    console.log('✅ Reservation found:', reservation.id);

    // Get purchased services for this reservation
    console.log('🔍 Step 3: Getting reservation services...');
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    console.log('✅ Retrieved', reservationAddons.length, 'services for reservation');
    
    const purchasedService = reservationAddons.find(s => 
      s.service_id === serviceId && 
      s.purchase_status === 'paid' &&
      s.stripe_payment_intent_id
    );

    if (!purchasedService) {
      console.log('❌ No paid service found. Services:', reservationAddons.map(s => ({ 
        id: s.service_id, 
        status: s.purchase_status, 
        has_stripe_id: !!s.stripe_payment_intent_id 
      })));
      
      // Check if service exists but is already refunded
      const refundedService = reservationAddons.find(s => 
        s.service_id === serviceId && 
        (s.purchase_status === 'refunded' || s.purchase_status === 'partially_refunded')
      );
      
      if (refundedService) {
        return res.status(409).json({ 
          error: 'Service has already been refunded',
          details: {
            service_id: serviceId,
            current_status: refundedService.purchase_status,
            refund_amount: refundedService.refund_amount,
            refunded_at: refundedService.refunded_at
          }
        });
      }
      
      return res.status(404).json({ 
        error: 'No paid service found for this reservation and service ID',
        details: {
          available_services: reservationAddons.map(s => ({
            service_id: s.service_id,
            status: s.purchase_status,
            service_name: s.guest_services?.name
          }))
        }
      });
    }
    console.log('✅ Found purchased service:', purchasedService.service_id);

    if (!purchasedService.stripe_payment_intent_id) {
      console.log('❌ No Stripe payment intent ID');
      return res.status(400).json({ 
        error: 'No Stripe payment intent ID found for this service' 
      });
    }
    console.log('✅ Stripe payment intent ID found:', purchasedService.stripe_payment_intent_id);

    // Validate refund amount if specified
    if (amount !== null && amount !== undefined) {
      if (amount <= 0) {
        return res.status(400).json({ 
          error: 'Refund amount must be greater than 0' 
        });
      }
      if (amount > purchasedService.calculated_amount) {
        return res.status(400).json({ 
          error: `Refund amount (${amount}) cannot exceed original payment amount (${purchasedService.calculated_amount})` 
        });
      }
    }

    // Process refund through Stripe service
    console.log('🔍 Step 4: Processing Stripe refund...');
    const stripeService = require('../services/stripeService');
    const refundResult = await stripeService.refundPayment(
      purchasedService.stripe_payment_intent_id,
      amount, // null for full refund, amount for partial refund
      reason,
      {
        reservation_id: reservationId,
        service_id: serviceId,
        admin_refund: true,
        refunded_by_user_id: req.user?.id
      }
    );
    console.log('✅ Stripe refund completed:', refundResult);

    // Update reservation addon status
    console.log('🔍 Step 5: Updating addon status...');
    const { error: updateError } = await guestServicesService.updateReservationAddonRefundStatus(
      reservationId,
      serviceId,
      {
        refund_id: refundResult.refundId,
        refund_amount: refundResult.amount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        purchase_status: amount && amount < purchasedService.calculated_amount ? 'partially_refunded' : 'refunded'
      }
    );

    if (updateError) {
      console.error('❌ Error updating addon refund status:', updateError);
      // Don't fail the request since Stripe refund succeeded
    } else {
      console.log('✅ Addon status updated successfully');
    }

    console.log('🔍 Step 6: Sending success response...');
    res.status(200).json({
      message: 'Refund processed successfully',
      data: {
        refund: refundResult,
        service: {
          service_id: serviceId,
          service_name: purchasedService.guest_services?.name || 'Unknown Service',
          original_amount: purchasedService.calculated_amount,
          refunded_amount: refundResult.amount,
          refund_type: amount ? 'partial' : 'full'
        },
        reservation: {
          id: reservationId,
          booking_name: reservation.booking_name
        }
      }
    });
    console.log('✅ Response sent successfully!');
  } catch (error) {
    console.error('❌ REFUND ERROR:', error);
    console.error('❌ Stack trace:', error.stack);
    
    // Enhanced error handling with specific error types
    let statusCode = 500;
    let errorMessage = 'Failed to process refund';
    let errorDetails = error.message;
    
    if (error.message.includes('already been fully refunded')) {
      statusCode = 409;
      errorMessage = 'Payment already refunded';
      errorDetails = 'This charge has already been fully refunded in Stripe. The database has been updated to reflect the current status.';
    } else if (error.message.includes('would exceed available refund amount')) {
      statusCode = 400;
      errorMessage = 'Invalid refund amount';
      errorDetails = error.message;
    } else if (error.message.includes('Cannot refund payment with status')) {
      statusCode = 400;
      errorMessage = 'Payment cannot be refunded';
      errorDetails = error.message;
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = 'Payment not found';
      errorDetails = error.message;
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: errorDetails,
      timestamp: new Date().toISOString(),
      reservation_id: req.params.id || 'unknown',
      service_id: req.params.serviceId || 'unknown'
    });
  }
});

// Void a service payment (for uncaptured payments only)
router.post('/:id/services/:serviceId/void', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;
    const { reason = 'requested_by_customer' } = req.body;

    console.log('Processing void request:', { reservationId, serviceId, reason });

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

    // Get service addon for this reservation
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const serviceAddon = reservationAddons.find(s => 
      s.service_id === serviceIdNum && 
      s.stripe_payment_intent_id
    );

    if (!serviceAddon) {
      return res.status(404).json({ 
        error: 'No service payment found for this reservation and service ID' 
      });
    }

    if (serviceAddon.purchase_status === 'paid') {
      return res.status(400).json({ 
        error: 'Cannot void a completed payment. Use refund instead.' 
      });
    }

    if (!serviceAddon.stripe_payment_intent_id) {
      return res.status(400).json({ 
        error: 'No Stripe payment intent ID found for this service' 
      });
    }

    // Process void through Stripe service
    const stripeService = require('../services/stripeService');
    const voidResult = await stripeService.voidPayment(
      serviceAddon.stripe_payment_intent_id,
      reason
    );

    // Update reservation addon status
    const { error: updateError } = await guestServicesService.updateReservationAddonStatus(
      reservationId,
      serviceIdNum,
      {
        purchase_status: 'canceled',
        voided_at: new Date().toISOString(),
        void_reason: reason
      }
    );

    if (updateError) {
      console.error('Error updating addon void status:', updateError);
      // Don't fail the request since Stripe void succeeded
    }

    res.status(200).json({
      message: 'Payment voided successfully',
      data: {
        void: voidResult,
        service: {
          service_id: serviceIdNum,
          service_name: serviceAddon.guest_services?.name || 'Unknown Service',
          amount: voidResult.amount,
          void_reason: reason
        },
        reservation: {
          id: reservationId,
          booking_name: reservation.booking_name
        }
      }
    });
  } catch (error) {
    console.error('Error processing void:', error);
    res.status(500).json({ 
      error: 'Failed to void payment',
      details: error.message 
    });
  }
});

// Get refund history for a service payment
router.get('/:id/services/:serviceId/refund-history', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;

    console.log('Getting refund history:', { reservationId, serviceId });

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

    // Get service addon for this reservation
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const serviceAddon = reservationAddons.find(s => s.service_id === serviceIdNum);

    if (!serviceAddon) {
      return res.status(404).json({ 
        error: 'No service found for this reservation and service ID' 
      });
    }

    if (!serviceAddon.stripe_payment_intent_id) {
      return res.status(400).json({ 
        error: 'No Stripe payment intent ID found for this service' 
      });
    }

    // Get refund history from Stripe
    const stripeService = require('../services/stripeService');
    const refundHistory = await stripeService.getRefundHistory(serviceAddon.stripe_payment_intent_id);

    res.status(200).json({
      message: 'Refund history retrieved successfully',
      data: {
        service: {
          service_id: serviceIdNum,
          service_name: serviceAddon.guest_services?.name || 'Unknown Service',
          original_amount: serviceAddon.calculated_amount,
          payment_status: serviceAddon.purchase_status,
          stripe_payment_intent_id: serviceAddon.stripe_payment_intent_id
        },
        refund_history: refundHistory,
        reservation: {
          id: reservationId,
          booking_name: reservation.booking_name
        }
      }
    });
  } catch (error) {
    console.error('Error getting refund history:', error);
    res.status(500).json({ 
      error: 'Failed to get refund history',
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

    // Get all services and reservation-specific addon data
    const allServices = await guestServicesService.getAllServices();
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);

    // Combine the data
    const servicesWithStatus = allServices.map(service => {
      const addon = reservationAddons.find(a => a.service_id === service.id);

      return {
        ...service,
        is_enabled: addon?.admin_enabled || false,
        enabled_at: addon?.created_at || null,
        enabled_by: addon?.enabled_by || null,
        is_purchased: addon?.purchase_status === 'paid',
        purchased_at: addon?.purchased_at || null,
        purchase_amount: addon?.amount_paid || addon?.calculated_amount || null,
        purchase_status: addon?.purchase_status || 'not_available',
        stripe_payment_intent_id: addon?.stripe_payment_intent_id || null,
        calculated_amount: addon?.calculated_amount || service.price,
        is_tax_exempted: addon?.is_tax_exempted || false,
        can_enable: service.is_active && !addon?.admin_enabled
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

    // Get all services to find the one we want to enable
    const allServices = await guestServicesService.getAllServices();
    const service = allServices.find(s => s.id === serviceIdNum);
    
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

    // Enable the service for the reservation using service key
    const result = await guestServicesService.enableServiceForReservation(
      reservationId,
      service.service_key,
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
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const enabledService = reservationAddons.find(s => s.service_id === serviceIdNum && s.admin_enabled);

    if (!enabledService) {
      return res.status(404).json({ error: 'Service is not enabled for this reservation' });
    }

    // Check if service has been purchased
    const purchasedService = reservationAddons.find(s => s.service_id === serviceIdNum && s.purchase_status === 'paid');

    if (purchasedService) {
      return res.status(400).json({ 
        error: 'Cannot disable service that has already been purchased by the guest' 
      });
    }

    // Get service details to disable by service key
    const allServices = await guestServicesService.getAllServices();
    const serviceDetails = allServices.find(s => s.id === serviceIdNum);
    
    if (!serviceDetails) {
      return res.status(404).json({ error: 'Service details not found' });
    }

    // Disable the service
    const result = await guestServicesService.disableServiceForReservation(reservationId, serviceDetails.service_key, req.user?.id);

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

    // Get purchased services with full details - use the correct method
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const purchasedServices = reservationAddons.filter(addon => addon.purchase_status === 'paid');

    // Calculate total amount and effective times
    const totalAmount = purchasedServices.reduce((sum, service) => sum + (service.amount_paid || service.calculated_amount || 0), 0);
    
    // Get effective times with service overrides
    const effectiveTimes = await guestServicesService.calculateEffectiveTimes(reservationId);

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


// Void a service payment (for uncaptured payments only)
router.post('/:id/services/:serviceId/void', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;
    const { reason = 'requested_by_customer' } = req.body;

    console.log('Processing void request:', { reservationId, serviceId, reason });

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

    // Get service addon for this reservation
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const serviceAddon = reservationAddons.find(s => 
      s.service_id === serviceIdNum && 
      s.stripe_payment_intent_id
    );

    if (!serviceAddon) {
      return res.status(404).json({ 
        error: 'No service payment found for this reservation and service ID' 
      });
    }

    if (serviceAddon.purchase_status === 'paid') {
      return res.status(400).json({ 
        error: 'Cannot void a completed payment. Use refund instead.' 
      });
    }

    if (!serviceAddon.stripe_payment_intent_id) {
      return res.status(400).json({ 
        error: 'No Stripe payment intent ID found for this service' 
      });
    }

    // Process void through Stripe service
    const stripeService = require('../services/stripeService');
    const voidResult = await stripeService.voidPayment(
      serviceAddon.stripe_payment_intent_id,
      reason
    );

    // Update reservation addon status
    const { error: updateError } = await guestServicesService.updateReservationAddonStatus(
      reservationId,
      serviceIdNum,
      {
        purchase_status: 'canceled',
        voided_at: new Date().toISOString(),
        void_reason: reason
      }
    );

    if (updateError) {
      console.error('Error updating addon void status:', updateError);
      // Don't fail the request since Stripe void succeeded
    }

    res.status(200).json({
      message: 'Payment voided successfully',
      data: {
        void: voidResult,
        service: {
          service_id: serviceIdNum,
          service_name: serviceAddon.guest_services?.name || 'Unknown Service',
          amount: voidResult.amount,
          void_reason: reason
        },
        reservation: {
          id: reservationId,
          booking_name: reservation.booking_name
        }
      }
    });
  } catch (error) {
    console.error('Error processing void:', error);
    res.status(500).json({ 
      error: 'Failed to void payment',
      details: error.message 
    });
  }
});

// Get refund history for a service payment
router.get('/:id/services/:serviceId/refund-history', adminAuth, async (req, res) => {
  try {
    const { id: reservationId, serviceId } = req.params;

    console.log('Getting refund history:', { reservationId, serviceId });

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

    // Get service addon for this reservation
    const reservationAddons = await guestServicesService.getReservationServices(reservationId);
    const serviceAddon = reservationAddons.find(s => s.service_id === serviceIdNum);

    if (!serviceAddon) {
      return res.status(404).json({ 
        error: 'No service found for this reservation and service ID' 
      });
    }

    if (!serviceAddon.stripe_payment_intent_id) {
      return res.status(400).json({ 
        error: 'No Stripe payment intent ID found for this service' 
      });
    }

    // Get refund history from Stripe
    const stripeService = require('../services/stripeService');
    const refundHistory = await stripeService.getRefundHistory(serviceAddon.stripe_payment_intent_id);

    res.status(200).json({
      message: 'Refund history retrieved successfully',
      data: {
        service: {
          service_id: serviceIdNum,
          service_name: serviceAddon.guest_services?.name || 'Unknown Service',
          original_amount: serviceAddon.calculated_amount,
          payment_status: serviceAddon.purchase_status,
          stripe_payment_intent_id: serviceAddon.stripe_payment_intent_id
        },
        refund_history: refundHistory,
        reservation: {
          id: reservationId,
          booking_name: reservation.booking_name
        }
      }
    });
  } catch (error) {
    console.error('Error getting refund history:', error);
    res.status(500).json({ 
      error: 'Failed to get refund history',
      details: error.message 
    });
  }
});

// Get specific reservation details (MUST be after all specific nested routes)
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

// Update reservation (includes both booking info and guest info) (MUST be after all specific nested routes)
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

    // Prepare complete update data (including guest information)
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

    // Guest personal information (will be handled by service method)
    if (updateData.guestFirstname !== undefined) reservationUpdateData.guestFirstname = updateData.guestFirstname;
    if (updateData.guestLastname !== undefined) reservationUpdateData.guestLastname = updateData.guestLastname;
    if (updateData.guestMail !== undefined) reservationUpdateData.guestMail = updateData.guestMail;
    if (updateData.guestContact !== undefined) reservationUpdateData.guestContact = updateData.guestContact;
    if (updateData.guestAddress !== undefined) reservationUpdateData.guestAddress = updateData.guestAddress;

    // Check-in specific information
    if (updateData.estimatedCheckinTime !== undefined) reservationUpdateData.estimatedCheckinTime = updateData.estimatedCheckinTime;
    if (updateData.travelPurpose !== undefined) reservationUpdateData.travelPurpose = updateData.travelPurpose;
    if (updateData.passportUrl !== undefined) reservationUpdateData.passportUrl = updateData.passportUrl;

    // Emergency contact
    if (updateData.emergencyContactName !== undefined) reservationUpdateData.emergencyContactName = updateData.emergencyContactName;
    if (updateData.emergencyContactPhone !== undefined) reservationUpdateData.emergencyContactPhone = updateData.emergencyContactPhone;

    // Administrative fields
    if (updateData.agreementAccepted !== undefined) reservationUpdateData.agreementAccepted = updateData.agreementAccepted;
    if (updateData.adminVerified !== undefined) reservationUpdateData.adminVerified = updateData.adminVerified;
    if (updateData.accessRead !== undefined) reservationUpdateData.accessRead = updateData.accessRead;

    console.log('Mapped complete update data:', reservationUpdateData);

    // Update reservation using service (this will now handle guest info too)
    const updatedReservation = await reservationService.updateReservation(id, reservationUpdateData);

    console.log('Reservation updated successfully:', updatedReservation.id);

    // Get updated reservation with guest information for response
    const updatedReservationWithGuests = await reservationService.getReservationFullDetails(id);

    res.status(200).json({
      message: 'Reservation updated successfully',
      reservation: updatedReservationWithGuests
    });
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.status(500).json({
      error: 'Failed to update reservation',
      details: error.message
    });
  }
});


module.exports = router;
