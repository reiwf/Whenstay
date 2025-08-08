const { supabaseAdmin } = require('../config/supabase');

class PropertiesService {
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

}

module.exports = new PropertiesService();
