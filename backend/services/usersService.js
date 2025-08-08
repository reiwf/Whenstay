const { supabaseAdmin } = require('../config/supabase');

class UsersService {
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

module.exports = new UsersService();
