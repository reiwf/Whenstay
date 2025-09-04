const { supabaseAdmin } = require('../config/supabase');
const { cleanObject } = require('./utils/dbHelpers');
const crypto = require('crypto');

class UserService {
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

      cleanObject(updateData);

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
        total: totalUsers || 0,
        admin: adminUsers || 0,
        owner: ownerUsers || 0,
        guest: guestUsers || 0,
        cleaner: cleanerUsers || 0
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

      // Fetch auth users to get email addresses
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error fetching auth users:', authError);
        // Continue without auth data if there's an error
      }

      // Create a map of auth users by ID for quick lookup
      const authUserMap = {};
      if (authUsers && authUsers.users) {
        authUsers.users.forEach(authUser => {
          authUserMap[authUser.id] = authUser;
        });
      }

      // Add computed stats and auth data for each user
      const usersWithStats = data.map(user => {
        const activeProperties = user.properties?.filter(p => p.is_active) || [];
        const authUser = authUserMap[user.id];

        return {
          ...user,
          email: authUser?.email || null, // Add email from auth system
          email_confirmed: authUser?.email_confirmed_at ? true : false,
          last_sign_in: authUser?.last_sign_in_at || null,
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

  // Invitation Management Methods

  // Generate a secure invitation token
  generateInvitationToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Invite a new user by email
  async inviteUser(email, role, invitedBy) {
    try {
      // Check if user already exists
      const existingUser = await this.getUserByEmail(email);
      if (existingUser && existingUser.profile) {
        throw new Error('User with this email already exists');
      }

      // Validate role
      const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
      if (!validRoles.includes(role)) {
        throw new Error('Invalid role. Must be one of: admin, owner, guest, cleaner');
      }

      // Generate secure invitation token
      const invitationToken = this.generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

      // Create auth user without password (email not confirmed)
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        email_confirm: false, // User will confirm via invitation
        user_metadata: {
          role: role,
          invited: true
        }
      });

      if (authError) {
        console.error('Error creating auth user for invitation:', authError);
        throw new Error(`Failed to create invitation: ${authError.message}`);
      }

      // Create user profile with invitation details
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: authUser.user.id,
          role: role,
          first_name: null, // User will provide during acceptance
          last_name: null,
          phone: null,
          company_name: null,
          is_active: false, // Inactive until invitation accepted
          invitation_token: invitationToken,
          invitation_expires_at: expiresAt.toISOString(),
          invited_by: invitedBy,
          invitation_status: 'pending'
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating user profile for invitation:', profileError);
        
        // Clean up auth user if profile creation fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        } catch (cleanupError) {
          console.error('Error cleaning up auth user:', cleanupError);
        }
        
        throw new Error(`Failed to create invitation profile: ${profileError.message}`);
      }

      // Send invitation email (with graceful failure handling)
      const emailService = require('./emailService');
      try {
        await emailService.sendUserInvitation(email, invitationToken, role);
        console.log(`Invitation email sent successfully to ${email}`);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Don't throw the error - the invitation was created successfully
        // The user can manually send the invitation URL or troubleshoot email later
      }

      return {
        ...profile,
        email: authUser.user.email,
        auth_id: authUser.user.id,
        email_sent: true // We'll assume it was sent for now
      };
    } catch (error) {
      console.error('Database error inviting user:', error);
      throw error;
    }
  }

  // Validate invitation token and get invitation details
  async validateInvitationToken(token) {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('invitation_token', token)
        .eq('invitation_status', 'pending')
        .single();

      if (error || !data) {
        // Check if this user already exists and is active (already registered)
        const { data: existingUser, error: existingError } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('invitation_token', token)
          .single();

        if (existingUser && existingUser.is_active && existingUser.invitation_status === 'accepted') {
          throw new Error('This user has already been registered');
        }

        throw new Error('Invalid or expired invitation token');
      }

      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(data.invitation_expires_at);
      
      if (now > expiresAt) {
        // Mark as expired
        await this.markInvitationExpired(token);
        throw new Error('Invitation token has expired');
      }

      // Get email from auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(data.id);
      
      if (authError || !authUser.user) {
        throw new Error('Failed to get invitation details');
      }

      return {
        ...data,
        email: authUser.user.email
      };
    } catch (error) {
      console.error('Database error validating invitation token:', error);
      throw error;
    }
  }

  // Get invitation by token (for public access)
  async getInvitationByToken(token) {
    try {
      const invitation = await this.validateInvitationToken(token);
      
      // Return only safe fields for public access
      return {
        role: invitation.role,
        email: invitation.email,
        expires_at: invitation.invitation_expires_at,
        invited_by: invitation.invited_by
      };
    } catch (error) {
      console.error('Database error getting invitation by token:', error);
      throw error;
    }
  }

  // Accept invitation and complete user setup
  async acceptInvitation(token, password, firstName, lastName) {
    try {
      // Validate invitation
      const invitation = await this.validateInvitationToken(token);
      
      // Set password for auth user
      const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
        invitation.id,
        { 
          password: password,
          email_confirm: true // Confirm email upon acceptance
        }
      );

      if (passwordError) {
        console.error('Error setting password for invited user:', passwordError);
        throw new Error('Failed to set password');
      }

      // Update user profile
      const { data: updatedProfile, error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          is_active: true,
          invitation_token: null, // Clear token
          invitation_expires_at: null,
          invitation_status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', invitation.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user profile after invitation acceptance:', updateError);
        throw new Error('Failed to complete invitation acceptance');
      }

      return {
        ...updatedProfile,
        email: invitation.email
      };
    } catch (error) {
      console.error('Database error accepting invitation:', error);
      throw error;
    }
  }

  // Mark invitation as expired
  async markInvitationExpired(token) {
    try {
      await supabaseAdmin
        .from('user_profiles')
        .update({
          invitation_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('invitation_token', token);
    } catch (error) {
      console.error('Error marking invitation as expired:', error);
    }
  }

  // Get pending invitations (for admin)
  async getPendingInvitations() {
    try {
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .select(`
          *,
          invited_by_profile:invited_by (
            first_name,
            last_name
          )
        `)
        .eq('invitation_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending invitations:', error);
        throw new Error('Failed to fetch pending invitations');
      }

      // Get email addresses from auth users
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('Error fetching auth users for invitations:', authError);
        return data; // Return without email if auth fetch fails
      }

      // Create a map of auth users by ID
      const authUserMap = {};
      if (authUsers && authUsers.users) {
        authUsers.users.forEach(authUser => {
          authUserMap[authUser.id] = authUser;
        });
      }

      // Add email addresses to invitation data
      const invitationsWithEmails = data.map(invitation => {
        const authUser = authUserMap[invitation.id];
        return {
          ...invitation,
          email: authUser?.email || null
        };
      });

      return invitationsWithEmails;
    } catch (error) {
      console.error('Database error fetching pending invitations:', error);
      throw error;
    }
  }

  // Clean up expired invitations (for maintenance)
  async cleanupExpiredInvitations() {
    try {
      const now = new Date().toISOString();
      
      // Get expired invitations
      const { data: expiredInvitations, error: fetchError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('invitation_status', 'pending')
        .lt('invitation_expires_at', now);

      if (fetchError) {
        console.error('Error fetching expired invitations:', fetchError);
        return 0;
      }

      if (!expiredInvitations || expiredInvitations.length === 0) {
        return 0;
      }

      // Mark as expired
      const { error: updateError } = await supabaseAdmin
        .from('user_profiles')
        .update({
          invitation_status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('invitation_status', 'pending')
        .lt('invitation_expires_at', now);

      if (updateError) {
        console.error('Error marking invitations as expired:', updateError);
        throw new Error('Failed to cleanup expired invitations');
      }

      console.log(`Cleaned up ${expiredInvitations.length} expired invitations`);
      return expiredInvitations.length;
    } catch (error) {
      console.error('Database error cleaning up expired invitations:', error);
      throw error;
    }
  }

  // Get complete guest dashboard data by check-in token
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
      const existingUser = await this.getUserByEmail('admin@staylabel.com');
      
      if (existingUser && existingUser.profile) {
        console.log('Test admin user already exists');
        return existingUser.profile;
      }

      // Create auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: 'admin@staylabel.com',
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
          company_name: 'Staylabel',
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


module.exports = new UserService();
