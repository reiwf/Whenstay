const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');
const beds24Service = require('../services/beds24Service');

// Real authentication middleware with JWT verification
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT token and get user profile
    const { user, profile } = await databaseService.verifyTokenAndGetProfile(token);
    
    // Check if user has admin access (admin, owner, or cleaner roles)
    if (!['admin', 'owner', 'cleaner'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Attach user info to request for use in routes
    req.user = user;
    req.userProfile = profile;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware for admin-only routes (admin and owner only)
const adminOnlyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT token and get user profile
    const { user, profile } = await databaseService.verifyTokenAndGetProfile(token);
    
    // Check if user has admin access (admin or owner roles only)
    if (!['admin', 'owner'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Attach user info to request for use in routes
    req.user = user;
    req.userProfile = profile;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get dashboard statistics
router.get('/dashboard/stats', adminOnlyAuth, async (req, res) => {
  try {
    const stats = await databaseService.getDashboardStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get today's dashboard statistics
router.get('/dashboard/today-stats', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile; // Available from adminAuth middleware
    const stats = await databaseService.getTodayDashboardStats(userProfile);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching today dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch today dashboard statistics' });
  }
});

// Get today's arrivals
router.get('/dashboard/today-arrivals', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile; // Available from adminAuth middleware
    const arrivals = await databaseService.getTodayArrivals(userProfile);
    res.status(200).json({
      message: 'Today arrivals retrieved successfully',
      arrivals,
      count: arrivals.length
    });
  } catch (error) {
    console.error('Error fetching today arrivals:', error);
    res.status(500).json({ error: 'Failed to fetch today arrivals' });
  }
});

// Get today's departures
router.get('/dashboard/today-departures', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile; // Available from adminAuth middleware
    const departures = await databaseService.getTodayDepartures(userProfile);
    res.status(200).json({
      message: 'Today departures retrieved successfully',
      departures,
      count: departures.length
    });
  } catch (error) {
    console.error('Error fetching today departures:', error);
    res.status(500).json({ error: 'Failed to fetch today departures' });
  }
});

// Get currently in-house guests
router.get('/dashboard/in-house-guests', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile; // Available from adminAuth middleware
    const inHouseGuests = await databaseService.getInHouseGuests(userProfile);
    res.status(200).json({
      message: 'In-house guests retrieved successfully',
      inHouseGuests,
      count: inHouseGuests.length
    });
  } catch (error) {
    console.error('Error fetching in-house guests:', error);
    res.status(500).json({ error: 'Failed to fetch in-house guests' });
  }
});

