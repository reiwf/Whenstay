const { supabaseAdmin } = require('../config/supabase');

class ReservationsService {
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

  // Get today's dashboard statistics
  async getTodayDashboardStats(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Function to create properly filtered count queries
      const getFilteredCount = async (dateField, dateValue, additionalFilters = {}) => {
        let query = supabaseAdmin.from('reservations');
        
        if (userProfile?.role === 'owner') {
          // For owners, join with properties and filter by owner_id
          query = query.select('id, properties!inner(owner_id)', { count: 'exact', head: true })
                       .eq('properties.owner_id', userProfile.id);
        } else {
          query = query.select('id', { count: 'exact', head: true });
        }
        
        // Apply date filter
        if (dateField === 'check_in_date') {
          query = query.eq('check_in_date', dateValue);
        } else if (dateField === 'check_out_date') {
          query = query.eq('check_out_date', dateValue);
        } else if (dateField === 'in_house') {
          query = query.lte('check_in_date', dateValue).gt('check_out_date', dateValue);
        }
        
        // Apply additional filters
        Object.keys(additionalFilters).forEach(key => {
          const value = additionalFilters[key];
          if (value === null) {
            query = query.is(key, null);
          } else {
            query = query.eq(key, value);
          }
        });
        
        const { count, error } = await query;
        
        if (error) {
          console.error('Error getting filtered count:', error);
          return 0;
        }
        
        return count || 0;
      };

      // Get all counts with proper filtering
      const [todayArrivals, todayDepartures, inHouseGuests, pendingTodayCheckins] = await Promise.all([
        getFilteredCount('check_in_date', today),
        getFilteredCount('check_out_date', today),
        getFilteredCount('in_house', today),
        getFilteredCount('check_in_date', today, { checkin_submitted_at: null })
      ]);

      return {
        todayArrivals,
        todayDepartures,
        inHouseGuests,
        pendingTodayCheckins
      };
    } catch (error) {
      console.error('Database error fetching today dashboard stats:', error);
      return {
        todayArrivals: 0,
        todayDepartures: 0,
        inHouseGuests: 0,
        pendingTodayCheckins: 0
      };
    }
  }

  // Get today's arrivals
  async getTodayArrivals(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Try to use the detailed view first
      let query = supabaseAdmin
        .from('reservations_details')
        .select('*')
        .eq('check_in_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('property_owner_id', userProfile.id);
      }

      query = query.order('estimated_checkin_time', { ascending: true, nullsLast: true })
                   .order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching today arrivals from detailed view:', error);
        // Fallback to basic table
        return this.getTodayArrivalsBasic(userProfile);
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching today arrivals:', error);
      return [];
    }
  }

  // Fallback method for today's arrivals
  async getTodayArrivalsBasic(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabaseAdmin
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            owner_id
          ),
          room_units (
            unit_number,
            room_types (
              name
            )
          )
        `)
        .eq('check_in_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('properties.owner_id', userProfile.id);
      }

      query = query.order('estimated_checkin_time', { ascending: true, nullsLast: true })
                   .order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching today arrivals basic:', error);
        return [];
      }

      // Transform data to match detailed view format
      return (data || []).map(reservation => ({
        ...reservation,
        property_name: reservation.properties?.name || 'Unknown Property',
        unit_number: reservation.room_units?.unit_number || 'TBD',
        room_type_name: reservation.room_units?.room_types?.name || 'Standard Room',
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        room_number: reservation.room_units?.unit_number || 'TBD'
      }));
    } catch (error) {
      console.error('Database error fetching today arrivals basic:', error);
      return [];
    }
  }

  // Get today's departures
  async getTodayDepartures(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Try to use the detailed view first
      let query = supabaseAdmin
        .from('reservations_details')
        .select('*')
        .eq('check_out_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('property_owner_id', userProfile.id);
      }

      query = query.order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching today departures from detailed view:', error);
        // Fallback to basic table
        return this.getTodayDeparturesBasic(userProfile);
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching today departures:', error);
      return [];
    }
  }

  // Fallback method for today's departures
  async getTodayDeparturesBasic(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabaseAdmin
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            owner_id
          ),
          room_units (
            unit_number,
            room_types (
              name
            )
          )
        `)
        .eq('check_out_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('properties.owner_id', userProfile.id);
      }

      query = query.order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching today departures basic:', error);
        return [];
      }

      // Transform data to match detailed view format
      return (data || []).map(reservation => ({
        ...reservation,
        property_name: reservation.properties?.name || 'Unknown Property',
        unit_number: reservation.room_units?.unit_number || 'TBD',
        room_type_name: reservation.room_units?.room_types?.name || 'Standard Room',
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        room_number: reservation.room_units?.unit_number || 'TBD'
      }));
    } catch (error) {
      console.error('Database error fetching today departures basic:', error);
      return [];
    }
  }

  // Get currently in-house guests
  async getInHouseGuests(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Try to use the detailed view first
      let query = supabaseAdmin
        .from('reservations_details')
        .select('*')
        .lte('check_in_date', today)
        .gt('check_out_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('property_owner_id', userProfile.id);
      }

      query = query.order('check_out_date', { ascending: true })
                   .order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching in-house guests from detailed view:', error);
        // Fallback to basic table
        return this.getInHouseGuestsBasic(userProfile);
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching in-house guests:', error);
      return [];
    }
  }

  // Fallback method for in-house guests
  async getInHouseGuestsBasic(userProfile = null) {
    try {
      const today = new Date().toISOString().split('T')[0];

      let query = supabaseAdmin
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            owner_id
          ),
          room_units (
            unit_number,
            room_types (
              name
            )
          )
        `)
        .lte('check_in_date', today)
        .gt('check_out_date', today);

      // Filter by owner if user is an owner
      if (userProfile?.role === 'owner') {
        query = query.eq('properties.owner_id', userProfile.id);
      }

      query = query.order('check_out_date', { ascending: true })
                   .order('booking_name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching in-house guests basic:', error);
        return [];
      }

      // Transform data to match detailed view format
      return (data || []).map(reservation => ({
        ...reservation,
        property_name: reservation.properties?.name || 'Unknown Property',
        unit_number: reservation.room_units?.unit_number || 'TBD',
        room_type_name: reservation.room_units?.room_types?.name || 'Standard Room',
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        room_number: reservation.room_units?.unit_number || 'TBD'
      }));
    } catch (error) {
      console.error('Database error fetching in-house guests basic:', error);
      return [];
    }
  }

}

module.exports = new ReservationsService();
