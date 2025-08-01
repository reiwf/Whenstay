const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('uuid');

class DatabaseService {
  // Create a new reservation record
  async createReservation(reservationData) {
    try {
      const checkinToken = uuidv4();
      
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .insert({
          beds24_booking_id: reservationData.beds24BookingId,
          booking_name: reservationData.bookingName || reservationData.guestName,
          booking_email: reservationData.bookingEmail || reservationData.guestEmail,
          booking_phone: reservationData.bookingPhone || reservationData.guestPhone,
          check_in_date: reservationData.checkInDate,
          check_out_date: reservationData.checkOutDate,
          room_number: reservationData.roomNumber,
          num_guests: reservationData.numGuests || 1,
          total_amount: reservationData.totalAmount,
          currency: reservationData.currency || 'USD',
          status: 'pending',
          check_in_token: checkinToken
        })
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

  // Get reservations with filtering for admin dashboard
  async getReservationsWithFilters(filters = {}) {
    try {
      const {
        status,
        propertyId,
        checkInDateFrom,
        checkInDateTo,
        checkInDate,
        limit = 50,
        offset = 0,
        sortBy = 'check_in_date',
        sortOrder = 'desc'
      } = filters;

      let query = supabaseAdmin
        .from('reservations_with_details')
        .select('*');

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (propertyId) {
        query = query.eq('property_id', propertyId);
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
        throw new Error('Failed to fetch reservations');
      }

      return data;
    } catch (error) {
      console.error('Database error fetching reservations with filters:', error);
      throw error;
    }
  }

  // Get reservation statistics with filters
  async getReservationStats(filters = {}) {
    try {
      const {
        propertyId,
        checkInDateFrom,
        checkInDateTo,
        checkInDate
      } = filters;

      let baseQuery = supabaseAdmin.from('reservations');

      // Apply same filters as main query
      if (propertyId) {
        baseQuery = baseQuery.eq('room_id', propertyId); // Note: This needs to be adjusted for property filtering
      }

      if (checkInDate) {
        baseQuery = baseQuery.eq('check_in_date', checkInDate);
      } else {
        if (checkInDateFrom) {
          baseQuery = baseQuery.gte('check_in_date', checkInDateFrom);
        }
        if (checkInDateTo) {
          baseQuery = baseQuery.lte('check_in_date', checkInDateTo);
        }
      }

      // Get counts by status
      const [totalResult, pendingResult, invitedResult, completedResult, cancelledResult] = await Promise.all([
        baseQuery.select('*', { count: 'exact', head: true }),
        baseQuery.select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        baseQuery.select('*', { count: 'exact', head: true }).eq('status', 'invited'),
        baseQuery.select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        baseQuery.select('*', { count: 'exact', head: true }).eq('status', 'cancelled')
      ]);

      // Get revenue for completed reservations
      const { data: revenueData, error: revenueError } = await baseQuery
        .select('total_amount')
        .eq('status', 'completed');

      if (revenueError) {
        console.error('Error fetching revenue data:', revenueError);
      }

      const totalRevenue = revenueData?.reduce((sum, res) => sum + (res.total_amount || 0), 0) || 0;

      return {
        totalReservations: totalResult.count || 0,
        pendingReservations: pendingResult.count || 0,
        invitedReservations: invitedResult.count || 0,
        completedReservations: completedResult.count || 0,
        cancelledReservations: cancelledResult.count || 0,
        totalRevenue: totalRevenue,
        averageReservationValue: completedResult.count > 0 ? totalRevenue / completedResult.count : 0
      };
    } catch (error) {
      console.error('Database error fetching reservation stats:', error);
      return {
        totalReservations: 0,
        pendingReservations: 0,
        invitedReservations: 0,
        completedReservations: 0,
        cancelledReservations: 0,
        totalRevenue: 0,
        averageReservationValue: 0
      };
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

  // Log webhook events
  async logWebhookEvent(eventType, beds24EventId, payload, processed = false) {
    try {
      const { data, error } = await supabaseAdmin
        .from('webhook_events')
        .insert({
          event_type: eventType,
          beds24_event_id: beds24EventId,
          payload: payload,
          processed: processed
        })
        .select()
        .single();

      if (error) {
        console.error('Error logging webhook event:', error);
        // Don't throw error for logging failures
      }

      return data;
    } catch (error) {
      console.error('Database error logging webhook event:', error);
      // Don't throw error for logging failures
    }
  }

  // Mark webhook event as processed
  async markWebhookEventProcessed(eventId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('webhook_events')
        .update({ 
          processed: true, 
          processed_at: new Date().toISOString() 
        })
        .eq('id', eventId)
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
  async webhookEventExists(beds24EventId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('webhook_events')
        .select('id')
        .eq('beds24_event_id', beds24EventId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking webhook event existence:', error);
        return false;
      }

      return !!data;
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

      // Get total rooms
      const { count: totalRooms } = await supabaseAdmin
        .from('rooms')
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
  async getAllProperties() {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select(`
          *,
          rooms (*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        throw new Error('Failed to fetch properties');
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
          *,
          rooms (*)
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
          total_rooms: propertyData.totalRooms || 1,
          wifi_name: propertyData.wifiName,
          wifi_password: propertyData.wifiPassword,
          house_rules: propertyData.houseRules,
          check_in_instructions: propertyData.checkInInstructions,
          emergency_contact: propertyData.emergencyContact,
          property_amenities: propertyData.propertyAmenities,
          location_info: propertyData.locationInfo
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

  // Create room
  async createRoom(propertyId, roomData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .insert({
          property_id: propertyId,
          room_number: roomData.roomNumber,
          room_name: roomData.roomName,
          room_type: roomData.roomType,
          max_guests: roomData.maxGuests || 2,
          access_code: roomData.accessCode,
          access_instructions: roomData.accessInstructions,
          room_amenities: roomData.roomAmenities,
          room_size_sqm: roomData.roomSizeSqm,
          bed_configuration: roomData.bedConfiguration,
          floor_number: roomData.floorNumber,
          wifi_name: roomData.wifiName,
          wifi_password: roomData.wifiPassword,
          has_balcony: roomData.hasBalcony || false,
          has_kitchen: roomData.hasKitchen || false,
          is_accessible: roomData.isAccessible || false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating room:', error);
        throw new Error('Failed to create room');
      }

      return data;
    } catch (error) {
      console.error('Database error creating room:', error);
      throw error;
    }
  }

  // Update room
  async updateRoom(roomId, roomData) {
    try {
      const updateData = {};
      
      if (roomData.roomNumber !== undefined) updateData.room_number = roomData.roomNumber;
      if (roomData.roomName !== undefined) updateData.room_name = roomData.roomName;
      if (roomData.roomType !== undefined) updateData.room_type = roomData.roomType;
      if (roomData.maxGuests !== undefined) updateData.max_guests = roomData.maxGuests;
      if (roomData.accessCode !== undefined) updateData.access_code = roomData.accessCode;
      if (roomData.accessInstructions !== undefined) updateData.access_instructions = roomData.accessInstructions;
      if (roomData.roomAmenities !== undefined) updateData.room_amenities = roomData.roomAmenities;
      if (roomData.roomSizeSqm !== undefined) updateData.room_size_sqm = roomData.roomSizeSqm;
      if (roomData.bedConfiguration !== undefined) updateData.bed_configuration = roomData.bedConfiguration;
      if (roomData.floorNumber !== undefined) updateData.floor_number = roomData.floorNumber;
      if (roomData.wifiName !== undefined) updateData.wifi_name = roomData.wifiName;
      if (roomData.wifiPassword !== undefined) updateData.wifi_password = roomData.wifiPassword;
      if (roomData.hasBalcony !== undefined) updateData.has_balcony = roomData.hasBalcony;
      if (roomData.hasKitchen !== undefined) updateData.has_kitchen = roomData.hasKitchen;
      if (roomData.isAccessible !== undefined) updateData.is_accessible = roomData.isAccessible;

      const { data, error } = await supabaseAdmin
        .from('rooms')
        .update(updateData)
        .eq('id', roomId)
        .select()
        .single();

      if (error) {
        console.error('Error updating room:', error);
        throw new Error('Failed to update room');
      }

      return data;
    } catch (error) {
      console.error('Database error updating room:', error);
      throw error;
    }
  }

  // Delete room (soft delete)
  async deleteRoom(roomId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('rooms')
        .update({ is_active: false })
        .eq('id', roomId)
        .select()
        .single();

      if (error) {
        console.error('Error deleting room:', error);
        throw new Error('Failed to delete room');
      }

      return data;
    } catch (error) {
      console.error('Database error deleting room:', error);
      throw error;
    }
  }

  // Get properties with statistics
  async getPropertiesWithStats() {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select(`
          *,
          rooms (
            id,
            room_number,
            room_name,
            max_guests,
            is_active,
            reservations (
              id,
              status,
              check_in_date,
              check_out_date,
              total_amount
            )
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties with stats:', error);
        throw new Error('Failed to fetch properties with stats');
      }

      // Calculate statistics for each property
      const propertiesWithStats = data.map(property => {
        const activeRooms = property.rooms.filter(room => room.is_active);
        const allReservations = activeRooms.flatMap(room => room.reservations || []);
        const completedReservations = allReservations.filter(res => res.status === 'completed');
        const upcomingReservations = allReservations.filter(res => 
          res.status === 'invited' && new Date(res.check_in_date) >= new Date()
        );

        const totalRevenue = completedReservations.reduce((sum, res) => sum + (res.total_amount || 0), 0);
        const occupancyRate = activeRooms.length > 0 ? 
          (completedReservations.length / (activeRooms.length * 30)) * 100 : 0; // Rough monthly occupancy

        return {
          ...property,
          stats: {
            totalRooms: activeRooms.length,
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
          properties (
            id,
            name,
            address,
            is_active
          ),
          cleaning_tasks (
            id,
            status,
            task_date
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
        const recentTasks = user.cleaning_tasks?.filter(t => 
          new Date(t.task_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ) || [];

        return {
          ...user,
          stats: {
            totalProperties: activeProperties.length,
            recentTasks: recentTasks.length,
            completedTasks: recentTasks.filter(t => t.status === 'completed').length
          }
        };
      });

      return usersWithStats;
    } catch (error) {
      console.error('Database error fetching users with details:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService();
