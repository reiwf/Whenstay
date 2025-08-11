const { supabaseAdmin } = require('../config/supabase');
const { cleanObject } = require('./utils/dbHelpers');
const { getTokyoToday } = require('./utils/dateUtils');

class ReservationService {
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
        currency: reservationData.currency || 'JPY',
        status: reservationData.status || 'confirmed',
        booking_source: reservationData.bookingSource || null,
        special_requests: reservationData.specialRequests || null,
        
        // V5 Room assignment
        property_id: reservationData.propertyId || null,
        room_type_id: reservationData.roomTypeId || null,
        room_unit_id: reservationData.roomUnitId || null,
        
        // Additional Beds24 webhook fields
        lang: reservationData.lang || null,
        apiReference: reservationData.apiReference || null,
        commission: reservationData.commission || null,
        rateDescription: reservationData.rateDescription || null,
        booking_lastname: reservationData.bookingLastname || null,
        bookingTime: reservationData.bookingTime || null,
        timeStamp: reservationData.timeStamp || null,
        comments: reservationData.comments || null
      };

      cleanObject(insertData);
      
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
      if (reservationData.bookingLastname !== undefined) updateData.booking_lastname = reservationData.bookingLastname;
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
      if (reservationData.lang !== undefined) updateData.lang = reservationData.lang;
      if (reservationData.apiReference !== undefined) updateData.apiReference = reservationData.apiReference;
      if (reservationData.commission !== undefined) updateData.commission = reservationData.commission;
      if (reservationData.rateDescription !== undefined) updateData.rateDescription = reservationData.rateDescription;
      if (reservationData.bookingTime !== undefined) updateData.bookingTime = reservationData.bookingTime;
      if (reservationData.timeStamp !== undefined) updateData.timeStamp = reservationData.timeStamp;
      if (reservationData.comments !== undefined) updateData.comments = reservationData.comments;
      if (reservationData.apiMessage !== undefined) updateData.apiMessage = reservationData.apiMessage;
      if (reservationData.price !== undefined) updateData.price = reservationData.price;

      cleanObject(updateData);
     

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

  // NEW: Get reservations with full details using the reservations_details view
  async getReservationsWithFullDetails(filters = {}) {
    try {
      const {
        status,
        propertyId,
        roomTypeId,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        includeCancelled = false,
        limit = 50,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      // Use the comprehensive reservations_details view for full data
      let query = supabaseAdmin
        .from('reservations_details')
        .select('*');

      // Apply filters in optimal order (most selective first)
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId);
      }

      if (status) {
        query = query.eq('status', status);
      } else if (!includeCancelled) {
        query = query.neq('status', 'cancelled');
      }

      // Date filtering with proper indexing
      if (checkInDate) {
        query = query.eq('check_in_date', checkInDate);
      } else {
        // Handle single date range (same start and end date) as exact match
        if (checkInDateFrom && checkInDateTo && checkInDateFrom === checkInDateTo) {
          query = query.eq('check_in_date', checkInDateFrom);
        } else {
          // Handle different start/end dates as range
          if (checkInDateFrom) {
            query = query.gte('check_in_date', checkInDateFrom);
          }
          if (checkInDateTo) {
            query = query.lte('check_in_date', checkInDateTo);
          }
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
        console.error('Error fetching reservations with full details:', error);
        console.log('Falling back to basic reservations query due to view error');
        // Fallback to existing method if view fails
        return this.getReservationsWithFiltersBasic(filters);
      }

      // Transform data for consistency with frontend expectations
      const transformedData = data.map(reservation => ({
        ...reservation,
        // Add backward compatibility mappings
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        guest_phone: reservation.booking_phone,
        guest_personal_email: reservation.guest_mail,
        bookingLastname: reservation.booking_lastname,
        room_number: reservation.unit_number || 'TBD',
        room_name: reservation.room_type_name || 'Standard Room'
      }));

      return transformedData;
    } catch (error) {
      console.error('Database error fetching reservations with full details:', error);
      // Fallback to existing method
      return this.getReservationsWithFilters(filters);
    }
  }

  // NEW: Get single reservation with full details
  async getReservationFullDetails(reservationId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations_details')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error) {
        console.error('Error fetching reservation full details:', error);
        
        // Fallback to basic reservation table with joins
        const { data: basicData, error: basicError } = await supabaseAdmin
          .from('reservations')
          .select(`
            *,
            properties (
              id,
              name,
              address,
              wifi_name,
              wifi_password,
              house_rules,
              check_in_instructions,
              emergency_contact,
              property_amenities,
              location_info,
              access_time
            ),
            room_types (
              id,
              name,
              description,
              max_guests,
              base_price,
              room_amenities,
              bed_configuration,
              room_size_sqm,
              has_balcony,
              has_kitchen,
              is_accessible
            ),
            room_units (
              id,
              unit_number,
              floor_number,
              access_code,
              access_instructions,
              wifi_name,
              wifi_password,
              unit_amenities,
              maintenance_notes
            ),
            user_profiles!reservations_verified_by_fkey (
              first_name,
              last_name
            )
          `)
          .eq('id', reservationId)
          .single();

        if (basicError) {
          throw new Error('Failed to fetch reservation details');
        }

        // Transform basic data to match view structure
        return {
          ...basicData,
          property_name: basicData.properties?.name,
          property_address: basicData.properties?.address,
          property_wifi_name: basicData.properties?.wifi_name,
          property_wifi_password: basicData.properties?.wifi_password,
          house_rules: basicData.properties?.house_rules,
          check_in_instructions: basicData.properties?.check_in_instructions,
          property_emergency_contact: basicData.properties?.emergency_contact,
          property_amenities: basicData.properties?.property_amenities,
          location_info: basicData.properties?.location_info,
          access_time: basicData.properties?.access_time,
          
          room_type_name: basicData.room_types?.name,
          room_type_description: basicData.room_types?.description,
          room_type_max_guests: basicData.room_types?.max_guests,
          base_price: basicData.room_types?.base_price,
          room_type_amenities: basicData.room_types?.room_amenities,
          bed_configuration: basicData.room_types?.bed_configuration,
          room_size_sqm: basicData.room_types?.room_size_sqm,
          room_type_has_balcony: basicData.room_types?.has_balcony,
          room_type_has_kitchen: basicData.room_types?.has_kitchen,
          room_type_is_accessible: basicData.room_types?.is_accessible,
          
          unit_number: basicData.room_units?.unit_number,
          floor_number: basicData.room_units?.floor_number,
          access_code: basicData.room_units?.access_code,
          access_instructions: basicData.room_units?.access_instructions,
          unit_wifi_name: basicData.room_units?.wifi_name,
          unit_wifi_password: basicData.room_units?.wifi_password,
          unit_amenities: basicData.room_units?.unit_amenities,
          maintenance_notes: basicData.room_units?.maintenance_notes,
          
          verified_by_name: basicData.user_profiles?.first_name,
          verified_by_lastname: basicData.user_profiles?.last_name,
          
          // Backward compatibility
          guest_name: basicData.booking_name,
          guest_email: basicData.booking_email,
          guest_phone: basicData.booking_phone,
          guest_personal_email: basicData.guest_mail,
          room_number: basicData.room_units?.unit_number || 'TBD',
          room_name: basicData.room_types?.name || 'Standard Room'
        };
      }

      // Add backward compatibility mappings
      return {
        ...data,
        guest_name: data.booking_name,
        guest_email: data.booking_email,
        guest_phone: data.booking_phone,
        guest_personal_email: data.guest_mail,
        bookingLastname: data.booking_lastname,
        room_number: data.unit_number || 'TBD',
        room_name: data.room_type_name || 'Standard Room'
      };
    } catch (error) {
      console.error('Database error fetching reservation full details:', error);
      throw error;
    }
  }

  // Optimized reservation filtering with selective field loading and efficient queries
  async getReservationsWithFilters(filters = {}) {
    try {
      const {
        status,
        propertyId,
        roomTypeId,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        includeCancelled = false,
        limit: requestedLimit,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      // Increase limit significantly when date range is specified
      const hasDateRange = checkInDateFrom && checkInDateTo;
      const limit = requestedLimit || (hasDateRange ? 1000 : 100);

      // Optimized field selection - only load what's needed for the UI
      const selectFields = [
        'id', 'beds24_booking_id', 'property_id', 'room_type_id', 'room_unit_id',
        'booking_name', 'booking_email', 'booking_phone', 
        'check_in_date', 'check_out_date', 'num_guests', 'status',
        'admin_verified', 'checkin_submitted_at',
        'property_name', 'room_type_name', 'unit_number',
        'guest_firstname', 'guest_lastname', 'guest_contact', 'guest_mail',
        'total_amount', 'currency', 'special_requests',
        'estimated_checkin_time', 'travel_purpose'
      ].join(', ');

      // Use optimized query with indexes
      let query = supabaseAdmin
        .from('reservations_details')
        .select(selectFields);

      // Apply filters in optimal order (most selective first)
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (roomTypeId) {
        query = query.eq('room_type_id', roomTypeId);
      }

      if (status) {
        query = query.eq('status', status);
        } else if (!includeCancelled) {
        query = query.neq('status', 'cancelled');
      }

      // Date filtering with proper indexing
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
        // Fallback to basic method if view fails
        return this.getReservationsWithFiltersBasic(filters);
      }

      // Minimal data transformation - only essential mapping
      const transformedData = data.map(reservation => ({
        ...reservation,
        // Essential backward compatibility mappings
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        guest_phone: reservation.booking_phone,
        room_number: reservation.unit_number || 'TBD',
        room_name: reservation.room_type_name || 'Standard Room',
        guest_personal_email: reservation.guest_mail,
        property_name: reservation.property_name || 'Unknown Property',
        room_type_name: reservation.room_type_name || 'Standard'
      }));

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
        includeCancelled = false,
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
        } else if (!includeCancelled) {
        query = query.neq('status', 'cancelled');
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
        includeCancelled = false,
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
        } else if (!includeCancelled) {
        query = query.neq('status', 'cancelled');
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
        return []; // Return empty array instead of throwing error
      }

      // If no data, return empty array
      if (!data || data.length === 0) {
        return [];
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

  // Update access_read status to true when guest views access code
  async updateAccessRead(checkinToken) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({ access_read: true })
        .eq('check_in_token', checkinToken)
        .select()
        .single();

      if (error) {
        console.error('Error updating access read status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Database error updating access read status:', error);
      return null;
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
      const today = getTokyoToday();
      console.log('Today:', getTokyoToday);

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
      const today = getTokyoToday();

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
      const today = getTokyoToday();

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
      const today = getTokyoToday();

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
      const today = getTokyoToday();

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
      const today = getTokyoToday();

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
      const today = getTokyoToday();

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


  async getGuestAppData(checkinToken) {
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
          access_read: data.access_read || false,
          
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

  // Get cleaning tasks with full details including property and room information
  async getCleaningTasks(filters = {}) {
    try {
      const {
        propertyId,
        cleanerId,
        taskDate,
        status,
        taskDateFrom,
        taskDateTo,
        includeCancelled = false,
        limit = 50,
        offset = 0,
        sortBy = 'priority',
        sortOrder = 'desc'
      } = filters;

      // Build the query to get cleaning tasks with full property/room details
      let query = supabaseAdmin
        .from('cleaning_tasks')
        .select(`
          *,
          properties (
            id,
            name,
            address,
            owner_id
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
              max_guests
            )
          ),
          reservations (
            id,
            beds24_booking_id,
            booking_name,
            booking_lastname,
            check_in_date,
            check_out_date,
            status
          ),
          user_profiles!cleaning_tasks_cleaner_id_fkey (
            id,
            first_name,
            last_name,
            role
          )
        `);

      // Apply filters
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (cleanerId) {
        query = query.eq('cleaner_id', cleanerId);
      }

      if (status && !includeCancelled) {
        query = query.eq('status', status).neq('status', 'cancelled');
      } else if (!includeCancelled) {
        query = query.neq('status', 'cancelled');
      }

      // Date filtering - default to today if no date specified
      if (taskDate) {
        query = query.eq('task_date', taskDate);
      } else {
        const today = getTokyoToday();
        if (taskDateFrom && taskDateTo) {
          query = query.gte('task_date', taskDateFrom).lte('task_date', taskDateTo);
        } else if (taskDateFrom) {
          query = query.gte('task_date', taskDateFrom);
        } else if (taskDateTo) {
          query = query.lte('task_date', taskDateTo);
        } else {
          // Default to today's tasks only
          query = query.eq('task_date', today);
        }
      }

      // Apply sorting - priority first (high priority tasks first), then by task_date
      if (sortBy === 'priority') {
        query = query.order('priority', { ascending: false })
                     .order('task_date', { ascending: true })
                     .order('created_at', { ascending: true });
      } else {
        const ascending = sortOrder === 'asc';
        query = query.order(sortBy, { ascending });
      }

      // Apply pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cleaning tasks:', error);
        throw new Error('Failed to fetch cleaning tasks');
      }

      console.log('Cleaning tasks query successful, found', data?.length || 0, 'tasks');

      // Transform the data to include calculated fields
      const transformedTasks = (data || []).map(task => {
        const property = task.properties;
        const roomUnit = task.room_units;
        const roomType = roomUnit?.room_types;
        const reservation = task.reservations;
        const cleaner = task.user_profiles;

        return {
          ...task,
          // Property information
          property_name: property?.name || 'Unknown Property',
          property_address: property?.address,
          
          // Room information
          room_type_name: roomType?.name || 'Standard Room',
          room_type_description: roomType?.description,
          room_unit_number: roomUnit?.unit_number,
          room_unit_id: roomUnit?.id,
          floor_number: roomUnit?.floor_number,
          access_code: roomUnit?.access_code,
          access_instructions: roomUnit?.access_instructions,
          max_guests: roomType?.max_guests,
          
          // Reservation information
          reservation_id: reservation?.id,
          beds24_booking_id: reservation?.beds24_booking_id,
          booking_name: reservation?.booking_name || task.booking_name,
          booking_lastname: reservation?.booking_lastname,
          check_in_date: reservation?.check_in_date,
          check_out_date: reservation?.check_out_date,
          reservation_status: reservation?.status,
          
          // Cleaner information
          cleaner_name: cleaner ? `${cleaner.first_name} ${cleaner.last_name}`.trim() : null,
          cleaner_first_name: cleaner?.first_name,
          cleaner_last_name: cleaner?.last_name,
          
          // Calculated fields
          is_high_priority: task.priority === 'high',
          task_display_name: this.getTaskTypeDisplay(task.task_type),
          
          // Display booking name (use reservation booking_name if available, otherwise task booking_name)
          display_booking_name: reservation?.booking_name || task.booking_name || 'Unknown Guest'
        };
      });

      return transformedTasks;
    } catch (error) {
      console.error('Database error fetching cleaning tasks:', error);
      throw error;
    }
  }

  // Helper method to format task type for display
  getTaskTypeDisplay(taskType) {
    if (!taskType) return 'Standard Clean';
    
    return taskType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Create a new cleaning task
  async createCleaningTask(taskData) {
    try {
      const insertData = {
        property_id: taskData.propertyId,
        room_unit_id: taskData.roomUnitId,
        reservation_id: taskData.reservationId || null,
        cleaner_id: taskData.cleanerId || null,
        task_date: taskData.taskDate,
        task_type: taskData.taskType || 'checkout',
        status: taskData.status || 'pending',
        priority: taskData.priority || 'normal',
        estimated_duration: taskData.estimatedDuration || null,
        special_notes: taskData.specialNotes || null,
        booking_name: taskData.bookingName || null
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

  // Update cleaning task
  async updateCleaningTask(taskId, updateData) {
    try {
      const updateFields = {};
      
      if (updateData.cleanerId !== undefined) updateFields.cleaner_id = updateData.cleanerId;
      if (updateData.status !== undefined) updateFields.status = updateData.status;
      if (updateData.priority !== undefined) updateFields.priority = updateData.priority;
      if (updateData.taskType !== undefined) updateFields.task_type = updateData.taskType;
      if (updateData.taskDate !== undefined) updateFields.task_date = updateData.taskDate;
      if (updateData.estimatedDuration !== undefined) updateFields.estimated_duration = updateData.estimatedDuration;
      if (updateData.specialNotes !== undefined) updateFields.special_notes = updateData.specialNotes;
      if (updateData.bookingName !== undefined) updateFields.booking_name = updateData.bookingName;
      
      // Set timestamps based on status changes
      if (updateData.status === 'in_progress' && !updateData.started_at) {
        updateFields.started_at = new Date().toISOString();
      }
      if (updateData.status === 'completed' && !updateData.completed_at) {
        updateFields.completed_at = new Date().toISOString();
      }

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

  // Delete cleaning task
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
      const updateData = {
        cleaner_id: cleanerId,
        assigned_at: new Date().toISOString()
      };

      const { data, error } = await supabaseAdmin
        .from('cleaning_tasks')
        .update(updateData)
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

  // Get available cleaners
  async getAvailableCleaners() {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id, first_name, last_name, phone, is_active')
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .order('first_name', { ascending: true });

      if (error) {
        console.error('Error fetching available cleaners:', error);
        throw new Error('Failed to fetch available cleaners');
      }

      // Transform data to include full name
      const cleaners = (data || []).map(cleaner => ({
        ...cleaner,
        full_name: `${cleaner.first_name} ${cleaner.last_name}`.trim()
      }));

      return cleaners;
    } catch (error) {
      console.error('Database error fetching available cleaners:', error);
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

      let query = supabaseAdmin
        .from('cleaning_tasks')
        .select('status, priority, task_type');

      // Apply same filters as getCleaningTasks
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }
      if (cleanerId) {
        query = query.eq('cleaner_id', cleanerId);
      }

      // Date filtering
      if (taskDate) {
        query = query.eq('task_date', taskDate);
      } else if (taskDateFrom && taskDateTo) {
        query = query.gte('task_date', taskDateFrom).lte('task_date', taskDateTo);
      } else if (taskDateFrom) {
        query = query.gte('task_date', taskDateFrom);
      } else if (taskDateTo) {
        query = query.lte('task_date', taskDateTo);
      } else {
        // Default to today
        const today = getTokyoToday();
        query = query.eq('task_date', today);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching cleaning task stats:', error);
        throw new Error('Failed to fetch cleaning task statistics');
      }

      // Calculate statistics
      const stats = {
        total: data.length,
        by_status: {
          pending: 0,
          in_progress: 0,
          completed: 0,
          cancelled: 0
        },
        by_priority: {
          normal: 0,
          high: 0
        },
        by_type: {
          checkout: 0,
          eco: 0,
          deep_clean: 0
        }
      };

      data.forEach(task => {
        if (stats.by_status[task.status] !== undefined) {
          stats.by_status[task.status]++;
        }
        if (stats.by_priority[task.priority] !== undefined) {
          stats.by_priority[task.priority]++;
        }
        if (stats.by_type[task.task_type] !== undefined) {
          stats.by_type[task.task_type]++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Database error fetching cleaning task stats:', error);
      throw error;
    }
  }

}

module.exports = new ReservationService();
