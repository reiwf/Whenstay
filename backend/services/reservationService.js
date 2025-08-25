const { supabaseAdmin } = require('../config/supabase');
const { cleanObject } = require('./utils/dbHelpers');
const { getTokyoToday } = require('./utils/dateUtils');

class ReservationService {
  // Create a new reservation record
  async createReservation(reservationData) {
    try {
            
      const insertData = {
        beds24_booking_id: reservationData.beds24BookingId || `MANUAL-${Date.now()}`,
        booking_firstname: reservationData.bookingFirstname || null,
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
        
        // Group booking fields (NEW)
        booking_group_master_id: reservationData.bookingGroupMasterId || null,
        is_group_master: reservationData.isGroupMaster || false,
        group_room_count: reservationData.groupRoomCount || 1,
        booking_group_ids: reservationData.bookingGroupIds ? JSON.stringify(reservationData.bookingGroupIds) : null,
        
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

      // Auto-attach accommodation tax for new reservations
      try {
        const guestServicesService = require('./guestServicesService');
        await guestServicesService.attachAccommodationTax(data.id);
        console.log(`Accommodation tax auto-attached to reservation ${data.id}`);
      } catch (taxError) {
        console.error('Error auto-attaching accommodation tax:', taxError);
        // Don't fail reservation creation if tax attachment fails
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
      
      // Try exact string match first
      let { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('check_in_token', String(checkinToken))
        .single();

      if (error && error.code === 'PGRST116') {
        // No rows found with string match, try as integer if the token is numeric
        if (/^\d+$/.test(checkinToken)) {
          console.log('Token is numeric, trying integer match...');
          const result = await supabaseAdmin
            .from('reservations')
            .select('*')
            .eq('check_in_token', parseInt(checkinToken))
            .single();
          
          data = result.data;
          error = result.error;
        }
      }

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('No reservation found with token:', checkinToken);
          return null;
        } else {
          console.error('Database error fetching reservation by token:', error);
          throw new Error(`Database error: ${error.message}`);
        }
      }

      return data;
    } catch (error) {
      console.error('Database error fetching reservation by token:', error);
      throw error;
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
      
      // Core booking information - booking_name is now auto-generated by trigger
      if (reservationData.bookingFirstname !== undefined) updateData.booking_firstname = reservationData.bookingFirstname;
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
      
      // Group booking fields (NEW)
      if (reservationData.bookingGroupMasterId !== undefined) updateData.booking_group_master_id = reservationData.bookingGroupMasterId;
      if (reservationData.isGroupMaster !== undefined) updateData.is_group_master = reservationData.isGroupMaster;
      if (reservationData.groupRoomCount !== undefined) updateData.group_room_count = reservationData.groupRoomCount;
      if (reservationData.bookingGroupIds !== undefined) updateData.booking_group_ids = reservationData.bookingGroupIds ? JSON.stringify(reservationData.bookingGroupIds) : null;
      
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

      // Update primary guest record if guest information is provided
      if (this.hasGuestInformation(reservationData)) {
        try {
          await this.createOrUpdateGuest(reservationId, 1, {
            firstName: reservationData.guestFirstname,
            lastName: reservationData.guestLastname,
            personalEmail: reservationData.guestMail,
            contactNumber: reservationData.guestContact,
            address: reservationData.guestAddress,
            estimatedCheckinTime: reservationData.estimatedCheckinTime,
            travelPurpose: reservationData.travelPurpose,
            passportUrl: reservationData.passportUrl,
            emergencyContactName: reservationData.emergencyContactName,
            emergencyContactPhone: reservationData.emergencyContactPhone,
            agreementAccepted: reservationData.agreementAccepted || false
          });
          console.log(`Primary guest updated for reservation ${reservationId}`);
        } catch (guestError) {
          console.error('Error updating primary guest:', guestError);
          // Don't fail reservation update if guest update fails
        }
      }

      return data;
    } catch (error) {
      console.error('Database error updating reservation:', error);
      throw error;
    }
  }

  // Create or update guest information (replaces updateReservationGuestInfo)
  async createOrUpdateGuest(reservationId, guestNumber, guestInfo) {
    try {
      const guestData = {
        reservation_id: reservationId,
        guest_number: guestNumber,
        is_primary_guest: guestNumber === 1,
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
      Object.keys(guestData).forEach(key => {
        if (guestData[key] === '' || guestData[key] === undefined) {
          guestData[key] = null;
        }
      });

      // Ensure boolean fields are properly handled
      if (typeof guestData.agreement_accepted === 'string') {
        guestData.agreement_accepted = guestData.agreement_accepted === 'true';
      }

      console.log('Creating/updating guest data:', guestData);

      // Use upsert to create or update guest record
      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .upsert(guestData, {
          onConflict: 'reservation_id,guest_number',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase upsert error:', error);
        throw new Error(`Failed to create/update guest information: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Database error creating/updating guest info:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async updateReservationGuestInfo(reservationId, guestInfo) {
    console.warn('updateReservationGuestInfo is deprecated. Use createOrUpdateGuest instead.');
    return this.createOrUpdateGuest(reservationId, 1, guestInfo);
  }

  // Helper method to check if guest information is provided in reservation data
  hasGuestInformation(reservationData) {
    return !!(
      reservationData.guestFirstname ||
      reservationData.guestLastname ||
      reservationData.guestMail ||
      reservationData.guestContact ||
      reservationData.guestAddress ||
      reservationData.estimatedCheckinTime ||
      reservationData.travelPurpose ||
      reservationData.passportUrl ||
      reservationData.emergencyContactName ||
      reservationData.emergencyContactPhone
    );
  }

  // Get all guests for a reservation
  async getReservationGuests(reservationId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .select('*')
        .eq('reservation_id', reservationId)
        .order('guest_number', { ascending: true });

      if (error) {
        console.error('Error fetching reservation guests:', error);
        throw new Error('Failed to fetch reservation guests');
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching reservation guests:', error);
      throw error;
    }
  }

  // Get specific guest by number
  async getGuestByNumber(reservationId, guestNumber) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('guest_number', guestNumber)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching guest by number:', error);
        throw new Error('Failed to fetch guest information');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching guest by number:', error);
      throw error;
    }
  }

  // Create placeholder guests for multi-guest reservations
  async createPlaceholderGuests(reservationId, numGuests) {
    try {
      const placeholders = [];
      
      for (let i = 1; i <= numGuests; i++) {
        const placeholderData = {
          reservation_id: reservationId,
          guest_number: i,
          is_primary_guest: i === 1,
          agreement_accepted: false,
          admin_verified: false
        };
        placeholders.push(placeholderData);
      }

      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .insert(placeholders)
        .select();

      if (error) {
        console.error('Error creating placeholder guests:', error);
        throw new Error('Failed to create placeholder guests');
      }

      return data;
    } catch (error) {
      console.error('Database error creating placeholder guests:', error);
      throw error;
    }
  }

  // Validate that all guests have completed check-in
  async validateAllGuestsComplete(reservationId) {
    try {
      // Get reservation to check num_guests
      const { data: reservation, error: resError } = await supabaseAdmin
        .from('reservations')
        .select('num_guests')
        .eq('id', reservationId)
        .single();

      if (resError) {
        throw new Error('Failed to fetch reservation');
      }

      const requiredGuests = reservation.num_guests || 1;

      // Count completed guest check-ins
      const { data: completedGuests, error: guestError } = await supabaseAdmin
        .from('reservation_guests')
        .select('id')
        .eq('reservation_id', reservationId)
        .not('checkin_submitted_at', 'is', null);

      if (guestError) {
        throw new Error('Failed to fetch guest check-ins');
      }

      const completedCount = completedGuests?.length || 0;
      
      return {
        isComplete: completedCount >= requiredGuests,
        requiredGuests,
        completedGuests: completedCount,
        remainingGuests: Math.max(0, requiredGuests - completedCount)
      };
    } catch (error) {
      console.error('Database error validating guest completion:', error);
      throw error;
    }
  }


  // Check if guest check-in is completed by checking checkin_submitted_at field in reservation_guests
  async getGuestCheckinByReservationId(reservationId) {
    try {
      // Get primary guest from reservation_guests table
      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .select('checkin_submitted_at, admin_verified, guest_firstname, guest_lastname, passport_url')
        .eq('reservation_id', reservationId)
        .eq('is_primary_guest', true)
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
      // Query reservation_guests table for completed check-ins, then join with reservations
      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .select(`
          *,
          reservations (
            id,
            beds24_booking_id,
            booking_name,
            booking_lastname,
            booking_email,
            booking_phone,
            check_in_date,
            check_out_date,
            num_guests,
            status,
            property_id,
            room_unit_id,
            total_amount,
            currency,
            special_requests
          )
        `)
        .not('checkin_submitted_at', 'is', null)
        .order('checkin_submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching completed check-ins:', error);
        throw new Error('Failed to fetch completed check-ins');
      }

      // Transform data to maintain backward compatibility
      const transformedData = (data || []).map(guest => ({
        ...guest.reservations,
        // Guest information from reservation_guests table
        guest_firstname: guest.guest_firstname,
        guest_lastname: guest.guest_lastname,
        guest_contact: guest.guest_contact,
        guest_mail: guest.guest_mail,
        guest_address: guest.guest_address,
        estimated_checkin_time: guest.estimated_checkin_time,
        travel_purpose: guest.travel_purpose,
        emergency_contact_name: guest.emergency_contact_name,
        emergency_contact_phone: guest.emergency_contact_phone,
        passport_url: guest.passport_url,
        agreement_accepted: guest.agreement_accepted,
        checkin_submitted_at: guest.checkin_submitted_at,
        admin_verified: guest.admin_verified,
        verified_at: guest.verified_at,
        verified_by: guest.verified_by,
        guest_number: guest.guest_number,
        is_primary_guest: guest.is_primary_guest
      }));

      return transformedData;
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

  // NEW: Get single reservation with full details including guest information
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

        // Get primary guest information
        const primaryGuest = await this.getGuestByNumber(reservationId, 1);

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
          
          // Guest information from reservation_guests table
          guest_firstname: primaryGuest?.guest_firstname,
          guest_lastname: primaryGuest?.guest_lastname,
          guest_mail: primaryGuest?.guest_mail,
          guest_contact: primaryGuest?.guest_contact,
          guest_address: primaryGuest?.guest_address,
          estimated_checkin_time: primaryGuest?.estimated_checkin_time,
          travel_purpose: primaryGuest?.travel_purpose,
          passport_url: primaryGuest?.passport_url,
          emergency_contact_name: primaryGuest?.emergency_contact_name,
          emergency_contact_phone: primaryGuest?.emergency_contact_phone,
          agreement_accepted: primaryGuest?.agreement_accepted || false,
          checkin_submitted_at: primaryGuest?.checkin_submitted_at,
          admin_verified: primaryGuest?.admin_verified || false,
          verified_at: primaryGuest?.verified_at,
          
          // Backward compatibility
          guest_name: basicData.booking_name,
          guest_email: basicData.booking_email,
          guest_phone: basicData.booking_phone,
          guest_personal_email: primaryGuest?.guest_mail,
          room_number: basicData.room_units?.unit_number || 'TBD',
          room_name: basicData.room_types?.name || 'Standard Room'
        };
      }

      // Get primary guest information for the detailed view
      const primaryGuest = await this.getGuestByNumber(reservationId, 1);

      // Add backward compatibility mappings and guest information
      return {
        ...data,
        // Guest information from reservation_guests table
        guest_firstname: primaryGuest?.guest_firstname,
        guest_lastname: primaryGuest?.guest_lastname,
        guest_mail: primaryGuest?.guest_mail,
        guest_contact: primaryGuest?.guest_contact,
        guest_address: primaryGuest?.guest_address,
        estimated_checkin_time: primaryGuest?.estimated_checkin_time,
        travel_purpose: primaryGuest?.travel_purpose,
        passport_url: primaryGuest?.passport_url,
        emergency_contact_name: primaryGuest?.emergency_contact_name,
        emergency_contact_phone: primaryGuest?.emergency_contact_phone,
        agreement_accepted: primaryGuest?.agreement_accepted || false,
        checkin_submitted_at: primaryGuest?.checkin_submitted_at,
        admin_verified: primaryGuest?.admin_verified || false,
        verified_at: primaryGuest?.verified_at,
        
        // Backward compatibility mappings
        guest_name: data.booking_name,
        guest_email: data.booking_email,
        guest_phone: data.booking_phone,
        guest_personal_email: primaryGuest?.guest_mail || data.guest_mail,
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


  // Update admin verification status for primary guest
  async updateAdminVerification(reservationId, verified) {
    try {
      // Update admin_verified for the primary guest in reservation_guests table
      const updateData = {
        admin_verified: verified,
        verified_at: verified ? new Date().toISOString() : null
      };

      const { data, error } = await supabaseAdmin
        .from('reservation_guests')
        .update(updateData)
        .eq('reservation_id', reservationId)
        .eq('is_primary_guest', true)
        .select()
        .single();

      if (error) {
        console.error('Error updating admin verification:', error);
        throw new Error('Failed to update admin verification');
      }

      // If verification successful, also return the reservation data for backward compatibility
      if (data) {
        const { data: reservationData, error: resError } = await supabaseAdmin
          .from('reservations')
          .select('*')
          .eq('id', reservationId)
          .single();

        if (resError) {
          console.error('Error fetching reservation after verification update:', resError);
          // Return guest data if reservation fetch fails
          return {
            ...data,
            reservation_id: reservationId,
            admin_verified: verified
          };
        }

        // Return reservation data with guest verification info for backward compatibility
        return {
          ...reservationData,
          admin_verified: verified,
          verified_at: data.verified_at,
          guest_verification_updated: true
        };
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
      const { data: reservationData, error: reservationError } = await supabaseAdmin
        .from('reservations_details')
        .select('*')
        .eq('check_in_token', checkinToken)
        .single();

      if (reservationError) {
        console.error('Error fetching guest dashboard data:', reservationError);
        return null;
      }

      if (!reservationData) {
        return null;
      }

      // Get all guests for this reservation
      const { data: guestsData, error: guestsError } = await supabaseAdmin
        .from('reservation_guests')
        .select('*')
        .eq('reservation_id', reservationData.id)
        .order('guest_number', { ascending: true });

      if (guestsError) {
        console.error('Error fetching guests data:', guestsError);
        // Continue with reservation data only if guests can't be fetched
      }

      // Get available and purchased services for this reservation using the new service system
      const guestServicesService = require('./guestServicesService');
      const availableServices = await guestServicesService.getAvailableServicesForGuest(checkinToken);

      // Calculate effective access and departure times with service overrides
      const effectiveTimes = await guestServicesService.calculateEffectiveTimes(reservationData.id);

      // Auto-attach accommodation tax for active reservations
      if (reservationData.status === 'confirmed' || reservationData.status === 'checked_in') {
        try {
          await guestServicesService.attachAccommodationTax(reservationData.id);
          console.log(`Accommodation tax auto-attached for guest app access: ${reservationData.id}`);
        } catch (taxError) {
          console.error('Error auto-attaching accommodation tax:', taxError);
          // Continue without error - will be handled in frontend
        }
      }

      // Get accommodation tax details from services
      const accommodationTaxService = availableServices.find(service => service.service_type === 'accommodation_tax');

      // Get primary guest (guest #1) for backward compatibility
      const primaryGuest = guestsData?.find(g => g.guest_number === 1) || null;
      
      // Check completion status
      const completionStatus = await this.validateAllGuestsComplete(reservationData.id);

      // Check if all mandatory services are paid
      const mandatoryServices = availableServices.filter(s => s.is_mandatory);
      const allMandatoryServicesPaid = mandatoryServices.length === 0 || 
        mandatoryServices.every(s => s.payment_status === 'paid' || s.payment_status === 'exempted');

      // Determine if guest can access stay info (service-based tax gating logic)
      const canAccessStayInfo = this.canAccessStayInfoWithServices(
        completionStatus.isComplete,
        mandatoryServices,
        effectiveTimes
      );
      
      // Structure the data for the frontend
      const dashboardData = {
        reservation: {
          id: reservationData.id,
          beds24_booking_id: reservationData.beds24_booking_id,
          booking_name: reservationData.booking_name,
          booking_lastname: reservationData.booking_lastname,
          booking_email: reservationData.booking_email,
          booking_phone: reservationData.booking_phone,
          check_in_date: reservationData.check_in_date,
          check_out_date: reservationData.check_out_date,
          num_guests: reservationData.num_guests,
          num_adults: reservationData.num_adults,
          num_children: reservationData.num_children,
          total_amount: reservationData.total_amount,
          currency: reservationData.currency,
          status: reservationData.status,
          special_requests: reservationData.special_requests,
          
          // Primary guest information (for backward compatibility)
          guest_firstname: primaryGuest?.guest_firstname,
          guest_lastname: primaryGuest?.guest_lastname,
          guest_contact: primaryGuest?.guest_contact,
          guest_mail: primaryGuest?.guest_mail,
          guest_address: primaryGuest?.guest_address,
          estimated_checkin_time: primaryGuest?.estimated_checkin_time,
          travel_purpose: primaryGuest?.travel_purpose,
          emergency_contact_name: primaryGuest?.emergency_contact_name,
          emergency_contact_phone: primaryGuest?.emergency_contact_phone,
          passport_url: primaryGuest?.passport_url,
          agreement_accepted: primaryGuest?.agreement_accepted || false,
          checkin_submitted_at: primaryGuest?.checkin_submitted_at,
          admin_verified: primaryGuest?.admin_verified || false,
          verified_at: primaryGuest?.verified_at,
          access_read: reservationData.access_read || false,
          
          // Multi-guest completion status
          all_guests_completed: completionStatus.isComplete,
          completed_guests_count: completionStatus.completedGuests,
          total_guests_required: completionStatus.requiredGuests,
          remaining_guests: completionStatus.remainingGuests,
          
          // Computed fields for backward compatibility
          guest_name: reservationData.booking_name,
          guest_email: reservationData.booking_email,
          guest_phone: reservationData.booking_phone,

          // Journey roadmap and access control (using new service system)
          can_access_stay_info: canAccessStayInfo,
          effective_access_time: effectiveTimes?.accessTime,
          effective_departure_time: effectiveTimes?.departureTime,
          original_access_time: reservationData.access_time,
          original_departure_time: reservationData.departure_time
        },
        
        // All guests information (for multi-guest check-in process)
        guests: (guestsData || []).map((guest, index) => ({
          id: guest.id,
          guest_number: guest.guest_number,
          is_primary_guest: guest.is_primary_guest,
          guest_firstname: guest.guest_firstname,
          guest_lastname: guest.guest_lastname,
          guest_contact: guest.guest_contact,
          guest_mail: guest.guest_mail,
          guest_address: guest.guest_address,
          estimated_checkin_time: guest.estimated_checkin_time,
          travel_purpose: guest.travel_purpose,
          emergency_contact_name: guest.emergency_contact_name,
          emergency_contact_phone: guest.emergency_contact_phone,
          passport_url: guest.passport_url,
          agreement_accepted: guest.agreement_accepted || false,
          checkin_submitted_at: guest.checkin_submitted_at,
          admin_verified: guest.admin_verified || false,
          verified_at: guest.verified_at,
          // Completion status for this guest
          is_completed: !!guest.checkin_submitted_at,
          // Display name for UI
          display_name: guest.guest_firstname && guest.guest_lastname 
            ? `${guest.guest_firstname} ${guest.guest_lastname}`.trim()
            : `Guest #${guest.guest_number}`,
          created_at: guest.created_at,
          updated_at: guest.updated_at
        })),
        
        property: {
          id: reservationData.property_id,
          name: reservationData.property_name,
          address: reservationData.property_address,
          description: reservationData.description,
          property_type: reservationData.property_type,
          wifi_name: reservationData.property_wifi_name || reservationData.wifi_name,
          wifi_password: reservationData.property_wifi_password || reservationData.wifi_password,
          house_rules: reservationData.house_rules,
          house_manual: reservationData.house_manual,
          check_in_instructions: reservationData.check_in_instructions,
          emergency_contact: reservationData.property_emergency_contact,
          property_details: reservationData.property_details,
          transport_access: reservationData.transport_access,
          amenities: reservationData.property_amenities,
          location_info: reservationData.location_info,
          luggage_info: reservationData.luggage_info,
          access_time: reservationData.access_time, 
          departure_time: reservationData.departure_time || '10:00:00' // Original property departure time
        },
        
        room: {
          // Room Type information
          room_type_id: reservationData.room_type_id,
          room_name: reservationData.room_type_name || 'Standard Room',
          room_type_description: reservationData.room_type_description,
          max_guests: reservationData.room_type_max_guests || reservationData.max_guests,
          base_price: reservationData.base_price,
          room_amenities: reservationData.room_type_amenities,
          bed_configuration: reservationData.bed_configuration,
          room_size_sqm: reservationData.room_size_sqm,
          has_balcony: reservationData.room_type_has_balcony,
          has_kitchen: reservationData.room_type_has_kitchen,
          is_accessible: reservationData.room_type_is_accessible,
          
          // Room Unit information
          room_unit_id: reservationData.room_unit_id,
          unit_number: reservationData.unit_number,
          floor_number: reservationData.floor_number,
          access_code: reservationData.access_code,
          access_instructions: reservationData.access_instructions,
          wifi_name: reservationData.unit_wifi_name,
          wifi_password: reservationData.unit_wifi_password,
          unit_amenities: reservationData.unit_amenities,
          maintenance_notes: reservationData.maintenance_notes,
          
          // Backward compatibility fields
          room_number: reservationData.unit_number || reservationData.room_number || 'TBD',
          amenities: reservationData.room_type_amenities || reservationData.unit_amenities || {}
        },

        // Accommodation tax status for backward compatibility with journey roadmap
        accommodation_tax_paid: allMandatoryServicesPaid,
        
        // Additional computed fields
        checkin_status: completionStatus.isComplete ? 'completed' : 'pending',
        
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
  canAccessRoom(reservationData, allGuestsCompleted = null) {
    try {
      // For multi-guest scenarios, use the completion status parameter
      const isCheckinCompleted = allGuestsCompleted !== null 
        ? allGuestsCompleted 
        : !!reservationData.checkin_submitted_at;
      
      // Check if check-in is completed for all required guests
      if (!isCheckinCompleted) {
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

  // Enhanced helper method to determine room access with services and tax gating
  canAccessRoomWithServices(reservationData, allGuestsCompleted, effectiveTimes, accommodationTaxInvoice) {
    try {
      // First check basic room access requirements
      if (!this.canAccessStayInfo(allGuestsCompleted, accommodationTaxInvoice, effectiveTimes)) {
        return false;
      }

      // Check if today is the check-in date
      const today = new Date().toDateString();
      const checkinDate = new Date(reservationData.check_in_date).toDateString();
      
      if (today !== checkinDate) {
        return false;
      }

      // Use effective access time (which may be overridden by services)
      if (effectiveTimes?.accessTime) {
        const currentTime = new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
        return currentTime >= effectiveTimes.accessTime;
      }

      // If no effective access time, fall back to original property access time
      if (reservationData.access_time) {
        const currentTime = new Date().toTimeString().slice(0, 8); // "HH:MM:SS"
        return currentTime >= reservationData.access_time;
      }

      // If no access time is set, allow access after all requirements are met
      return true;
    } catch (error) {
      console.error('Error determining room access with services:', error);
      return false;
    }
  }

  // Calculate journey roadmap progress for guest experience
  calculateJourneyProgress(isCheckinCompleted, accommodationTaxInvoice, effectiveTimes, reservationStatus) {
    try {
      const steps = [
        {
          id: 'checkin',
          title: 'Complete Check-in',
          description: 'Submit your check-in information',
          status: isCheckinCompleted ? 'completed' : 'current',
          completed_at: isCheckinCompleted ? new Date().toISOString() : null,
          is_required: true
        },
        {
          id: 'tax_payment',
          title: 'Pay Accommodation Tax',
          description: 'Complete required accommodation tax payment',
          status: this.calculateTaxStepStatus(accommodationTaxInvoice, isCheckinCompleted),
          completed_at: accommodationTaxInvoice?.paid_at || null,
          is_required: true,
          amount: accommodationTaxInvoice?.total_amount || 0,
          currency: accommodationTaxInvoice?.currency || 'JPY',
          is_exempted: accommodationTaxInvoice?.status === 'exempted'
        },
        {
          id: 'access_available',
          title: 'Room Access Available',
          description: `Access available from ${effectiveTimes?.accessTime || '14:00'}`,
          status: this.calculateAccessStepStatus(isCheckinCompleted, accommodationTaxInvoice, effectiveTimes),
          completed_at: null, // Access is time-based, not a one-time completion
          is_required: false,
          access_time: effectiveTimes?.accessTime,
          is_time_based: true
        }
      ];

      // Calculate overall progress
      const completedSteps = steps.filter(step => step.status === 'completed').length;
      const totalSteps = steps.length;
      const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

      // Determine current step
      const currentStep = steps.find(step => step.status === 'current') || steps[steps.length - 1];

      return {
        steps,
        current_step: currentStep?.id || 'checkin',
        completed_steps: completedSteps,
        total_steps: totalSteps,
        progress_percentage: progressPercentage,
        is_complete: completedSteps === totalSteps,
        can_access_room: this.canAccessRoomWithServices(
          { check_in_date: new Date().toISOString(), access_time: effectiveTimes?.accessTime },
          isCheckinCompleted,
          effectiveTimes,
          accommodationTaxInvoice
        )
      };
    } catch (error) {
      console.error('Error calculating journey progress:', error);
      return {
        steps: [],
        current_step: 'checkin',
        completed_steps: 0,
        total_steps: 3,
        progress_percentage: 0,
        is_complete: false,
        can_access_room: false
      };
    }
  }

  // Helper method to calculate tax payment step status
  calculateTaxStepStatus(accommodationTaxInvoice, isCheckinCompleted) {
    if (!accommodationTaxInvoice) {
      return isCheckinCompleted ? 'current' : 'pending';
    }

    if (accommodationTaxInvoice.status === 'paid' || accommodationTaxInvoice.status === 'exempted') {
      return 'completed';
    }

    if (accommodationTaxInvoice.status === 'pending' && isCheckinCompleted) {
      return 'current';
    }

    return 'pending';
  }

  // Helper method to calculate access step status
  calculateAccessStepStatus(isCheckinCompleted, accommodationTaxInvoice, effectiveTimes) {
    // Check if previous steps are completed
    const taxPaid = accommodationTaxInvoice?.status === 'paid' || accommodationTaxInvoice?.status === 'exempted';
    const allRequirementsMet = isCheckinCompleted && taxPaid;

    if (!allRequirementsMet) {
      return 'pending';
    }

    // Check if current time is past access time
    const currentTime = new Date().toTimeString().slice(0, 8);
    const accessTime = effectiveTimes?.accessTime || '14:00:00';

    if (currentTime >= accessTime) {
      return 'completed';
    }

    return 'current'; // Requirements met, waiting for access time
  }

  // Determine if guest can access stay info content (service-based tax gating logic)
  canAccessStayInfoWithServices(isCheckinCompleted, mandatoryServices, effectiveTimes) {
    try {
      // Check if check-in is completed
      if (!isCheckinCompleted) {
        return false;
      }

      // Check if all mandatory services are paid or exempted
      if (mandatoryServices.length > 0) {
        const allMandatoryServicesPaid = mandatoryServices.every(service => 
          service.payment_status === 'paid' || service.payment_status === 'exempted'
        );

        if (!allMandatoryServicesPaid) {
          return false;
        }
      }

      // If all requirements are met, guest can access stay info
      // Note: Time-based access is checked separately in canAccessRoomWithServices
      return true;
    } catch (error) {
      console.error('Error determining stay info access with services:', error);
      return false;
    }
  }

  // Legacy method for backward compatibility
  canAccessStayInfo(isCheckinCompleted, accommodationTaxInvoice, effectiveTimes) {
    try {
      // Check if check-in is completed
      if (!isCheckinCompleted) {
        return false;
      }

      // Check accommodation tax requirements (mandatory tax gating)
      if (!accommodationTaxInvoice) {
        // If no tax invoice exists yet, guest cannot access stay info
        return false;
      }

      // Tax must be either paid or exempted
      const taxRequirementMet = accommodationTaxInvoice.status === 'paid' || 
                               accommodationTaxInvoice.status === 'exempted';

      if (!taxRequirementMet) {
        return false;
      }

      // If all requirements are met, guest can access stay info
      // Note: Time-based access is checked separately in canAccessRoomWithServices
      return true;
    } catch (error) {
      console.error('Error determining stay info access:', error);
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

      // console.log('Cleaning tasks query successful, found', data?.length || 0, 'tasks');

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

  // GUEST PROFILE OPERATIONS

  // Get all reservations for a guest by email
  async getReservationsByGuestEmail(guestEmail) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select(`
          *,
          reservation_guests!inner(
            guest_mail,
            guest_firstname,
            guest_lastname,
            guest_contact,
            is_primary_guest,
            checkin_submitted_at,
            admin_verified
          ),
          properties(name, address),
          room_units(unit_number, room_types(name))
        `)
        .eq('reservation_guests.guest_mail', guestEmail)
        .eq('reservation_guests.is_primary_guest', true)
        .order('check_in_date', { ascending: false });

      if (error) {
        console.error('Error fetching reservations by guest email:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching reservations by guest email:', error);
      throw error;
    }
  }

  // Get guest profile data with complete reservation history
  async getGuestProfile(checkinToken) {
    try {
      console.log(`Getting guest profile for token: ${checkinToken}`);
      
      // 1. Get current reservation data
      const currentReservation = await this.getGuestAppData(checkinToken);
      if (!currentReservation) {
        console.log('No current reservation found for token');
        return null;
      }

      // 2. Get primary guest email from current reservation
      let primaryGuestEmail = currentReservation.reservation.guest_mail;
      if (!primaryGuestEmail) {
        // Fallback to booking_email if no guest_mail
        primaryGuestEmail = currentReservation.reservation.booking_email;
      }

      if (!primaryGuestEmail) {
        console.log('No guest email found, cannot fetch profile');
        return null;
      }

      console.log(`Finding all reservations for guest email: ${primaryGuestEmail}`);

      // 3. Get all reservations for this guest
      const allReservations = await this.getReservationsByGuestEmail(primaryGuestEmail);

      console.log(`Found ${allReservations.length} total reservations for guest`);

      // 4. Structure guest profile data to match frontend expectations
      const profileData = {
        guestInfo: {
          email: primaryGuestEmail,
          firstname: currentReservation.reservation.guest_firstname || currentReservation.reservation.booking_firstname,
          lastname: currentReservation.reservation.guest_lastname || currentReservation.reservation.booking_lastname,
          phone: currentReservation.reservation.guest_contact || currentReservation.reservation.booking_phone,
          address: currentReservation.reservation.guest_address,
          // Full name for display (frontend expects displayName not display_name)
          displayName: this.formatGuestDisplayName(
            currentReservation.reservation.guest_firstname || currentReservation.reservation.booking_firstname,
            currentReservation.reservation.guest_lastname || currentReservation.reservation.booking_lastname
          )
        },
        currentReservation: currentReservation.reservation.id ? {
          id: currentReservation.reservation.id,
          booking_name: currentReservation.reservation.booking_name,
          check_in_date: currentReservation.reservation.check_in_date,
          check_out_date: currentReservation.reservation.check_out_date,
          properties: currentReservation.property,
          room_units: {
            room_types: {
              name: currentReservation.room?.room_name || 'Standard Room'
            }
          }
        } : null,
        reservationHistory: allReservations.map(res => {
          const checkInDate = new Date(res.check_in_date);
          const checkOutDate = new Date(res.check_out_date);
          const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
          
          return {
            id: res.id,
            beds24_booking_id: res.beds24_booking_id,
            booking_name: res.booking_name,
            check_in_date: res.check_in_date,
            check_out_date: res.check_out_date,
            // Structure property data to match frontend expectations
            properties: {
              name: res.properties?.name || 'Unknown Property'
            },
            // Structure room data to match frontend expectations
            room_units: {
              room_types: {
                name: res.room_units?.[0]?.room_types?.name || 'Standard Room'
              }
            },
            total_amount: res.total_amount,
            currency: res.currency || 'JPY',
            status: res.status,
            nights: nights,
            num_guests: res.num_guests || 1,
            // Format dates for display
            check_in_display: checkInDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            check_out_display: checkOutDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            // Guest information from reservation_guests
            guest_firstname: res.reservation_guests?.[0]?.guest_firstname,
            guest_lastname: res.reservation_guests?.[0]?.guest_lastname,
            admin_verified: res.reservation_guests?.[0]?.admin_verified || false,
            checkin_completed: !!res.reservation_guests?.[0]?.checkin_submitted_at
          };
        }),
        statistics: {
          totalReservations: allReservations.length,
          completedStays: allReservations.filter(r => r.status === 'completed').length,
          totalSpent: allReservations.reduce((sum, r) => sum + (r.total_amount || 0), 0),
          currency: currentReservation.reservation.currency || 'JPY',
          firstStay: allReservations.length > 0 ? allReservations[allReservations.length - 1].check_in_date : null,
          averageStayLength: allReservations.length > 0 
            ? Math.round(allReservations.reduce((sum, r) => {
                const nights = Math.ceil((new Date(r.check_out_date) - new Date(r.check_in_date)) / (1000 * 60 * 60 * 24));
                return sum + nights;
              }, 0) / allReservations.length)
            : 0
        }
      };

      return profileData;
    } catch (error) {
      console.error('Error getting guest profile:', error);
      throw error;
    }
  }

  // Helper method to format guest display name
  formatGuestDisplayName(firstName, lastName) {
    const parts = [];
    if (firstName && firstName.trim()) parts.push(firstName.trim());
    if (lastName && lastName.trim()) parts.push(lastName.trim());
    return parts.length > 0 ? parts.join(' ') : 'Guest';
  }

  // GROUP BOOKING OPERATIONS

  // Get all reservations in a group booking by master booking ID
  async getGroupBookingReservations(masterBookingId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            address
          ),
          room_types (
            id,
            name,
            description
          ),
          room_units (
            id,
            unit_number,
            floor_number
          )
        `)
        .eq('booking_group_master_id', masterBookingId)
        .order('is_group_master', { ascending: false })
        .order('beds24_booking_id', { ascending: true });

      if (error) {
        console.error('Error fetching group booking reservations:', error);
        throw new Error('Failed to fetch group booking reservations');
      }

      // Transform data for consistency
      const transformedData = (data || []).map(reservation => ({
        ...reservation,
        guest_name: reservation.booking_name,
        guest_email: reservation.booking_email,
        guest_phone: reservation.booking_phone,
        property_name: reservation.properties?.name || 'Unknown Property',
        room_type_name: reservation.room_types?.name || 'Standard Room',
        room_number: reservation.room_units?.unit_number || 'TBD',
        booking_group_ids: reservation.booking_group_ids ? JSON.parse(reservation.booking_group_ids) : null
      }));

      return transformedData;
    } catch (error) {
      console.error('Database error fetching group booking reservations:', error);
      throw error;
    }
  }

  // Get group booking summary with aggregated information
  async getGroupBookingSummary(masterBookingId) {
    try {
      // Get all reservations in the group
      const groupReservations = await this.getGroupBookingReservations(masterBookingId);
      
      if (!groupReservations.length) {
        return null;
      }

      const masterReservation = groupReservations.find(r => r.is_group_master);
      
      // Calculate group summary
      const summary = {
        masterBookingId: masterBookingId,
        masterReservation: masterReservation,
        totalRooms: groupReservations.length,
        groupIds: masterReservation?.booking_group_ids || [],
        
        // Guest information (from master reservation)
        guestName: masterReservation?.booking_name || 'Unknown Guest',
        guestEmail: masterReservation?.booking_email || null,
        guestPhone: masterReservation?.booking_phone || null,
        
        // Date information
        checkInDate: masterReservation?.check_in_date,
        checkOutDate: masterReservation?.check_out_date,
        
        // Financial information
        totalAmount: groupReservations.reduce((sum, r) => sum + (r.total_amount || 0), 0),
        currency: masterReservation?.currency || 'JPY',
        
        // Status information
        groupStatus: this.calculateGroupStatus(groupReservations),
        reservations: groupReservations.map(r => ({
          id: r.id,
          beds24BookingId: r.beds24_booking_id,
          propertyName: r.property_name,
          roomNumber: r.room_number,
          roomTypeName: r.room_type_name,
          totalAmount: r.total_amount,
          status: r.status,
          isGroupMaster: r.is_group_master
        })),
        
        // Property information (unique properties in group)
        properties: [...new Set(groupReservations.map(r => r.property_name))],
        
        // Metadata
        createdAt: masterReservation?.created_at,
        updatedAt: Math.max(...groupReservations.map(r => new Date(r.updated_at).getTime()))
      };

      return summary;
    } catch (error) {
      console.error('Database error fetching group booking summary:', error);
      throw error;
    }
  }

  // Helper method to calculate overall group status
  calculateGroupStatus(reservations) {
    const statuses = reservations.map(r => r.status);
    
    // If any reservation is cancelled, group is partially cancelled
    if (statuses.includes('cancelled') && statuses.some(s => s !== 'cancelled')) {
      return 'partially_cancelled';
    }
    
    // If all are cancelled, group is cancelled
    if (statuses.every(s => s === 'cancelled')) {
      return 'cancelled';
    }
    
    // If all are confirmed, group is confirmed
    if (statuses.every(s => s === 'confirmed')) {
      return 'confirmed';
    }
    
    // Mixed statuses
    return 'mixed_status';
  }

  // Update status for entire group booking
  async updateGroupBookingStatus(masterBookingId, newStatus) {
    try {
      console.log(`Updating group booking status for master ID: ${masterBookingId} to: ${newStatus}`);
      
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('booking_group_master_id', masterBookingId)
        .select('id, beds24_booking_id, status, is_group_master');

      if (error) {
        console.error('Error updating group booking status:', error);
        throw new Error('Failed to update group booking status');
      }

      const updatedCount = data?.length || 0;
      console.log(`Updated status for ${updatedCount} reservations in group ${masterBookingId}`);

      return {
        masterBookingId,
        newStatus,
        updatedReservations: data,
        updatedCount
      };
    } catch (error) {
      console.error('Database error updating group booking status:', error);
      throw error;
    }
  }

  // Cancel entire group booking
  async cancelGroupBooking(masterBookingId, reason = null) {
    try {
      console.log(`Cancelling group booking with master ID: ${masterBookingId}`);
      
      // Get current group reservations before cancelling
      const currentReservations = await this.getGroupBookingReservations(masterBookingId);
      const activereservations = currentReservations.filter(r => r.status !== 'cancelled');
      
      if (activereservations.length === 0) {
        return {
          masterBookingId,
          message: 'All reservations in group are already cancelled',
          cancelledReservations: []
        };
      }

      // Cancel all active reservations in the group
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          comments: reason ? `Group cancellation: ${reason}` : 'Group booking cancelled'
        })
        .eq('booking_group_master_id', masterBookingId)
        .neq('status', 'cancelled') // Only update non-cancelled reservations
        .select('id, beds24_booking_id, status, is_group_master, property_id, room_unit_id');

      if (error) {
        console.error('Error cancelling group booking:', error);
        throw new Error('Failed to cancel group booking');
      }

      const cancelledCount = data?.length || 0;
      console.log(`Cancelled ${cancelledCount} reservations in group ${masterBookingId}`);

      return {
        masterBookingId,
        reason,
        cancelledReservations: data,
        cancelledCount,
        message: `Successfully cancelled ${cancelledCount} reservations in the group`
      };
    } catch (error) {
      console.error('Database error cancelling group booking:', error);
      throw error;
    }
  }

  // Check if a reservation belongs to a group booking
  async isGroupBooking(reservationId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('booking_group_master_id, is_group_master, group_room_count')
        .eq('id', reservationId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking if reservation is group booking:', error);
        throw new Error('Failed to check group booking status');
      }

      if (!data) {
        return false;
      }

      return {
        isGroupBooking: !!data.booking_group_master_id,
        isGroupMaster: data.is_group_master || false,
        masterBookingId: data.booking_group_master_id,
        groupRoomCount: data.group_room_count || 1
      };
    } catch (error) {
      console.error('Database error checking group booking status:', error);
      throw error;
    }
  }

  // Find group booking by any reservation ID in the group
  async findGroupBookingByReservationId(reservationId) {
    try {
      // First get the reservation to find the master booking ID
      const { data: reservation, error: resError } = await supabaseAdmin
        .from('reservations')
        .select('booking_group_master_id, is_group_master')
        .eq('id', reservationId)
        .single();

      if (resError) {
        console.error('Error finding reservation for group lookup:', resError);
        throw new Error('Failed to find reservation');
      }

      if (!reservation.booking_group_master_id) {
        return null; // Not a group booking
      }

      // Get the full group booking summary
      return this.getGroupBookingSummary(reservation.booking_group_master_id);
    } catch (error) {
      console.error('Database error finding group booking by reservation ID:', error);
      throw error;
    }
  }

  // Get all group bookings with pagination and filtering
  async getGroupBookings(filters = {}) {
    try {
      const {
        propertyId,
        status,
        checkInDateFrom,
        checkInDateTo,
        limit = 50,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = filters;

      // Query for group master reservations only
      let query = supabaseAdmin
        .from('reservations')
        .select(`
          *,
          properties (
            id,
            name,
            address
          )
        `)
        .eq('is_group_master', true)
        .not('booking_group_master_id', 'is', null);

      // Apply filters
      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (checkInDateFrom) {
        query = query.gte('check_in_date', checkInDateFrom);
      }

      if (checkInDateTo) {
        query = query.lte('check_in_date', checkInDateTo);
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
        console.error('Error fetching group bookings:', error);
        throw new Error('Failed to fetch group bookings');
      }

      // Get full summaries for each group booking
      const groupBookings = await Promise.all(
        (data || []).map(async (masterReservation) => {
          try {
            return await this.getGroupBookingSummary(masterReservation.booking_group_master_id);
          } catch (summaryError) {
            console.error(`Error getting summary for group ${masterReservation.booking_group_master_id}:`, summaryError);
            // Return basic info if summary fails
            return {
              masterBookingId: masterReservation.booking_group_master_id,
              masterReservation,
              totalRooms: masterReservation.group_room_count || 1,
              guestName: masterReservation.booking_name,
              checkInDate: masterReservation.check_in_date,
              checkOutDate: masterReservation.check_out_date,
              groupStatus: masterReservation.status,
              error: 'Failed to load complete group details'
            };
          }
        })
      );

      return groupBookings.filter(Boolean); // Remove any null results
    } catch (error) {
      console.error('Database error fetching group bookings:', error);
      throw error;
    }
  }

}

module.exports = new ReservationService();
