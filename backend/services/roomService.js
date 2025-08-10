    const { supabaseAdmin } = require('../config/supabase');
const { cleanObject } = require('./utils/dbHelpers');

class RoomService {
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
          currency: roomTypeData.currency || 'JPY',
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

      // Check for same-day check-ins and calculate smart priority
      const tasksWithSmartPriority = await Promise.all(
        data.map(async (task) => {
          let calculatedPriority = task.priority || 'normal';
          let hasSameDayCheckin = false;
          
          // Check if there's a same-day check-in for this room unit
          if (task.room_unit_id && task.task_date) {
            try {
              const { data: sameDayCheckins, error: checkinError } = await supabaseAdmin
                .from('reservations')
                .select('id, check_in_date, booking_name')
                .eq('room_unit_id', task.room_unit_id)
                .eq('check_in_date', task.task_date)
                .limit(1);
              
              if (!checkinError && sameDayCheckins && sameDayCheckins.length > 0) {
                hasSameDayCheckin = true;
                if (calculatedPriority !== 'high') {
                  calculatedPriority = 'high';
                  console.log(`Setting high priority for task ${task.id} - same-day check-in found for room ${task.room_units?.unit_number}`);
                }
              }
            } catch (error) {
              console.error('Error checking for same-day check-ins:', error);
              // Keep original priority if check fails
            }
          }
          
          // If no same-day check-in found but task is currently high priority, downgrade to normal
          if (!hasSameDayCheckin && calculatedPriority === 'high') {
            calculatedPriority = 'normal';
            console.log(`Downgrading task ${task.id} from high to normal priority - no same-day check-in found for room ${task.room_units?.unit_number}`);
          }
          
          return {
            ...task,
            // Override priority with calculated value
            priority: calculatedPriority,
            
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
            has_same_day_checkin: calculatedPriority === 'high' && task.priority !== 'high', // Indicates auto-calculated priority
            
            // Clean up nested objects for simpler frontend handling
            property: task.properties,
            room_unit: task.room_units,
            reservation: task.reservations,
            cleaner: task.user_profiles
          };
        })
      );

      return tasksWithSmartPriority;

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

}

module.exports = new RoomService();