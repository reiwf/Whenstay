const { supabaseAdmin } = require('../config/supabase');
const { cleanObject } = require('./utils/dbHelpers');

class PropertyService {
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
          room_types (
            id,
            name,
            max_guests,
            base_price,
            is_active,
            room_units (
              id,
              unit_number,
              floor_number,
              is_active
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
          is_active: propertyData.isActive !== undefined ? propertyData.isActive : true,
          access_time: propertyData.accessTime,
          departure_time: propertyData.departureTime,
          entrance_code: propertyData.entranceCode,
          property_email: propertyData.propertyEmail,
          contact_number: propertyData.contactNumber,
          wifi_name: propertyData.wifiName,
          wifi_password: propertyData.wifiPassword,
          house_rules: propertyData.houseRules,
          check_in_instructions: propertyData.checkInInstructions,
          property_amenities: propertyData.propertyAmenities,
          location_info: propertyData.locationInfo,
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
      if (propertyData.isActive !== undefined) updateData.is_active = propertyData.isActive;
      if (propertyData.accessTime !== undefined) updateData.access_time = propertyData.accessTime;
      if (propertyData.departureTime !== undefined) updateData.departure_time = propertyData.departureTime;
      if (propertyData.ownerId !== undefined) updateData.owner_id = propertyData.ownerId;
      if (propertyData.defaultCleanerId !== undefined) updateData.default_cleaner_id = propertyData.defaultCleanerId;
      if (propertyData.entranceCode !== undefined) updateData.entrance_code = propertyData.entranceCode;
      if (propertyData.propertyEmail !== undefined) updateData.property_email = propertyData.propertyEmail;
      if (propertyData.contactNumber !== undefined) updateData.contact_number = propertyData.contactNumber;
      if (propertyData.wifiName !== undefined) updateData.wifi_name = propertyData.wifiName;
      if (propertyData.wifiPassword !== undefined) updateData.wifi_password = propertyData.wifiPassword;
      if (propertyData.checkInInstructions !== undefined) updateData.check_in_instructions = propertyData.checkInInstructions;
      if (propertyData.houseRules !== undefined) updateData.house_rules = propertyData.houseRules;
      if (propertyData.propertyAmenities !== undefined) updateData.property_amenities = propertyData.propertyAmenities;
      if (propertyData.locationInfo !== undefined) updateData.location_info = propertyData.locationInfo;
      if (propertyData.beds24PropertyId !== undefined) updateData.beds24_property_id = propertyData.beds24PropertyId;

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
              floor_number,
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

}

module.exports = new PropertyService();
