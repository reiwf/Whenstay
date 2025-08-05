const { supabaseAdmin } = require('../config/supabase');

class DatabaseService {
  // Create a new reservation record
  async createReservation(reservationData) {
    try {
            
      const insertData = {
        beds24_booking_id: reservationData.beds24BookingId || `MANUAL-${Date.now()}`,
        booking_name: reservationData.bookingName || reservationData.guestName,
        booking_email: reservationData.bookingEmail || reservationData.guestEmail,
        booking_phone: reservationData.bookingPhone || reservationData.guestPhone || null,
        check_in_date: reservationData.checkInDate,
        check_out_date: reservationData.checkOutDate,
        num_guests: reservationData.numGuests || 1,
        num_adults: reservationData.numAdults || 1,
        num_children: reservationData.numChildren || 0,
        total_amount: reservationData.totalAmount || null,
        currency: reservationData.currency || 'USD',
        status: reservationData.status || 'pending',
        booking_source: reservationData.bookingSource || null,
        special_requests: reservationData.specialRequests || null,
        
        // V5 Room assignment
        property_id: reservationData.propertyId || null,
        room_type_id: reservationData.roomTypeId || null,
        room_unit_id: reservationData.roomUnitId || null
      };

      // Remove undefined values
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === undefined) {
          delete insertData[key];
        }
      });
      
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating reservation:', error);
        throw new Error('Failed to create reservation');
      }

      return data;
    } catch (error) {
      console.error('Database error creating reservation:', error);
      throw error;
    }
  }

  // Get reservation by Beds24 booking ID
  async getReservationByBeds24Id(beds24BookingId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('beds24_booking_id', beds24BookingId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching reservation:', error);
        throw new Error('Failed to fetch reservation');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching reservation:', error);
      throw error;
    }
  }

  // Get reservation by check-in token
  async getReservationByToken(checkinToken) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('check_in_token', checkinToken)
        .single();

      if (error) {
        console.error('Error fetching reservation by token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Database error fetching reservation by token:', error);
      return null;
    }
  }

  // Update reservation status
  async updateReservationStatus(reservationId, status) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({ status })
        .eq('id', reservationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating reservation status:', error);
        throw new Error('Failed to update reservation status');
      }

      return data;
    } catch (error) {
      console.error('Database error updating reservation status:', error);
      throw error;
    }
  }

  // Update reservation with new data (for booking modifications)
  async updateReservation(reservationId, reservationData) {
    try {
      const updateData = {};
      
      // Core booking information
      if (reservationData.bookingName !== undefined) updateData.booking_name = reservationData.bookingName;
      if (reservationData.bookingEmail !== undefined) updateData.booking_email = reservationData.bookingEmail;
      if (reservationData.bookingPhone !== undefined) updateData.booking_phone = reservationData.bookingPhone;
      if (reservationData.checkInDate !== undefined) updateData.check_in_date = reservationData.checkInDate;
      if (reservationData.checkOutDate !== undefined) updateData.check_out_date = reservationData.checkOutDate;
      if (reservationData.numGuests !== undefined) updateData.num_guests = reservationData.numGuests;
      if (reservationData.numAdults !== undefined) updateData.num_adults = reservationData.numAdults;
      if (reservationData.numChildren !== undefined) updateData.num_children = reservationData.numChildren;
      if (reservationData.totalAmount !== undefined) updateData.total_amount = reservationData.totalAmount;
      if (reservationData.currency !== undefined) updateData.currency = reservationData.currency;
      if (reservationData.status !== undefined) updateData.status = reservationData.status;
      if (reservationData.bookingSource !== undefined) updateData.booking_source = reservationData.bookingSource;
      if (reservationData.specialRequests !== undefined) updateData.special_requests = reservationData.specialRequests;
      
      // Property and room assignments
      if (reservationData.propertyId !== undefined) updateData.property_id = reservationData.propertyId;
      if (reservationData.roomTypeId !== undefined) updateData.room_type_id = reservationData.roomTypeId;
      if (reservationData.roomUnitId !== undefined) updateData.room_unit_id = reservationData.roomUnitId;
      
      // Additional Beds24 specific fields
      if (reservationData.apiReference !== undefined) updateData.apiReference = reservationData.apiReference;
      if (reservationData.bookingLastname !== undefined) updateData.booking_lastname = reservationData.bookingLastname;
      if (reservationData.rateDescription !== undefined) updateData.rateDescription = reservationData.rateDescription;
      if (reservationData.commission !== undefined) updateData.commission = reservationData.commission;
      if (reservationData.apiMessage !== undefined) updateData.apiMessage = reservationData.apiMessage;
      if (reservationData.bookingTime !== undefined) updateData.bookingTime = reservationData.bookingTime;
      if (reservationData.timeStamp !== undefined) updateData.timeStamp = reservationData.timeStamp;
      if (reservationData.lang !== undefined) updateData.lang = reservationData.lang;
      if (reservationData.comments !== undefined) updateData.comments = reservationData.comments;
      if (reservationData.price !== undefined) updateData.price = reservationData.price;

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        }
      });

      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating reservation:', error);
        throw new Error('Failed to update reservation');
      }

      return data;
    } catch (error) {
      console.error('Database error updating reservation:', error);
      throw error;
    }
  }

  // Update reservation with guest information
  async updateReservationGuestInfo(reservationId, guestInfo) {
    try {
      const updateData = {
        guest_firstname: guestInfo.firstName || null,
        guest_lastname: guestInfo.lastName || null,
        guest_mail: guestInfo.personalEmail || null,
        guest_contact: guestInfo.contactNumber || null,
        guest_address: guestInfo.address || null,
        estimated_checkin_time: guestInfo.estimatedCheckinTime || null,
        travel_purpose: guestInfo.travelPurpose || null,
        emergency_contact_name: guestInfo.emergencyContactName || null,
        emergency_contact_phone: guestInfo.emergencyContactPhone || null,
        passport_url: guestInfo.passportUrl || null,
        agreement_accepted: guestInfo.agreementAccepted,
        checkin_submitted_at: guestInfo.submittedAt || new Date().toISOString()
      };

      // Convert empty strings to null for proper database handling
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '' || updateData[key] === undefined) {
          updateData[key] = null;
        }
      });

      // Ensure boolean fields are properly handled
      if (typeof updateData.agreement_accepted === 'string') {
        updateData.agreement_accepted = updateData.agreement_accepted === 'true';
      }

      console.log('Updating reservation with data:', updateData);

      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw new Error(`Failed to update reservation guest information: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Database error updating reservation guest info:', error);
      throw error;
    }
  }


  // Check if guest check-in is completed by checking checkin_submitted_at field
  async getGuestCheckinByReservationId(reservationId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('checkin_submitted_at, admin_verified, guest_firstname, guest_lastname, passport_url')
        .eq('id', reservationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching guest check-in:', error);
        throw new Error('Failed to fetch guest check-in');
      }

      // Return check-in data if submitted, null if not
      if (data && data.checkin_submitted_at) {
        return {
          id: reservationId,
          submitted_at: data.checkin_submitted_at,
          admin_verified: data.admin_verified || false,
          guest_name: `${data.guest_firstname || ''} ${data.guest_lastname || ''}`.trim(),
          passport_url: data.passport_url
        };
      }

      return null;
    } catch (error) {
      console.error('Database error fetching guest check-in:', error);
      throw error;
    }
  }

  // Get all completed check-ins for admin dashboard
  async getCompletedCheckins(limit = 50, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .not('checkin_submitted_at', 'is', null)
        .order('checkin_submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching completed check-ins:', error);
        throw new Error('Failed to fetch completed check-ins');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching completed check-ins:', error);
      throw error;
    }
  }

  // Get reservations with filtering for admin dashboard (V5 enhanced with fallback)
  async getReservationsWithFilters(filters = {}) {
    try {
      const {
        status,
        propertyId,
        roomTypeId,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        limit = 50,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      // Try V5 view first, fallback to basic table if it fails
      let query;
      let useV5View = true;

      query = supabaseAdmin
        .from('reservations_details')
        .select('*');

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (propertyId) {
        if (useV5View) {
          query = query.eq('property_id', propertyId);
        } else {
          // For basic table, we might need to filter differently
          query = query.eq('room_id', propertyId); // This might need adjustment
        }
      }

      if (roomTypeId) {
        if (useV5View) {
          query = query.eq('room_type_id', roomTypeId);
        }
        // Skip room type filtering for basic table
      }

      if (checkInDate) {
        query = query.eq('check_in_date', checkInDate);
      } else {
        if (checkInDateFrom) {
          query = query.gte('check_in_date', checkInDateFrom);
        }
        if (checkInDateTo) {
          query = query.lte('check_in_date', checkInDateTo);
        }
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reservations with filters:', error);
        
        // If V5 view failed, try basic table
        if (useV5View) {
          console.log('Retrying with basic reservations table...');
          return this.getReservationsWithFiltersBasic(filters);
        }
        
        throw new Error('Failed to fetch reservations');
      }

      // Transform data based on whether we're using V5 view or basic table
      const transformedData = data.map(reservation => {
        if (useV5View) {
          return {
            ...reservation,
            // Map V5 fields to frontend-expected names for backward compatibility
            guest_name: reservation.booking_name,
            guest_email: reservation.booking_email,
            guest_phone: reservation.booking_phone,
            room_number: reservation.unit_number || reservation.room_number || 'TBD',
            room_name: reservation.room_type_name || 'Standard Room',
            // Keep all V5 fields for enhanced display with proper fallbacks
            booking_name: reservation.booking_name,
            property_name: reservation.property_name || 'Unknown Property',
            room_type_name: reservation.room_type_name || 'Standard',
            room_type_description: reservation.room_type_description,
            unit_number: reservation.unit_number,
            floor_number: reservation.floor_number,
            access_code: reservation.access_code,
            access_instructions: reservation.access_instructions,
            room_type_amenities: reservation.room_type_amenities,
            unit_amenities: reservation.unit_amenities,
            bed_configuration: reservation.bed_configuration,
            room_size_sqm: reservation.room_size_sqm,
            has_balcony: reservation.room_type_has_balcony,
            has_kitchen: reservation.room_type_has_kitchen,
            is_accessible: reservation.room_type_is_accessible,
            // Guest information fields
            guest_firstname: reservation.guest_firstname,
            guest_lastname: reservation.guest_lastname,
            guest_contact: reservation.guest_contact,
            guest_personal_email: reservation.guest_mail,
            guest_address: reservation.guest_address,
            estimated_checkin_time: reservation.estimated_checkin_time,
            travel_purpose: reservation.travel_purpose,
            emergency_contact_name: reservation.emergency_contact_name,
            emergency_contact_phone: reservation.emergency_contact_phone,
            passport_url: reservation.passport_url,
            agreement_accepted: reservation.agreement_accepted,
            checkin_submitted_at: reservation.checkin_submitted_at,
            admin_verified: reservation.admin_verified,
            verified_at: reservation.verified_at,
            verified_by_name: reservation.verified_by_name,
            verified_by_lastname: reservation.verified_by_lastname
          };
        } else {
          // This branch should not be reached anymore since we have proper fallback methods
          return {
            ...reservation,
            guest_name: reservation.booking_name,
            guest_email: reservation.booking_email,
            guest_phone: reservation.booking_phone,
            guest_personal_email: reservation.guest_mail,
            property_name: 'Property Information Unavailable',
            room_number: reservation.room_number || 'TBD',
            room_name: 'Standard Room',
            room_type_name: 'Standard',
          };
        }
      });

      return transformedData;
    } catch (error) {
      console.error('Database error fetching reservations with filters:', error);
      throw error;
    }
  }

  // Fallback method for basic reservations table with property lookup
  async getReservationsWithFiltersBasic(filters = {}) {
    try {
      const {
        status,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        limit = 50,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      // Try to get reservations with property information via joins
      let query = supabaseAdmin
        .from('reservations')
        .select(`
          *,
          room_units (
            unit_number,
            floor_number,
            access_code,
            access_instructions,
            wifi_name,
            wifi_password,
            unit_amenities,
            room_types (
              name,
              description,
              max_guests,
              base_price,
              currency,
              room_amenities,
              bed_configuration,
              room_size_sqm,
              has_balcony,
              has_kitchen,
              is_accessible,
              properties (
                name,
                address,
                wifi_name,
                wifi_password,
                property_amenities
              )
            )
          ),
          rooms (
            room_number,
            room_name,
            room_type,
            max_guests,
            access_code,
            access_instructions,
            room_amenities,
            properties (
              name,
              address,
              wifi_name,
              wifi_password
            )
          )
        `);

      // Apply basic filters
      if (status) {
        query = query.eq('status', status);
      }

      if (checkInDate) {
        query = query.eq('check_in_date', checkInDate);
      } else {
        if (checkInDateFrom) {
          query = query.gte('check_in_date', checkInDateFrom);
        }
        if (checkInDateTo) {
          query = query.lte('check_in_date', checkInDateTo);
        }
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching basic reservations with joins:', error);
        // If joins fail, try simple query without property info
        return this.getReservationsWithFiltersSimple(filters);
      }

      // Transform data with proper property information
      const transformedData = data.map(reservation => {
        // Check if we have V5 structure (room_units -> room_types -> properties)
        const roomUnit = reservation.room_units?.[0];
        const roomType = roomUnit?.room_types;
        const property = roomType?.properties;

        // Check if we have legacy structure (rooms -> properties)
        const room = reservation.rooms?.[0];
        const legacyProperty = room?.properties;

        // Use V5 data if available, otherwise fall back to legacy
        const propertyData = property || legacyProperty;
        const roomData = roomUnit || room;

        return {
          ...reservation,
          // Basic guest mapping
          guest_name: reservation.booking_name,
          guest_email: reservation.booking_email,
          guest_phone: reservation.booking_phone,
          guest_personal_email: reservation.guest_mail,
          
          // Property information
          property_name: propertyData?.name || 'Unknown Property',
          property_address: propertyData?.address || null,
          property_wifi_name: propertyData?.wifi_name || null,
          property_amenities: propertyData?.property_amenities || null,
          
          // Room/Unit information
          room_number: roomData?.room_number || roomUnit?.unit_number || 'TBD',
          room_name: roomData?.room_name || roomType?.name || 'Standard Room',
          room_type_name: roomType?.name || roomData?.room_type || 'Standard',
          room_type_description: roomType?.description || null,
          unit_number: roomUnit?.unit_number || null,
          floor_number: roomUnit?.floor_number || roomData?.floor_number || null,
          
          // Access information
          access_code: roomData?.access_code || null,
          access_instructions: roomData?.access_instructions || null,
          wifi_name: roomData?.wifi_name || propertyData?.wifi_name || null,
          
          // Room details
          max_guests: roomType?.max_guests || roomData?.max_guests || null,
          bed_configuration: roomType?.bed_configuration || roomData?.bed_configuration || null,
          room_size_sqm: roomType?.room_size_sqm || roomData?.room_size_sqm || null,
          has_balcony: roomType?.has_balcony || roomData?.has_balcony || false,
          has_kitchen: roomType?.has_kitchen || roomData?.has_kitchen || false,
          is_accessible: roomType?.is_accessible || roomData?.is_accessible || false,
          room_type_amenities: roomType?.room_amenities || roomData?.room_amenities || null,
          unit_amenities: roomUnit?.unit_amenities || null
        };
      });

      return transformedData;
    } catch (error) {
      console.error('Database error fetching basic reservations:', error);
      throw error;
    }
  }

  // Simple fallback method without joins
  async getReservationsWithFiltersSimple(filters = {}) {
    try {
      const {
        status,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        limit = 50,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      let query = supabaseAdmin
        .from('reservations')
        .select('*');

      // Apply basic filters
      if (status) {
        query = query.eq('status', status);
      }

      if (checkInDate) {
        query = query.eq('check_in_date', checkInDate);
      } else {
        if (checkInDateFrom) {
          query = query.gte('check_in_date', checkInDateFrom);
        }
        if (checkInDateTo) {
          query = query.lte('check_in_date', checkInDateTo);
        }
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching simple reservations:', error);
        throw new Error('Failed to fetch reservations');
      }

      // Transform basic data with minimal property info
      const transformedData = data.map(reservation => ({
        ...reservation,
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        guest_phone: reservation.booking_phone,
        guest_personal_email: reservation.guest_mail,
        // Use more descriptive fallbacks instead of "N/A"
        property_name: 'Property Information Unavailable',
        room_number: reservation.room_number || 'TBD',
        room_name: 'Standard Room',
        room_type_name: 'Standard',
      }));

      return transformedData;
    } catch (error) {
      console.error('Database error fetching simple reservations:', error);
      throw error;
    }
  }


  // Update admin verification status
  async updateAdminVerification(reservationId, verified) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({ admin_verified: verified })
        .eq('id', reservationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating admin verification:', error);
        throw new Error('Failed to update admin verification');
      }

      return data;
    } catch (error) {
      console.error('Database error updating admin verification:', error);
      throw error;
    }
  }

  // Log reservation webhook events
  async logReservationWebhook(beds24BookingId, payload, processed = false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservation_webhook_logs')
        .insert({
          beds24_booking_id: beds24BookingId,
          webhook_payload: payload,
          processed: processed,
          received_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging reservation webhook:', error);
        // Don't throw error for logging failures
      }

      return data;
    } catch (error) {
      console.error('Database error logging reservation webhook:', error);
      // Don't throw error for logging failures
    }
  }

  // Mark webhook event as processed
  async markWebhookEventProcessed(logId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservation_webhook_logs')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', logId)
        .select()
        .single();

      if (error) {
        console.error('Error marking webhook event as processed:', error);
      }

      return data;
    } catch (error) {
      console.error('Database error marking webhook event as processed:', error);
    }
  }

  // Check if webhook event already exists (prevent duplicates)
  async webhookEventExists(beds24BookingId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservation_webhook_logs')
        .select('id')
        .eq('beds24_booking_id', beds24BookingId)
        .order('received_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking webhook event existence:', error);
        return false;
      }

      // Consider duplicate if received within last 5 minutes
      if (data) {
        const lastReceived = new Date(data.received_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        return lastReceived > fiveMinutesAgo;
      }

      return false;
    } catch (error) {
      console.error('Database error checking webhook event existence:', error);
      return false;
    }
  }

  // Get dashboard statistics
  async getDashboardStats() {
    try {
      // Get total reservations
      const { count: totalReservations } = await supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true });

      // Get completed check-ins
      const { count: completedCheckins } = await supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

      // Get pending check-ins
      const { count: pendingCheckins } = await supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'invited');

      // Get verified check-ins (using admin_verified field in reservations)
      const { count: verifiedCheckins } = await supabaseAdmin
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('admin_verified', true)
        .not('checkin_submitted_at', 'is', null);

      // Get total properties
      const { count: totalProperties } = await supabaseAdmin
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get total room units (V5 schema)
      const { count: totalRooms } = await supabaseAdmin
        .from('room_units')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      return {
        totalReservations: totalReservations || 0,
        completedCheckins: completedCheckins || 0,
        pendingCheckins: pendingCheckins || 0,
        verifiedCheckins: verifiedCheckins || 0,
        totalProperties: totalProperties || 0,
        totalRooms: totalRooms || 0
      };
    } catch (error) {
      console.error('Database error fetching dashboard stats:', error);
      return {
        totalReservations: 0,
        completedCheckins: 0,
        pendingCheckins: 0,
        verifiedCheckins: 0,
        totalProperties: 0,
        totalRooms: 0
      };
    }
  }

  // Property Management Methods

  // Get all properties with their rooms
  async getAllProperties(userProfile = null) {
    try {
      // console.log('getAllProperties called with userProfile:', userProfile ? {
      //   id: userProfile.id,
      //   role: userProfile.role,
      //   name: `${userProfile.first_name} ${userProfile.last_name}`
      // } : 'null');

      let query = supabaseAdmin
        .from('properties')
        .select(`
          *,
          room_types (*)
        `)
        .eq('is_active', true);

      // Filter by owner_id if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('owner_id', userProfile.id);
      } else {
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        throw new Error('Failed to fetch properties');
      }

      if (userProfile?.role === 'owner') {
        data.forEach(property => {
          console.log(`  - ${property.name} (owner_id: ${property.owner_id})`);
        });
      }

      return data;
    } catch (error) {
      console.error('Database error fetching properties:', error);
      throw error;
    }
  }

  // Get specific property by ID
  async getPropertyById(propertyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select(`
          *
        `)
        .eq('id', propertyId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching property:', error);
        throw new Error('Failed to fetch property');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching property:', error);
      throw error;
    }
  }

  // Find property by Beds24 property ID
  async findPropertyByBeds24Id(beds24PropertyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select('*')
        .eq('beds24_property_id', beds24PropertyId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding property by Beds24 ID:', error);
        throw new Error('Failed to find property');
      }

      return data;
    } catch (error) {
      console.error('Database error finding property by Beds24 ID:', error);
      throw error;
    }
  }

  // Create new property
  async createProperty(propertyData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .insert({
          name: propertyData.name,
          address: propertyData.address,
          owner_id: propertyData.ownerId,
          description: propertyData.description,
          property_type: propertyData.propertyType || 'apartment',
          wifi_name: propertyData.wifiName,
          wifi_password: propertyData.wifiPassword,
          house_rules: propertyData.houseRules,
          check_in_instructions: propertyData.checkInInstructions,
          emergency_contact: propertyData.emergencyContact,
          property_amenities: propertyData.propertyAmenities,
          location_info: propertyData.locationInfo,
          access_time: propertyData.accessTime,
          default_cleaner_id: propertyData.defaultCleanerId,
          beds24_property_id: propertyData.beds24PropertyId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating property:', error);
        throw new Error('Failed to create property');
      }

      return data;
    } catch (error) {
      console.error('Database error creating property:', error);
      throw error;
    }
  }

  // Update property
  async updateProperty(propertyId, propertyData) {
    try {
      const updateData = {};
      
      if (propertyData.name !== undefined) updateData.name = propertyData.name;
      if (propertyData.address !== undefined) updateData.address = propertyData.address;
      if (propertyData.description !== undefined) updateData.description = propertyData.description;
      if (propertyData.propertyType !== undefined) updateData.property_type = propertyData.propertyType;
      if (propertyData.totalRooms !== undefined) updateData.total_rooms = propertyData.totalRooms;
      if (propertyData.wifiName !== undefined) updateData.wifi_name = propertyData.wifiName;
      if (propertyData.wifiPassword !== undefined) updateData.wifi_password = propertyData.wifiPassword;
      if (propertyData.houseRules !== undefined) updateData.house_rules = propertyData.houseRules;
      if (propertyData.checkInInstructions !== undefined) updateData.check_in_instructions = propertyData.checkInInstructions;
      if (propertyData.emergencyContact !== undefined) updateData.emergency_contact = propertyData.emergencyContact;
      if (propertyData.propertyAmenities !== undefined) updateData.property_amenities = propertyData.propertyAmenities;
      if (propertyData.locationInfo !== undefined) updateData.location_info = propertyData.locationInfo;
      if (propertyData.accessTime !== undefined) updateData.access_time = propertyData.accessTime;
      if (propertyData.defaultCleanerId !== undefined) updateData.default_cleaner_id = propertyData.defaultCleanerId;
      
      // Fix the field mapping for owner_id
      if (propertyData.ownerId !== undefined) updateData.owner_id = propertyData.ownerId;

      const { data, error } = await supabaseAdmin
        .from('properties')
        .update(updateData)
        .eq('id', propertyId)
        .select()
        .single();

      if (error) {
        console.error('Error updating property:', error);
        throw new Error('Failed to update property');
      }

      return data;
    } catch (error) {
      console.error('Database error updating property:', error);
      throw error;
    }
  }

  // Delete property (soft delete)
  async deleteProperty(propertyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .update({ is_active: false })
        .eq('id', propertyId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting property:', error);
        throw new Error('Failed to delete property');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting property:', error);
      throw error;
    }
  }

  // Create room (deprecated - use createRoomType and createRoomUnit instead)
  async createRoom(propertyId, roomData) {
    try {
      // This method is deprecated in V5 schema
      // For backward compatibility, we'll create a room type and unit
      console.warn('createRoom is deprecated. Use createRoomType and createRoomUnit instead.');
      
      // First create a room type
      const roomType = await this.createRoomType(propertyId, {
        name: roomData.roomName || roomData.roomType || 'Standard Room',
        description: `Room type for ${roomData.roomNumber}`,
        maxGuests: roomData.maxGuests || 2,
        roomAmenities: roomData.roomAmenities,
        bedConfiguration: roomData.bedConfiguration,
        roomSizeSqm: roomData.roomSizeSqm,
        hasBalcony: roomData.hasBalcony || false,
        hasKitchen: roomData.hasKitchen || false,
        isAccessible: roomData.isAccessible || false
      });

      // Then create a room unit
      const roomUnit = await this.createRoomUnit(roomType.id, {
        unitNumber: roomData.roomNumber,
        floorNumber: roomData.floorNumber,
        accessCode: roomData.accessCode,
        accessInstructions: roomData.accessInstructions,
        wifiName: roomData.wifiName,
        wifiPassword: roomData.wifiPassword
      });

      // Return combined data for backward compatibility
      return {
        id: roomUnit.id,
        property_id: propertyId,
        room_number: roomUnit.unit_number,
        room_name: roomType.name,
        room_type: roomType.name,
        max_guests: roomType.max_guests,
        access_code: roomUnit.access_code,
        access_instructions: roomUnit.access_instructions,
        room_amenities: roomType.room_amenities,
        room_size_sqm: roomType.room_size_sqm,
        bed_configuration: roomType.bed_configuration,
        floor_number: roomUnit.floor_number,
        wifi_name: roomUnit.wifi_name,
        wifi_password: roomUnit.wifi_password,
        has_balcony: roomType.has_balcony,
        has_kitchen: roomType.has_kitchen,
        is_accessible: roomType.is_accessible,
        room_type_id: roomType.id,
        room_unit_id: roomUnit.id
      };
    } catch (error) {
      console.error('Database error creating room:', error);
      throw error;
    }
  }

  // Update room (deprecated - use updateRoomType and updateRoomUnit instead)
  async updateRoom(roomId, roomData) {
    try {
      // This method is deprecated in V5 schema
      console.warn('updateRoom is deprecated. Use updateRoomType and updateRoomUnit instead.');
      
      // For backward compatibility, we'll try to update both room type and unit
      // This assumes roomId refers to a room_unit_id
      
      // First, get the room unit to find the room type
      const { data: roomUnit, error: roomUnitError } = await supabaseAdmin
        .from('room_units')
        .select('*, room_types(*)')
        .eq('id', roomId)
        .single();

      if (roomUnitError) {
        console.error('Error fetching room unit for update:', roomUnitError);
        throw new Error('Failed to find room unit for update');
      }

      // Update room type if relevant fields are provided
      if (roomData.roomName || roomData.roomType || roomData.maxGuests || 
          roomData.roomAmenities || roomData.bedConfiguration || roomData.roomSizeSqm ||
          roomData.hasBalcony !== undefined || roomData.hasKitchen !== undefined || 
          roomData.isAccessible !== undefined) {
        
        await this.updateRoomType(roomUnit.room_type_id, {
          name: roomData.roomName || roomData.roomType,
          maxGuests: roomData.maxGuests,
          roomAmenities: roomData.roomAmenities,
          bedConfiguration: roomData.bedConfiguration,
          roomSizeSqm: roomData.roomSizeSqm,
          hasBalcony: roomData.hasBalcony,
          hasKitchen: roomData.hasKitchen,
          isAccessible: roomData.isAccessible
        });
      }

      // Update room unit if relevant fields are provided
      if (roomData.roomNumber || roomData.floorNumber !== undefined || 
          roomData.accessCode !== undefined || roomData.accessInstructions !== undefined ||
          roomData.wifiName !== undefined || roomData.wifiPassword !== undefined) {
        
        await this.updateRoomUnit(roomId, {
          unitNumber: roomData.roomNumber,
          floorNumber: roomData.floorNumber,
          accessCode: roomData.accessCode,
          accessInstructions: roomData.accessInstructions,
          wifiName: roomData.wifiName,
          wifiPassword: roomData.wifiPassword
        });
      }

      // Return updated room unit with room type for backward compatibility
      const { data: updatedRoomUnit, error: fetchError } = await supabaseAdmin
        .from('room_units')
        .select(`
          *,
          room_types (*)
        `)
        .eq('id', roomId)
        .single();

      if (fetchError) {
        console.error('Error fetching updated room unit:', fetchError);
        throw new Error('Failed to fetch updated room data');
      }

      // Transform to legacy format
      return {
        id: updatedRoomUnit.id,
        room_number: updatedRoomUnit.unit_number,
        room_name: updatedRoomUnit.room_types.name,
        room_type: updatedRoomUnit.room_types.name,
        max_guests: updatedRoomUnit.room_types.max_guests,
        access_code: updatedRoomUnit.access_code,
        access_instructions: updatedRoomUnit.access_instructions,
        room_amenities: updatedRoomUnit.room_types.room_amenities,
        room_size_sqm: updatedRoomUnit.room_types.room_size_sqm,
        bed_configuration: updatedRoomUnit.room_types.bed_configuration,
        floor_number: updatedRoomUnit.floor_number,
        wifi_name: updatedRoomUnit.wifi_name,
        wifi_password: updatedRoomUnit.wifi_password,
        has_balcony: updatedRoomUnit.room_types.has_balcony,
        has_kitchen: updatedRoomUnit.room_types.has_kitchen,
        is_accessible: updatedRoomUnit.room_types.is_accessible,
        room_type_id: updatedRoomUnit.room_types.id,
        room_unit_id: updatedRoomUnit.id
      };
    } catch (error) {
      console.error('Database error updating room:', error);
      throw error;
    }
  }

  // Delete room (deprecated - use deleteRoomUnit instead)
  async deleteRoom(roomId) {
    try {
      // This method is deprecated in V5 schema
      console.warn('deleteRoom is deprecated. Use deleteRoomUnit instead.');
      
      // For backward compatibility, we'll try to delete the room unit
      // This assumes roomId refers to a room_unit_id
      return await this.deleteRoomUnit(roomId);
    } catch (error) {
      console.error('Database error deleting room:', error);
      throw error;
    }
  }

  // Get properties with statistics (updated for V5 schema)
  async getPropertiesWithStats(userProfile = null) {
    try {
      // console.log('getPropertiesWithStats called with userProfile:', userProfile ? {
      //   id: userProfile.id,
      //   role: userProfile.role,
      //   name: `${userProfile.first_name} ${userProfile.last_name}`
      // } : 'null');

      let query = supabaseAdmin
        .from('properties')
        .select(`
          *,
          room_types (
            id,
            name,
            max_guests,
            base_price,
            is_active,
            room_units (
              id,
              unit_number,
              is_active,
              reservations (
                id,
                status,
                check_in_date,
                check_out_date,
                total_amount
              )
            )
          )
        `)
        .eq('is_active', true);

      // Filter by owner_id if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('owner_id', userProfile.id);
      } else {
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties with stats:', error);
        throw new Error('Failed to fetch properties with stats');
      }

      if (userProfile?.role === 'owner') {
        data.forEach(property => {
          console.log(`  - ${property.name} (owner_id: ${property.owner_id})`);
        });
      }

      // Calculate statistics for each property
      const propertiesWithStats = data.map(property => {
        // Handle V5 structure (room_types/room_units)
        let totalRoomUnits = 0;
        let allReservations = [];

        // V5 structure: room_types -> room_units
        if (property.room_types && property.room_types.length > 0) {
          const activeRoomTypes = property.room_types.filter(rt => rt.is_active);
          const activeRoomUnits = activeRoomTypes.flatMap(rt => 
            rt.room_units?.filter(ru => ru.is_active) || []
          );
          totalRoomUnits = activeRoomUnits.length;
          allReservations = activeRoomUnits.flatMap(ru => ru.reservations || []);
        }

        const completedReservations = allReservations.filter(res => res.status === 'completed');
        const upcomingReservations = allReservations.filter(res => 
          res.status === 'invited' && new Date(res.check_in_date) >= new Date()
        );

        const totalRevenue = completedReservations.reduce((sum, res) => sum + (res.total_amount || 0), 0);
        const occupancyRate = totalRoomUnits > 0 ? 
          (completedReservations.length / (totalRoomUnits * 30)) * 100 : 0; // Rough monthly occupancy

        return {
          ...property,
          stats: {
            totalRoomTypes: property.room_types?.filter(rt => rt.is_active).length || 0,
            totalRoomUnits: totalRoomUnits,
            totalRooms: totalRoomUnits, // For backward compatibility
            totalReservations: allReservations.length,
            completedReservations: completedReservations.length,
            upcomingReservations: upcomingReservations.length,
            totalRevenue: totalRevenue,
            occupancyRate: Math.min(occupancyRate, 100) // Cap at 100%
          }
        };
      });

      return propertiesWithStats;
    } catch (error) {
      console.error('Database error fetching properties with stats:', error);
      throw error;
    }
  }

  // Room Type Management Methods

  // Get room types by property
  async getRoomTypesByProperty(propertyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .select('*')
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching room types:', error);
        throw new Error('Failed to fetch room types');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching room types:', error);
      throw error;
    }
  }

  // Get room types with their room units
  async getRoomTypesWithUnits(propertyId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .select(`
          *,
          room_units (*)
        `)
        .eq('property_id', propertyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching room types with units:', error);
        throw new Error('Failed to fetch room types with units');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching room types with units:', error);
      throw error;
    }
  }

  // Find room type by Beds24 room type ID
  async findRoomTypeByBeds24Id(beds24RoomTypeId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .select('*')
        .eq('beds24_roomtype_id', beds24RoomTypeId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding room type by Beds24 ID:', error);
        throw new Error('Failed to find room type');
      }

      return data;
    } catch (error) {
      console.error('Database error finding room type by Beds24 ID:', error);
      throw error;
    }
  }

  // Create room type
  async createRoomType(propertyId, roomTypeData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .insert({
          property_id: propertyId,
          name: roomTypeData.name,
          description: roomTypeData.description,
          max_guests: roomTypeData.maxGuests,
          base_price: roomTypeData.basePrice,
          currency: roomTypeData.currency || 'USD',
          room_amenities: roomTypeData.roomAmenities,
          bed_configuration: roomTypeData.bedConfiguration,
          room_size_sqm: roomTypeData.roomSizeSqm,
          has_balcony: roomTypeData.hasBalcony || false,
          has_kitchen: roomTypeData.hasKitchen || false,
          is_accessible: roomTypeData.isAccessible || false,
          beds24_roomtype_id: roomTypeData.beds24RoomTypeId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating room type:', error);
        throw new Error('Failed to create room type');
      }

      return data;
    } catch (error) {
      console.error('Database error creating room type:', error);
      throw error;
    }
  }

  // Update room type
  async updateRoomType(roomTypeId, roomTypeData) {
    try {
      const updateData = {};
      
      if (roomTypeData.name !== undefined) updateData.name = roomTypeData.name;
      if (roomTypeData.description !== undefined) updateData.description = roomTypeData.description;
      if (roomTypeData.maxGuests !== undefined) updateData.max_guests = roomTypeData.maxGuests;
      if (roomTypeData.basePrice !== undefined) updateData.base_price = roomTypeData.basePrice;
      if (roomTypeData.currency !== undefined) updateData.currency = roomTypeData.currency;
      if (roomTypeData.roomAmenities !== undefined) updateData.room_amenities = roomTypeData.roomAmenities;
      if (roomTypeData.bedConfiguration !== undefined) updateData.bed_configuration = roomTypeData.bedConfiguration;
      if (roomTypeData.roomSizeSqm !== undefined) updateData.room_size_sqm = roomTypeData.roomSizeSqm;
      if (roomTypeData.hasBalcony !== undefined) updateData.has_balcony = roomTypeData.hasBalcony;
      if (roomTypeData.hasKitchen !== undefined) updateData.has_kitchen = roomTypeData.hasKitchen;
      if (roomTypeData.isAccessible !== undefined) updateData.is_accessible = roomTypeData.isAccessible;

      const { data, error } = await supabaseAdmin
        .from('room_types')
        .update(updateData)
        .eq('id', roomTypeId)
        .select()
        .single();

      if (error) {
        console.error('Error updating room type:', error);
        throw new Error('Failed to update room type');
      }

      return data;
    } catch (error) {
      console.error('Database error updating room type:', error);
      throw error;
    }
  }

  // Delete room type (hard delete)
  async deleteRoomType(roomTypeId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .delete()
        .eq('id', roomTypeId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting room type:', error);
        throw new Error('Failed to delete room type');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting room type:', error);
      throw error;
    }
  }

  // Room Unit Management Methods

  // Get room units by room type
  async getRoomUnitsByRoomType(roomTypeId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_units')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .eq('is_active', true)
        .order('unit_number', { ascending: true });

      if (error) {
        console.error('Error fetching room units:', error);
        throw new Error('Failed to fetch room units');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching room units:', error);
      throw error;
    }
  }

  // Find room unit by Beds24 unit ID
  async findRoomUnitByBeds24Id(beds24UnitId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_units')
        .select('*')
        .eq('beds24_unit_id', beds24UnitId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding room unit by Beds24 ID:', error);
        throw new Error('Failed to find room unit');
      }

      return data;
    } catch (error) {
      console.error('Database error finding room unit by Beds24 ID:', error);
      throw error;
    }
  }

  // Find room unit by room type ID and Beds24 unit ID (more specific lookup)
  async findRoomUnitByRoomTypeAndBeds24Id(roomTypeId, beds24UnitId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_units')
        .select('*')
        .eq('room_type_id', roomTypeId)
        .eq('beds24_unit_id', beds24UnitId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error finding room unit by room type and Beds24 ID:', error);
        throw new Error('Failed to find room unit');
      }

      return data;
    } catch (error) {
      console.error('Database error finding room unit by room type and Beds24 ID:', error);
      throw error;
    }
  }

  // Create room unit
  async createRoomUnit(roomTypeId, roomUnitData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_units')
        .insert({
          room_type_id: roomTypeId,
          unit_number: roomUnitData.unitNumber,
          floor_number: roomUnitData.floorNumber,
          access_code: roomUnitData.accessCode,
          access_instructions: roomUnitData.accessInstructions,
          wifi_name: roomUnitData.wifiName,
          wifi_password: roomUnitData.wifiPassword,
          unit_amenities: roomUnitData.unitAmenities,
          maintenance_notes: roomUnitData.maintenanceNotes,
          beds24_unit_id: roomUnitData.beds24UnitId
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating room unit:', error);
        throw new Error('Failed to create room unit');
      }

      return data;
    } catch (error) {
      console.error('Database error creating room unit:', error);
      throw error;
    }
  }

  // Update room unit
  async updateRoomUnit(roomUnitId, roomUnitData) {
    try {
      const updateData = {};
      
      if (roomUnitData.unitNumber !== undefined) updateData.unit_number = roomUnitData.unitNumber;
      if (roomUnitData.floorNumber !== undefined) updateData.floor_number = roomUnitData.floorNumber;
      if (roomUnitData.accessCode !== undefined) updateData.access_code = roomUnitData.accessCode;
      if (roomUnitData.accessInstructions !== undefined) updateData.access_instructions = roomUnitData.accessInstructions;
      if (roomUnitData.wifiName !== undefined) updateData.wifi_name = roomUnitData.wifiName;
      if (roomUnitData.wifiPassword !== undefined) updateData.wifi_password = roomUnitData.wifiPassword;
      if (roomUnitData.unitAmenities !== undefined) updateData.unit_amenities = roomUnitData.unitAmenities;
      if (roomUnitData.maintenanceNotes !== undefined) updateData.maintenance_notes = roomUnitData.maintenanceNotes;

      const { data, error } = await supabaseAdmin
        .from('room_units')
        .update(updateData)
        .eq('id', roomUnitId)
        .select()
        .single();

      if (error) {
        console.error('Error updating room unit:', error);
        throw new Error('Failed to update room unit');
      }

      return data;
    } catch (error) {
      console.error('Database error updating room unit:', error);
      throw error;
    }
  }

  // Delete room unit (hard delete)
  async deleteRoomUnit(roomUnitId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_units')
        .delete()
        .eq('id', roomUnitId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting room unit:', error);
        throw new Error('Failed to delete room unit');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting room unit:', error);
      throw error;
    }
  }

  // User Management Methods

  // Get all users
  async getAllUsers(limit = 50, offset = 0, role = null) {
    try {
      let query = supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (role) {
        query = query.eq('role', role);
      }

      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching users:', error);
      throw error;
    }
  }

  // Get specific user by ID
  async getUserById(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        throw new Error('Failed to fetch user');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching user:', error);
      throw error;
    }
  }

  // Create new user (with Supabase Auth integration)
  async createUser(userData) {
    try {
      // First, create the user in Supabase Auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password || 'TempPassword123!', // Temporary password
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role
        }
      });

      if (authError) {
        console.error('Error creating auth user:', authError);
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }

      // Then, create the user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: authUser.user.id, // Use the auth user's ID
          role: userData.role,
          first_name: userData.firstName,
          last_name: userData.lastName,
          phone: userData.phone,
          company_name: userData.companyName,
          is_active: userData.isActive !== undefined ? userData.isActive : true
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        
        // If profile creation fails, clean up the auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        } catch (cleanupError) {
          console.error('Error cleaning up auth user:', cleanupError);
        }
        
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      // Return the profile data with auth info
      return {
        ...profile,
        email: authUser.user.email,
        auth_id: authUser.user.id
      };
    } catch (error) {
      console.error('Database error creating user:', error);
      throw error;
    }
  }

  // Update user
  async updateUser(userId, userData) {
    try {
      const updateData = {};
      
      if (userData.role !== undefined) updateData.role = userData.role;
      if (userData.firstName !== undefined) updateData.first_name = userData.firstName;
      if (userData.lastName !== undefined) updateData.last_name = userData.lastName;
      if (userData.phone !== undefined) updateData.phone = userData.phone;
      if (userData.companyName !== undefined) updateData.company_name = userData.companyName;
      if (userData.isActive !== undefined) updateData.is_active = userData.isActive;

      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating user:', error);
        throw new Error('Failed to update user');
      }

      return data;
    } catch (error) {
      console.error('Database error updating user:', error);
      throw error;
    }
  }

  // Delete user (soft delete)
  async deleteUser(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting user:', error);
        throw new Error('Failed to delete user');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting user:', error);
      throw error;
    }
  }

  // Get user statistics
  async getUserStats() {
    try {
      // Get total users by role
      const { count: totalUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      const { count: adminUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);

      const { count: ownerUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'owner')
        .eq('is_active', true);

      const { count: guestUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'guest')
        .eq('is_active', true);

      const { count: cleanerUsers } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'cleaner')
        .eq('is_active', true);

      return {
        totalUsers: totalUsers || 0,
        adminUsers: adminUsers || 0,
        ownerUsers: ownerUsers || 0,
        guestUsers: guestUsers || 0,
        cleanerUsers: cleanerUsers || 0
      };
    } catch (error) {
      console.error('Database error fetching user stats:', error);
      return {
        totalUsers: 0,
        adminUsers: 0,
        ownerUsers: 0,
        guestUsers: 0,
        cleanerUsers: 0
      };
    }
  }

  // Get users with their associated data (properties for owners, etc.)
  async getUsersWithDetails(limit = 50, offset = 0, role = null) {
    try {
      let query = supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          properties!properties_owner_id_fkey (
            id,
            name,
            address,
            is_active
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (role) {
        query = query.eq('role', role);
      }

      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching users with details:', error);
        throw new Error('Failed to fetch users with details');
      }

      // Add computed stats for each user
      const usersWithStats = data.map(user => {
        const activeProperties = user.properties?.filter(p => p.is_active) || [];

        return {
          ...user,
          stats: {
            totalProperties: activeProperties.length,
            recentTasks: 0, // Remove cleaning_tasks for now since it may not exist
            completedTasks: 0
          }
        };
      });

      return usersWithStats;
    } catch (error) {
      console.error('Database error fetching users with details:', error);
      throw error;
    }
  }

  // Get complete guest dashboard data by check-in token
  async getGuestDashboardData(checkinToken) {
    try {
      // First, get the reservation using the reservations_details view for comprehensive data
      const { data, error } = await supabaseAdmin
        .from('reservations_details')
        .select('*')
        .eq('check_in_token', checkinToken)
        .single();

      if (error) {
        console.error('Error fetching guest dashboard data:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // Structure the data for the frontend
      const dashboardData = {
        reservation: {
          id: data.id,
          beds24_booking_id: data.beds24_booking_id,
          booking_name: data.booking_name,
          booking_email: data.booking_email,
          booking_phone: data.booking_phone,
          check_in_date: data.check_in_date,
          check_out_date: data.check_out_date,
          num_guests: data.num_guests,
          num_adults: data.num_adults,
          num_children: data.num_children,
          total_amount: data.total_amount,
          currency: data.currency,
          status: data.status,
          special_requests: data.special_requests,
          
          // Guest information
          guest_firstname: data.guest_firstname,
          guest_lastname: data.guest_lastname,
          guest_contact: data.guest_contact,
          guest_mail: data.guest_mail,
          guest_address: data.guest_address,
          estimated_checkin_time: data.estimated_checkin_time,
          travel_purpose: data.travel_purpose,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          passport_url: data.passport_url,
          agreement_accepted: data.agreement_accepted,
          checkin_submitted_at: data.checkin_submitted_at,
          admin_verified: data.admin_verified,
          verified_at: data.verified_at,
          
          // Computed fields for backward compatibility
          guest_name: data.booking_name,
          guest_email: data.booking_email,
          guest_phone: data.booking_phone
        },
        
        property: {
          id: data.property_id,
          name: data.property_name,
          address: data.property_address,
          description: data.description,
          property_type: data.property_type,
          wifi_name: data.property_wifi_name || data.wifi_name,
          wifi_password: data.property_wifi_password || data.wifi_password,
          house_rules: data.house_rules,
          check_in_instructions: data.check_in_instructions,
          emergency_contact: data.property_emergency_contact,
          property_amenities: data.property_amenities,
          location_info: data.location_info,
          access_time: data.access_time // Important for time-based room access
        },
        
        room: {
          // Room Type information
          room_type_id: data.room_type_id,
          room_type_name: data.room_type_name || 'Standard Room',
          room_type_description: data.room_type_description,
          max_guests: data.room_type_max_guests || data.max_guests,
          base_price: data.base_price,
          room_amenities: data.room_type_amenities,
          bed_configuration: data.bed_configuration,
          room_size_sqm: data.room_size_sqm,
          has_balcony: data.room_type_has_balcony,
          has_kitchen: data.room_type_has_kitchen,
          is_accessible: data.room_type_is_accessible,
          
          // Room Unit information
          room_unit_id: data.room_unit_id,
          unit_number: data.unit_number,
          floor_number: data.floor_number,
          access_code: data.access_code,
          access_instructions: data.access_instructions,
          wifi_name: data.unit_wifi_name,
          wifi_password: data.unit_wifi_password,
          unit_amenities: data.unit_amenities,
          maintenance_notes: data.maintenance_notes,
          
          // Backward compatibility fields
          room_number: data.unit_number || data.room_number || 'TBD',
          room_name: data.room_type_name || 'Standard Room',
          amenities: data.room_type_amenities || data.unit_amenities || {}
        },
        
        // Additional computed fields
        checkin_status: data.checkin_submitted_at ? 'completed' : 'pending',
        can_access_room: this.canAccessRoom(data),
        
        // Meta information
        last_updated: new Date().toISOString()
      };

      return dashboardData;
    } catch (error) {
      console.error('Database error fetching guest dashboard data:', error);
      throw error;
    }
  }

  // Helper method to determine if guest can access room details
  canAccessRoom(reservationData) {
    try {
      // Check if check-in is completed
      if (!reservationData.checkin_submitted_at) {
        return false;
      }

      // Check if today is the check-in date
      const today = new Date().toDateString();
      const checkinDate = new Date(reservationData.check_in_date).toDateString();
      
      if (today !== checkinDate) {
        return false;
      }

      // Check if current time is past the access time
      if (reservationData.access_time) {
        const currentTime = new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
        const accessTime = reservationData.access_time; // "14:00:00"
        
        return currentTime >= accessTime;
      }

      // If no access time is set, allow access after check-in completion
      return true;
    } catch (error) {
      console.error('Error determining room access:', error);
      return false;
    }
  }

  // Cleaning Task Management Methods

  // Get cleaning tasks with comprehensive filtering
  async getCleaningTasks(filters = {}, userProfile = null) {
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
        limit = 50,
        offset = 0,
        sortBy = 'task_date',
        sortOrder = 'desc'
      } = filters;

      // console.log('getCleaningTasks called with userProfile:', userProfile ? {
      //   id: userProfile.id,
      //   role: userProfile.role,
      //   name: `${userProfile.first_name} ${userProfile.last_name}`
      // } : 'null');

      // Build query with comprehensive joins
      let query = supabaseAdmin
        .from('cleaning_tasks')
        .select(`
          *,
          properties (
            id,
            name,
            address,
            wifi_name,
            wifi_password,
            emergency_contact
          ),
          room_units (
            id,
            unit_number,
            floor_number,
            access_code,
            access_instructions,
            room_types (
              id,
              name,
              description,
              max_guests,
              bed_configuration
            )
          ),
          reservations (
            id,
            beds24_booking_id,
            booking_name,
            booking_email,
            booking_phone,
            check_in_date,
            check_out_date,
            num_guests,
            special_requests,
            guest_firstname,
            guest_lastname,
            guest_contact
          ),
          user_profiles (
            id,
            first_name,
            last_name,
            phone
          )
        `);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (cleanerId) {
        query = query.eq('cleaner_id', cleanerId);
      }

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (roomUnitId) {
        query = query.eq('room_unit_id', roomUnitId);
      }

      // Filter by owner_id if user is an owner - join with properties table
      if (userProfile?.role === 'owner') {
        console.log(`Filtering cleaning tasks by owner_id: ${userProfile.id}`);
        // We need to filter by properties that belong to this owner
        // Since we're already joining with properties, we can filter on the properties.owner_id
        query = query.eq('properties.owner_id', userProfile.id);
      } else {
  
      }

      if (taskType) {
        query = query.eq('task_type', taskType);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (taskDate) {
        query = query.eq('task_date', taskDate);
      } else {
        if (taskDateFrom) {
          query = query.gte('task_date', taskDateFrom);
        }
        if (taskDateTo) {
          query = query.lte('task_date', taskDateTo);
        }
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cleaning tasks:', error);
        throw new Error('Failed to fetch cleaning tasks');
      }

      // Transform data for frontend consumption
      const transformedTasks = data.map(task => ({
        ...task,
        // Property information
        property_name: task.properties?.name || 'Unknown Property',
        property_address: task.properties?.address || null,
        property_wifi_name: task.properties?.wifi_name || null,
        property_emergency_contact: task.properties?.emergency_contact || null,
        
        // Room information
        room_unit_number: task.room_units?.unit_number || 'Unknown',
        room_floor_number: task.room_units?.floor_number || null,
        room_access_code: task.room_units?.access_code || null,
        room_access_instructions: task.room_units?.access_instructions || null,
        room_type_name: task.room_units?.room_types?.name || 'Standard Room',
        room_type_description: task.room_units?.room_types?.description || null,
        room_max_guests: task.room_units?.room_types?.max_guests || null,
        room_bed_configuration: task.room_units?.room_types?.bed_configuration || null,
        
        // Reservation information
        reservation_booking_id: task.reservations?.beds24_booking_id || null,
        guest_name: task.reservations?.booking_name || 
                   `${task.reservations?.guest_firstname || ''} ${task.reservations?.guest_lastname || ''}`.trim() || 
                   'Unknown Guest',
        guest_email: task.reservations?.booking_email || task.reservations?.guest_mail || null,
        guest_phone: task.reservations?.booking_phone || task.reservations?.guest_contact || null,
        guest_checkin_date: task.reservations?.check_in_date || null,
        guest_checkout_date: task.reservations?.check_out_date || null,
        guest_count: task.reservations?.num_guests || null,
        guest_special_requests: task.reservations?.special_requests || null,
        
        // Cleaner information
        cleaner_name: task.user_profiles ? 
                     `${task.user_profiles.first_name} ${task.user_profiles.last_name}`.trim() : 
                     null,
        cleaner_phone: task.user_profiles?.phone || null,
        
        // Computed fields
        is_overdue: task.status === 'pending' && new Date(task.task_date) < new Date(),
        duration_minutes: task.estimated_duration || 0,
        
        // Clean up nested objects for simpler frontend handling
        property: task.properties,
        room_unit: task.room_units,
        reservation: task.reservations,
        cleaner: task.user_profiles
      }));

      return transformedTasks;
    } catch (error) {
      console.error('Database error fetching cleaning tasks:', error);
      throw error;
    }
  }

  // Get cleaning task statistics
  async getCleaningTaskStats(filters = {}) {
    try {
      const {
        propertyId,
        cleanerId,
        taskDate,
        taskDateFrom,
        taskDateTo
      } = filters;

      // Create base query builder function
      const createBaseQuery = () => {
        let query = supabaseAdmin.from('cleaning_tasks');
        
        if (propertyId) {
          query = query.eq('property_id', propertyId);
        }

        if (cleanerId) {
          query = query.eq('cleaner_id', cleanerId);
        }

        if (taskDate) {
          query = query.eq('task_date', taskDate);
        } else {
          if (taskDateFrom) {
            query = query.gte('task_date', taskDateFrom);
          }
          if (taskDateTo) {
            query = query.lte('task_date', taskDateTo);
          }
        }
        
        return query;
      };

      // Get counts by status
      const [totalResult, pendingResult, inProgressResult, completedResult] = await Promise.all([
        createBaseQuery().select('*', { count: 'exact', head: true }),
        createBaseQuery().eq('status', 'pending').select('*', { count: 'exact', head: true }),
        createBaseQuery().eq('status', 'in_progress').select('*', { count: 'exact', head: true }),
        createBaseQuery().eq('status', 'completed').select('*', { count: 'exact', head: true })
      ]);

      // Get overdue tasks (pending tasks past their date)
      const today = new Date().toISOString().split('T')[0];
      const { count: overdueCount } = await createBaseQuery()
        .eq('status', 'pending')
        .lt('task_date', today)
        .select('*', { count: 'exact', head: true });

      // Get tasks by type
      const [checkoutResult, checkinResult, maintenanceResult] = await Promise.all([
        createBaseQuery().eq('task_type', 'checkout').select('*', { count: 'exact', head: true }),
        createBaseQuery().eq('task_type', 'checkin_preparation').select('*', { count: 'exact', head: true }),
        createBaseQuery().eq('task_type', 'maintenance').select('*', { count: 'exact', head: true })
      ]);

      // Get average completion time for completed tasks
      const { data: completedTasks } = await createBaseQuery()
        .eq('status', 'completed')
        .not('started_at', 'is', null)
        .not('completed_at', 'is', null)
        .select('started_at, completed_at, estimated_duration');

      let averageCompletionTime = 0;
      if (completedTasks && completedTasks.length > 0) {
        const totalTime = completedTasks.reduce((sum, task) => {
          const start = new Date(task.started_at);
          const end = new Date(task.completed_at);
          const duration = (end - start) / (1000 * 60); // Convert to minutes
          return sum + duration;
        }, 0);
        averageCompletionTime = Math.round(totalTime / completedTasks.length);
      }

      return {
        totalTasks: totalResult.count || 0,
        pendingTasks: pendingResult.count || 0,
        inProgressTasks: inProgressResult.count || 0,
        completedTasks: completedResult.count || 0,
        overdueTasks: overdueCount || 0,
        
        // Tasks by type
        checkoutTasks: checkoutResult.count || 0,
        checkinTasks: checkinResult.count || 0,
        maintenanceTasks: maintenanceResult.count || 0,
        
        // Performance metrics
        averageCompletionTime: averageCompletionTime,
        completionRate: totalResult.count > 0 ? 
          Math.round((completedResult.count / totalResult.count) * 100) : 0
      };
    } catch (error) {
      console.error('Database error fetching cleaning task stats:', error);
      return {
        totalTasks: 0,
        pendingTasks: 0,
        inProgressTasks: 0,
        completedTasks: 0,
        overdueTasks: 0,
        checkoutTasks: 0,
        checkinTasks: 0,
        maintenanceTasks: 0,
        averageCompletionTime: 0,
        completionRate: 0
      };
    }
  }

  // Create a new cleaning task
  async createCleaningTask(taskData) {
    try {
      const insertData = {
        property_id: taskData.propertyId,
        room_unit_id: taskData.roomUnitId,
        reservation_id: taskData.reservationId,
        cleaner_id: taskData.cleanerId || null,
        task_date: taskData.taskDate,
        task_type: taskData.taskType || 'checkout',
        status: taskData.status || 'pending',
        priority: taskData.priority || 'normal',
        estimated_duration: taskData.estimatedDuration || null,
        special_notes: taskData.specialNotes || null,
        assigned_at: taskData.cleanerId ? new Date().toISOString() : null
      };

      const { data, error } = await supabaseAdmin
        .from('cleaning_tasks')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating cleaning task:', error);
        throw new Error('Failed to create cleaning task');
      }

      return data;
    } catch (error) {
      console.error('Database error creating cleaning task:', error);
      throw error;
    }
  }

  // Update a cleaning task
  async updateCleaningTask(taskId, updateData) {
    try {
      const updateFields = {};
      
      if (updateData.cleanerId !== undefined) {
        updateFields.cleaner_id = updateData.cleanerId;
        if (updateData.cleanerId && !updateData.assigned_at) {
          updateFields.assigned_at = new Date().toISOString();
        }
      }
      
      if (updateData.status !== undefined) {
        updateFields.status = updateData.status;
        
        // Auto-set timestamps based on status changes
        if (updateData.status === 'in_progress' && !updateData.started_at) {
          updateFields.started_at = new Date().toISOString();
        } else if (updateData.status === 'completed' && !updateData.completed_at) {
          updateFields.completed_at = new Date().toISOString();
        }
      }
      
      if (updateData.taskDate !== undefined) updateFields.task_date = updateData.taskDate;
      if (updateData.taskType !== undefined) updateFields.task_type = updateData.taskType;
      if (updateData.priority !== undefined) updateFields.priority = updateData.priority;
      if (updateData.estimatedDuration !== undefined) updateFields.estimated_duration = updateData.estimatedDuration;
      if (updateData.specialNotes !== undefined) updateFields.special_notes = updateData.specialNotes;
      if (updateData.startedAt !== undefined) updateFields.started_at = updateData.startedAt;
      if (updateData.completedAt !== undefined) updateFields.completed_at = updateData.completedAt;

      const { data, error } = await supabaseAdmin
        .from('cleaning_tasks')
        .update(updateFields)
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error updating cleaning task:', error);
        throw new Error('Failed to update cleaning task');
      }

      return data;
    } catch (error) {
      console.error('Database error updating cleaning task:', error);
      throw error;
    }
  }

  // Delete a cleaning task
  async deleteCleaningTask(taskId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cleaning_tasks')
        .delete()
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting cleaning task:', error);
        throw new Error('Failed to delete cleaning task');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting cleaning task:', error);
      throw error;
    }
  }

  // Assign cleaner to task
  async assignCleanerToTask(taskId, cleanerId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cleaning_tasks')
        .update({
          cleaner_id: cleanerId,
          assigned_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select()
        .single();

      if (error) {
        console.error('Error assigning cleaner to task:', error);
        throw new Error('Failed to assign cleaner to task');
      }

      return data;
    } catch (error) {
      console.error('Database error assigning cleaner to task:', error);
      throw error;
    }
  }

  // Get cleaning tasks for a specific cleaner (for CleanerDashboard)
  async getCleanerTasks(cleanerId, filters = {}) {
    try {
      const {
        status,
        taskDate,
        taskDateFrom,
        taskDateTo,
        limit = 50,
        offset = 0
      } = filters;

      let query = supabaseAdmin
        .from('cleaning_tasks')
        .select(`
          *,
          properties (
            name,
            address,
            wifi_name,
            wifi_password,
            emergency_contact
          ),
          room_units (
            unit_number,
            floor_number,
            access_code,
            access_instructions,
            room_types (
              name,
              description,
              bed_configuration
            )
          ),
          reservations (
            booking_name,
            booking_email,
            check_in_date,
            check_out_date,
            num_guests,
            special_requests,
            guest_firstname,
            guest_lastname
          )
        `)
        .eq('cleaner_id', cleanerId);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (taskDate) {
        query = query.eq('task_date', taskDate);
      } else {
        if (taskDateFrom) {
          query = query.gte('task_date', taskDateFrom);
        }
        if (taskDateTo) {
          query = query.lte('task_date', taskDateTo);
        }
      }

      // Sort by task date and priority
      query = query.order('task_date', { ascending: true })
                   .order('priority', { ascending: false });

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cleaner tasks:', error);
        throw new Error('Failed to fetch cleaner tasks');
      }

      // Transform data for CleanerDashboard compatibility
      const transformedTasks = data.map(task => ({
        id: task.id,
        apartmentName: task.properties?.name || 'Unknown Property',
        apartmentAddress: task.properties?.address || 'Unknown Address',
        roomNumber: task.room_units?.unit_number || 'Unknown',
        taskDate: task.task_date,
        taskType: task.task_type,
        status: task.status,
        estimatedDuration: task.estimated_duration || 120,
        specialNotes: task.special_notes || null,
        guestName: task.reservations?.booking_name || 
                  `${task.reservations?.guest_firstname || ''} ${task.reservations?.guest_lastname || ''}`.trim() ||
                  null,
        checkOutDate: task.reservations?.check_out_date || null,
        completionPhotoUrl: null, // TODO: Implement photo storage
        startedAt: task.started_at,
        completedAt: task.completed_at,
        
        // Additional fields for enhanced functionality
        propertyWifiName: task.properties?.wifi_name,
        propertyWifiPassword: task.properties?.wifi_password,
        roomAccessCode: task.room_units?.access_code,
        roomAccessInstructions: task.room_units?.access_instructions,
        roomTypeName: task.room_units?.room_types?.name,
        bedConfiguration: task.room_units?.room_types?.bed_configuration,
        guestCount: task.reservations?.num_guests,
        guestSpecialRequests: task.reservations?.special_requests
      }));

      return transformedTasks;
    } catch (error) {
      console.error('Database error fetching cleaner tasks:', error);
      throw error;
    }
  }

  // Get available cleaners for task assignment
  async getAvailableCleaners() {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, first_name, last_name, phone')
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching available cleaners:', error);
        throw new Error('Failed to fetch available cleaners');
      }

      return data.map(cleaner => ({
        ...cleaner,
        full_name: `${cleaner.first_name} ${cleaner.last_name}`.trim()
      }));
    } catch (error) {
      console.error('Database error fetching available cleaners:', error);
      throw error;
    }
  }

  // Authentication Methods

  // Authenticate user with email and password
  async authenticateUser(email, password) {
    try {
      // For development/demo purposes, we'll use a simplified authentication
      // In production, this should use proper Supabase client-side authentication
      
      // First, get the user by email from auth
      const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error('Error listing users:', listError);
        throw new Error('Authentication failed');
      }

      const authUser = authUsers.users.find(user => user.email === email);
      
      if (!authUser) {
        throw new Error('Invalid email or password');
      }

      // Get user profile
      const profile = await this.getUserProfileByAuthId(authUser.id);
      
      if (!profile) {
        throw new Error('User profile not found');
      }

      if (!profile.is_active) {
        throw new Error('User account is deactivated');
      }

      // For demo purposes, we'll create a simple JWT-like token
      // In production, use proper Supabase authentication
      const mockSession = {
        access_token: `mock_token_${authUser.id}_${Date.now()}`,
        refresh_token: `mock_refresh_${authUser.id}_${Date.now()}`,
        expires_in: 3600,
        token_type: 'bearer',
        user: authUser
      };

      return {
        user: authUser,
        profile: profile,
        session: mockSession
      };
    } catch (error) {
      console.error('Database error authenticating user:', error);
      throw error;
    }
  }

  // Get user profile by auth ID
  async getUserProfileByAuthId(authId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('id', authId)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user profile by auth ID:', error);
        throw new Error('Failed to fetch user profile');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching user profile by auth ID:', error);
      throw error;
    }
  }

  // Get user profile with auth info by email
  async getUserByEmail(email) {
    try {
      // First get the auth user
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error fetching auth users:', authError);
        throw new Error('Failed to fetch user');
      }

      const authUser = authUsers.users.find(user => user.email === email);
      
      if (!authUser) {
        return null;
      }

      // Then get the profile
      const profile = await this.getUserProfileByAuthId(authUser.id);
      
      return {
        auth: authUser,
        profile: profile
      };
    } catch (error) {
      console.error('Database error fetching user by email:', error);
      throw error;
    }
  }

  // Verify JWT token and get user profile
  async verifyTokenAndGetProfile(token) {
    try {
      // Check if this is our mock token format
      if (token.startsWith('mock_token_')) {
        // Extract user ID from mock token
        const parts = token.split('_');
        if (parts.length >= 3) {
          const userId = parts[2];
          
          // Get user from auth users list
          const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (listError) {
            console.error('Error listing users for token verification:', listError);
            throw new Error('Token verification failed');
          }

          const authUser = authUsers.users.find(user => user.id === userId);
          
          if (!authUser) {
            throw new Error('User not found');
          }

          // Get user profile
          const profile = await this.getUserProfileByAuthId(authUser.id);
          
          if (!profile) {
            throw new Error('User profile not found');
          }

          if (!profile.is_active) {
            throw new Error('User account is deactivated');
          }

          return {
            user: authUser,
            profile: profile
          };
        }
      }

      // For real JWT tokens, use Supabase verification
      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error) {
        console.error('Token verification error:', error);
        throw new Error('Invalid token');
      }

      if (!data.user) {
        throw new Error('User not found');
      }

      // Get user profile
      const profile = await this.getUserProfileByAuthId(data.user.id);
      
      if (!profile) {
        throw new Error('User profile not found');
      }

      if (!profile.is_active) {
        throw new Error('User account is deactivated');
      }

      return {
        user: data.user,
        profile: profile
      };
    } catch (error) {
      console.error('Database error verifying token:', error);
      throw error;
    }
  }

  // Create a test admin user (for development)
  async createTestAdminUser() {
    try {
      // Check if admin user already exists
      const existingUser = await this.getUserByEmail('admin@whenstay.com');
      
      if (existingUser && existingUser.profile) {
        console.log('Test admin user already exists');
        return existingUser.profile;
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: 'admin@whenstay.com',
        password: 'admin123',
        email_confirm: true,
        user_metadata: {
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin'
        }
      });

      if (authError) {
        console.error('Error creating test admin auth user:', authError);
        throw new Error(`Failed to create test admin auth user: ${authError.message}`);
      }

      // Create user profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: authUser.user.id,
          role: 'admin',
          first_name: 'Admin',
          last_name: 'User',
          phone: null,
          company_name: 'Whenstay',
          is_active: true
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating test admin profile:', profileError);
        
        // Clean up auth user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        } catch (cleanupError) {
          console.error('Error cleaning up auth user:', cleanupError);
        }
        
        throw new Error(`Failed to create test admin profile: ${profileError.message}`);
      }

      console.log('Test admin user created successfully');
      return profile;
    } catch (error) {
      console.error('Database error creating test admin user:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