// Get all completed check-ins
router.get('/checkins', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const checkins = await databaseService.getCompletedCheckins(
      parseInt(limit), 
      parseInt(offset)
    );
    
    res.status(200).json({
      checkins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: checkins.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Get specific check-in details
router.get('/checkins/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    // Get reservation details
    const reservation = await databaseService.getReservationByToken(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Get check-in details
    const checkin = await databaseService.getGuestCheckinByReservationId(reservation.id);
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }
    
    res.status(200).json({
      reservation: {
        id: reservation.id,
        beds24BookingId: reservation.beds24_booking_id,
        guestName: reservation.guest_name,
        guestEmail: reservation.guest_email,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        roomNumber: reservation.room_number,
        numGuests: reservation.num_guests,
        status: reservation.status,
        createdAt: reservation.created_at
      },
      checkin: {
        id: checkin.id,
        passportUrl: checkin.passport_url,
        address: checkin.address,
        estimatedCheckinTime: checkin.estimated_checkin_time,
        travelPurpose: checkin.travel_purpose,
        adminVerified: checkin.admin_verified,
        submittedAt: checkin.submitted_at
      }
    });
  } catch (error) {
    console.error('Error fetching check-in details:', error);
    res.status(500).json({ error: 'Failed to fetch check-in details' });
  }
});

// Update admin verification status
router.patch('/checkins/:checkinId/verify', adminAuth, async (req, res) => {
  try {
    const { checkinId } = req.params;
    const { verified } = req.body;
    
    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified status must be a boolean' });
    }
    
    const updatedCheckin = await databaseService.updateAdminVerification(
      checkinId, 
      verified
    );
    
    res.status(200).json({
      message: `Check-in ${verified ? 'verified' : 'unverified'} successfully`,
      checkin: updatedCheckin
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

// Sync bookings from Beds24 (manual trigger)
router.post('/sync/beds24', adminAuth, async (req, res) => {
  try {
    const { daysBack = 7 } = req.body;
    
    console.log(`Starting manual sync of Beds24 bookings (${daysBack} days back)`);
    
    const bookings = await beds24Service.syncRecentBookings(daysBack);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const booking of bookings) {
      try {
        // Check if reservation already exists
        const existingReservation = await databaseService.getReservationByBeds24Id(
          booking.beds24BookingId
        );
        
        if (!existingReservation) {
          await databaseService.createReservation(booking);
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

// Get all reservations (with filters) - V5 Enhanced
router.get('/reservations', adminAuth, async (req, res) => {
  try {
    const {
      status,
      propertyId,
      roomTypeId,
      checkInDate,
      checkInDateFrom,
      checkInDateTo,
      page = 1,
      limit = 20,
      sortBy = 'check_in_date',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      status,
      propertyId,
      roomTypeId,
      checkInDate,
      checkInDateFrom,
      checkInDateTo,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sortBy,
      sortOrder
    };

    const reservations = await databaseService.getReservationsWithFilters(filters);
    
    res.status(200).json({
      message: 'Reservations retrieved successfully',
      reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: reservations.length === parseInt(limit)
      },
      filters: {
        status,
        propertyId,
        roomTypeId,
        checkInDate,
        checkInDateFrom,
        checkInDateTo,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});


// Update reservation
router.put('/reservations/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('PUT /reservations/:id - Received data:', { id, updateData });
    
    // First check if reservation exists
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
    
    // Prepare update data with proper field mapping
    const reservationUpdateData = {};
    
    // Map frontend field names to V5 database field names
    // Booking contact information (booking_* fields)
    if (updateData.bookingName !== undefined) reservationUpdateData.booking_name = updateData.bookingName;
    if (updateData.bookingEmail !== undefined) reservationUpdateData.booking_email = updateData.bookingEmail;
    if (updateData.bookingPhone !== undefined) reservationUpdateData.booking_phone = updateData.bookingPhone;
    
    // Legacy field mappings for backward compatibility
    if (updateData.guestName !== undefined) reservationUpdateData.booking_name = updateData.guestName;
    if (updateData.guestEmail !== undefined) reservationUpdateData.booking_email = updateData.guestEmail;
    if (updateData.phoneNumber !== undefined) reservationUpdateData.booking_phone = updateData.phoneNumber;
    
    // Booking details
    if (updateData.checkInDate !== undefined) reservationUpdateData.check_in_date = updateData.checkInDate;
    if (updateData.checkOutDate !== undefined) reservationUpdateData.check_out_date = updateData.checkOutDate;
    if (updateData.numGuests !== undefined) reservationUpdateData.num_guests = updateData.numGuests;
    if (updateData.numAdults !== undefined) reservationUpdateData.num_adults = updateData.numAdults;
    if (updateData.numChildren !== undefined) reservationUpdateData.num_children = updateData.numChildren;
    if (updateData.totalAmount !== undefined) reservationUpdateData.total_amount = updateData.totalAmount;
    if (updateData.currency !== undefined) reservationUpdateData.currency = updateData.currency;
    if (updateData.status !== undefined) reservationUpdateData.status = updateData.status;
    if (updateData.beds24BookingId !== undefined) reservationUpdateData.beds24_booking_id = updateData.beds24BookingId;
    if (updateData.specialRequests !== undefined) reservationUpdateData.special_requests = updateData.specialRequests;
    if (updateData.bookingSource !== undefined) reservationUpdateData.booking_source = updateData.bookingSource;
    
    // V5 Room assignment
    if (updateData.propertyId !== undefined) reservationUpdateData.property_id = updateData.propertyId;
    if (updateData.roomTypeId !== undefined) reservationUpdateData.room_type_id = updateData.roomTypeId;
    if (updateData.roomUnitId !== undefined) reservationUpdateData.room_unit_id = updateData.roomUnitId;
    // Note: room_id and room_number fields have been removed in V5 schema
    
    // Guest personal information fields (guest_* fields)
    if (updateData.guestFirstname !== undefined) reservationUpdateData.guest_firstname = updateData.guestFirstname;
    if (updateData.guestLastname !== undefined) reservationUpdateData.guest_lastname = updateData.guestLastname;
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
    
    console.log('Mapped update data:', reservationUpdateData);
    
    // Update the reservation
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
router.post('/reservations', adminAuth, async (req, res) => {
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
    
    // Validate required fields
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
    
    const reservation = await databaseService.createReservation(reservationData);
    
    res.status(201).json({
      message: 'Reservation created successfully',
      reservation
    });
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// Send check-in invitation manually
router.post('/reservations/:reservationId/send-invitation', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;
    
    // Get reservation details
    const reservation = await databaseService.getReservationByToken(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Send check-in invitation
    const emailService = require('../services/emailService');
    await emailService.sendCheckinInvitation(
      reservation.guest_email,
      reservation.guest_name,
      reservation.check_in_token,
      reservation.check_in_date
    );
    
    // Update status to invited if it was pending
    if (reservation.status === 'pending') {
      await databaseService.updateReservationStatus(reservation.id, 'invited');
    }
    
    res.status(200).json({ message: 'Check-in invitation sent successfully' });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Get webhook events log
router.get('/webhooks/events', adminAuth, async (req, res) => {
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

// Authentication Routes

// User login with email and password
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Authenticate user
    const { user, profile, session } = await databaseService.authenticateUser(email, password);
    
    res.status(200).json({
      message: 'Login successful',
      token: session?.access_token || `mock_token_${user.id}_${Date.now()}`,
      user: {
        id: user.id,
        email: user.email,
        profile: {
          id: profile.id,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          company_name: profile.company_name,
          is_active: profile.is_active,
          created_at: profile.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    
    // Handle specific authentication errors
    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (error.message.includes('User profile not found')) {
      return res.status(401).json({ error: 'User profile not found' });
    }
    
    if (error.message.includes('User account is deactivated')) {
      return res.status(401).json({ error: 'User account is deactivated' });
    }
    
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/auth/profile', adminAuth, async (req, res) => {
  try {
    // User profile is already attached by adminAuth middleware
    const profile = req.userProfile;
    const user = req.user;
    
    res.status(200).json({
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        profile: {
          id: profile.id,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          company_name: profile.company_name,
          is_active: profile.is_active,
          created_at: profile.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Logout (client-side token removal, server-side session invalidation)
router.post('/auth/logout', adminAuth, async (req, res) => {
  try {
    // Note: With Supabase, logout is typically handled client-side
    // Server-side logout would require session management
    res.status(200).json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Create test admin user (development only)
router.post('/auth/create-test-admin', async (req, res) => {
  try {
    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Not available in production' });
    }
    
    const profile = await databaseService.createTestAdminUser();
    
    res.status(201).json({
      message: 'Test admin user created successfully',
      profile: {
        id: profile.id,
        role: profile.role,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: 'admin@whenstay.com',
        is_active: profile.is_active
      }
    });
  } catch (error) {
    console.error('Error creating test admin user:', error);
    res.status(500).json({ 
      error: 'Failed to create test admin user',
      details: error.message 
    });
  }
});

// Property Management Routes

// Get all properties
router.get('/properties', adminAuth, async (req, res) => {
  try {
    const { withStats } = req.query;
    const userProfile = req.userProfile; // Available from adminAuth middleware
    
    let properties;
    if (withStats === 'true') {
      properties = await databaseService.getPropertiesWithStats(userProfile);
    } else {
      properties = await databaseService.getAllProperties(userProfile);
    }
    
    res.status(200).json({
      message: 'Properties retrieved successfully',
      properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get specific property by ID
router.get('/properties/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await databaseService.getPropertyById(id);
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.status(200).json({
      message: 'Property retrieved successfully',
      property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// Create new property
router.post('/properties', adminAuth, async (req, res) => {
  try {
    const {
      name,
      address,
      ownerId,
      description,
      propertyType,
      wifiName,
      wifiPassword,
      houseRules,
      checkInInstructions,
      emergencyContact,
      propertyAmenities,
      locationInfo,
      accessTime,
      defaultCleanerId
    } = req.body;
    
    // Validate required fields
    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }
    
    const propertyData = {
      name,
      address,
      ownerId: ownerId || 'c339d395-9910-44cd-ae8a-362e153c35de', // Default admin user
      description,
      propertyType,
      wifiName,
      wifiPassword,
      houseRules,
      checkInInstructions,
      emergencyContact,
      propertyAmenities,
      locationInfo,
      accessTime,
      defaultCleanerId
    };
    
    const property = await databaseService.createProperty(propertyData);
    
    res.status(201).json({
      message: 'Property created successfully',
      property
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Update property
router.put('/properties/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const property = await databaseService.updateProperty(id, updateData);
    
    res.status(200).json({
      message: 'Property updated successfully',
      property
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// Delete property
router.delete('/properties/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const property = await databaseService.deleteProperty(id);
    
    res.status(200).json({
      message: 'Property deleted successfully',
      property
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// Room Type Management Routes

// Get all room types for a property
router.get('/properties/:propertyId/room-types', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { withUnits } = req.query;
    
    let roomTypes;
    if (withUnits === 'true') {
      roomTypes = await databaseService.getRoomTypesWithUnits(propertyId);
    } else {
      roomTypes = await databaseService.getRoomTypesByProperty(propertyId);
    }
    
    res.status(200).json({
      message: 'Room types retrieved successfully',
      roomTypes
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({ error: 'Failed to fetch room types' });
  }
});

// Create room type for a property
router.post('/properties/:propertyId/room-types', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      name,
      description,
      maxGuests,
      basePrice,
      currency,
      roomAmenities,
      bedConfiguration,
      roomSizeSqm,
      hasBalcony,
      hasKitchen,
      isAccessible
    } = req.body;
    
    // Validate required fields
    if (!name || !maxGuests) {
      return res.status(400).json({ error: 'Name and max guests are required' });
    }
    
    const roomTypeData = {
      name,
      description,
      maxGuests,
      basePrice,
      currency: currency || 'JPY',
      roomAmenities,
      bedConfiguration,
      roomSizeSqm,
      hasBalcony,
      hasKitchen,
      isAccessible
    };
    
    const roomType = await databaseService.createRoomType(propertyId, roomTypeData);
    
    res.status(201).json({
      message: 'Room type created successfully',
      roomType
    });
  } catch (error) {
    console.error('Error creating room type:', error);
    res.status(500).json({ error: 'Failed to create room type' });
  }
});

// Update room type
router.put('/room-types/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const roomType = await databaseService.updateRoomType(id, updateData);
    
    res.status(200).json({
      message: 'Room type updated successfully',
      roomType
    });
  } catch (error) {
    console.error('Error updating room type:', error);
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

// Delete room type
router.delete('/room-types/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const roomType = await databaseService.deleteRoomType(id);
    
    res.status(200).json({
      message: 'Room type deleted successfully',
      roomType
    });
  } catch (error) {
    console.error('Error deleting room type:', error);
    res.status(500).json({ error: 'Failed to delete room type' });
  }
});

// Room Unit Management Routes

// Get all room units for a room type
router.get('/room-types/:roomTypeId/room-units', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    
    const roomUnits = await databaseService.getRoomUnitsByRoomType(roomTypeId);
    
    res.status(200).json({
      message: 'Room units retrieved successfully',
      roomUnits
    });
  } catch (error) {
    console.error('Error fetching room units:', error);
    res.status(500).json({ error: 'Failed to fetch room units' });
  }
});

// Create room unit for a room type
router.post('/room-types/:roomTypeId/room-units', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const {
      unitNumber,
      floorNumber,
      accessCode,
      accessInstructions,
      wifiName,
      wifiPassword,
      unitAmenities,
      maintenanceNotes
    } = req.body;
    
    // Validate required fields
    if (!unitNumber) {
      return res.status(400).json({ error: 'Unit number is required' });
    }
    
    const roomUnitData = {
      unitNumber,
      floorNumber,
      accessCode,
      accessInstructions,
      wifiName,
      wifiPassword,
      unitAmenities,
      maintenanceNotes
    };
    
    const roomUnit = await databaseService.createRoomUnit(roomTypeId, roomUnitData);
    
    res.status(201).json({
      message: 'Room unit created successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error creating room unit:', error);
    res.status(500).json({ error: 'Failed to create room unit' });
  }
});

// Update room unit
router.put('/room-units/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const roomUnit = await databaseService.updateRoomUnit(id, updateData);
    
    res.status(200).json({
      message: 'Room unit updated successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error updating room unit:', error);
    res.status(500).json({ error: 'Failed to update room unit' });
  }
});

// Delete room unit
router.delete('/room-units/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const roomUnit = await databaseService.deleteRoomUnit(id);
    
    res.status(200).json({
      message: 'Room unit deleted successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error deleting room unit:', error);
    res.status(500).json({ error: 'Failed to delete room unit' });
  }
});

// Legacy Room Management Routes (for backward compatibility)

// Create room for a property (deprecated - use room types/units instead)
router.post('/properties/:propertyId/rooms', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      roomNumber,
      roomName,
      roomType,
      maxGuests,
      accessCode,
      accessInstructions,
      roomAmenities,
      roomSizeSqm,
      bedConfiguration,
      floorNumber,
      wifiName,
      wifiPassword,
      hasBalcony,
      hasKitchen,
      isAccessible
    } = req.body;
    
    // Validate required fields
    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }
    
    const roomData = {
      roomNumber,
      roomName,
      roomType,
      maxGuests,
      accessCode,
      accessInstructions,
      roomAmenities,
      roomSizeSqm,
      bedConfiguration,
      floorNumber,
      wifiName,
      wifiPassword,
      hasBalcony,
      hasKitchen,
      isAccessible
    };
    
    const room = await databaseService.createRoom(propertyId, roomData);
    
    res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room (deprecated)
router.put('/rooms/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const room = await databaseService.updateRoom(id, updateData);
    
    res.status(200).json({
      message: 'Room updated successfully',
      room
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room (deprecated)
router.delete('/rooms/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const room = await databaseService.deleteRoom(id);
    
    res.status(200).json({
      message: 'Room deleted successfully',
      room
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// User Management Routes

// Get all users
router.get('/users', adminOnlyAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, withDetails } = req.query;
    const offset = (page - 1) * limit;
    
    let users;
    if (withDetails === 'true') {
      users = await databaseService.getUsersWithDetails(
        parseInt(limit), 
        parseInt(offset), 
        role
      );
    } else {
      users = await databaseService.getAllUsers(
        parseInt(limit), 
        parseInt(offset), 
        role
      );
    }
    
    res.status(200).json({
      message: 'Users retrieved successfully',
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: users.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user statistics
router.get('/users/stats', adminAuth, async (req, res) => {
  try {
    const stats = await databaseService.getUserStats();
    
    res.status(200).json({
      message: 'User statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get specific user by ID
router.get('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await databaseService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.status(200).json({
      message: 'User retrieved successfully',
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/users', adminAuth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      companyName,
      role,
      isActive
    } = req.body;
    
    // Validate required fields
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'First name, last name, email, and role are required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate role
    const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
    }
    
    const userData = {
      firstName,
      lastName,
      email,
      password: password || undefined, // Let the service handle default password
      phone,
      companyName,
      role,
      isActive: isActive !== undefined ? isActive : true
    };
    
    const user = await databaseService.createUser(userData);
    
    res.status(201).json({
      message: 'User created successfully',
      user: {
        ...user,
        // Don't return sensitive auth info
        password: undefined
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle specific Supabase Auth errors
    if (error.message.includes('User already registered')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    
    if (error.message.includes('Invalid email')) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    if (error.message.includes('Password should be at least')) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    
    res.status(500).json({ 
      error: 'Failed to create user',
      details: error.message 
    });
  }
});

// Update user
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Validate role if provided
    if (updateData.role) {
      const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
      if (!validRoles.includes(updateData.role)) {
        return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
      }
    }
    
    const user = await databaseService.updateUser(id, updateData);
    
    res.status(200).json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (soft delete)
router.delete('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await databaseService.deleteUser(id);
    
    res.status(200).json({
      message: 'User deleted successfully',
      user
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user role
router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
    }
    
    const user = await databaseService.updateUser(id, { role });
    
    res.status(200).json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Update user status (activate/deactivate)
router.patch('/users/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean value' });
    }
    
    const user = await databaseService.updateUser(id, { isActive });
    
    res.status(200).json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Cleaning Task Management Routes

// Get all cleaning tasks with filtering
router.get('/cleaning-tasks', adminAuth, async (req, res) => {
  try {
    const {
      status,
      cleanerId,
      propertyId,
      roomUnitId,
      taskDate,
      taskDateFrom,
      taskDateTo,
      taskType,
      priority,
      page = 1,
      limit = 20,
      sortBy = 'task_date',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      status,
      cleanerId,
      propertyId,
      roomUnitId,
      taskDate,
      taskDateFrom,
      taskDateTo,
      taskType,
      priority,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      sortBy,
      sortOrder
    };

    const userProfile = req.userProfile; // Available from adminAuth middleware
    const tasks = await databaseService.getCleaningTasks(filters, userProfile);
    
    res.status(200).json({
      message: 'Cleaning tasks retrieved successfully',
      tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: tasks.length === parseInt(limit)
      },
      filters: {
        status,
        cleanerId,
        propertyId,
        roomUnitId,
        taskDate,
        taskDateFrom,
        taskDateTo,
        taskType,
        priority,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error);
    res.status(500).json({ error: 'Failed to fetch cleaning tasks' });
  }
});


// Create new cleaning task
router.post('/cleaning-tasks', adminAuth, async (req, res) => {
  try {
    const {
      propertyId,
      roomUnitId,
      reservationId,
      cleanerId,
      taskDate,
      taskType,
      status,
      priority,
      estimatedDuration,
      specialNotes
    } = req.body;
    
    // Validate required fields (reservationId is now nullable)
    if (!propertyId || !roomUnitId || !taskDate) {
      return res.status(400).json({ 
        error: 'Property ID, room unit ID, and task date are required' 
      });
    }
    
    const taskData = {
      propertyId,
      roomUnitId,
      reservationId: reservationId || null, // Make reservation ID nullable
      cleanerId,
      taskDate,
      taskType: taskType || 'checkout',
      status: status || 'pending',
      priority: priority || 'normal',
      estimatedDuration,
      specialNotes
    };
    
    const task = await databaseService.createCleaningTask(taskData);
    
    res.status(201).json({
      message: 'Cleaning task created successfully',
      task
    });
  } catch (error) {
    console.error('Error creating cleaning task:', error);
    res.status(500).json({ error: 'Failed to create cleaning task' });
  }
});

// Update cleaning task
router.put('/cleaning-tasks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const task = await databaseService.updateCleaningTask(id, updateData);
    
    res.status(200).json({
      message: 'Cleaning task updated successfully',
      task
    });
  } catch (error) {
    console.error('Error updating cleaning task:', error);
    res.status(500).json({ error: 'Failed to update cleaning task' });
  }
});

// Delete cleaning task
router.delete('/cleaning-tasks/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await databaseService.deleteCleaningTask(id);
    
    res.status(200).json({
      message: 'Cleaning task deleted successfully',
      task
    });
  } catch (error) {
    console.error('Error deleting cleaning task:', error);
    res.status(500).json({ error: 'Failed to delete cleaning task' });
  }
});

// Assign cleaner to task
router.patch('/cleaning-tasks/:id/assign', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { cleanerId } = req.body;
    
    if (!cleanerId) {
      return res.status(400).json({ error: 'Cleaner ID is required' });
    }
    
    const task = await databaseService.assignCleanerToTask(id, cleanerId);
    
    res.status(200).json({
      message: 'Cleaner assigned to task successfully',
      task
    });
  } catch (error) {
    console.error('Error assigning cleaner to task:', error);
    res.status(500).json({ error: 'Failed to assign cleaner to task' });
  }
});

// Get available cleaners
router.get('/cleaners', adminAuth, async (req, res) => {
  try {
    const cleaners = await databaseService.getAvailableCleaners();
    
    res.status(200).json({
      message: 'Available cleaners retrieved successfully',
      cleaners
    });
  } catch (error) {
    console.error('Error fetching available cleaners:', error);
    res.status(500).json({ error: 'Failed to fetch available cleaners' });
  }
});

// Get cleaning task statistics
router.get('/cleaning-tasks/stats', adminAuth, async (req, res) => {
  try {
    const {
      propertyId,
      cleanerId,
      taskDate,
      taskDateFrom,
      taskDateTo
    } = req.query;

    const filters = {
      propertyId,
      cleanerId,
      taskDate,
      taskDateFrom,
      taskDateTo
    };

    const stats = await databaseService.getCleaningTaskStats(filters);
    
    res.status(200).json({
      message: 'Cleaning task statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Error fetching cleaning task stats:', error);
    res.status(500).json({ error: 'Failed to fetch cleaning task statistics' });
  }
});

module.exports = router;
