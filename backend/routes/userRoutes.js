const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { adminAuth, adminOnlyAuth } = require('../middleware/auth');

// Get all users
router.get('/', adminOnlyAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, role, withDetails } = req.query;
    const offset = (page - 1) * limit;

    let users;
    if (withDetails === 'true') {
      users = await userService.getUsersWithDetails(
        parseInt(limit),
        parseInt(offset),
        role
      );
    } else {
      users = await userService.getAllUsers(
        parseInt(limit),
        parseInt(offset),
        role
      );
    }

    res.status(200).json({
      message: 'Users retrieved successfully',
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: users.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user statistics
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await userService.getUserStats();

    res.status(200).json({
      message: 'User statistics retrieved successfully',
      stats
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user statistics' });
  }
});

// Get specific user by ID
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({
      message: 'User retrieved successfully',
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      companyName,
      role,
      isActive
    } = req.body;

    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'First name, last name, email, and role are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
    }

    const userData = {
      firstName,
      lastName,
      email,
      password: password || undefined,
      phone,
      companyName,
      role,
      isActive: isActive !== undefined ? isActive : true
    };

    const user = await userService.createUser(userData);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        ...user,
        password: undefined
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);

    if (error.message.includes('User already registered')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const user = await userService.updateUser(id, updateData);

    res.status(200).json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await userService.deleteUser(id);

    res.status(200).json({
      message: 'User deleted successfully',
      user
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Update user role
router.patch('/:id/role', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
    }

    const user = await userService.updateUserRole(id, role);

    res.status(200).json({
      message: 'User role updated successfully',
      user
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Update user status
router.patch('/:id/status', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const user = await userService.updateUserStatus(id, isActive);

    res.status(200).json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Invitation Management Routes

// Send user invitation
router.post('/invite', adminAuth, async (req, res) => {
  try {
    const { email, role } = req.body;
    const invitedBy = req.user?.profile?.id; // Get from auth middleware

    // Validate required fields
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate role
    const validRoles = ['admin', 'owner', 'guest', 'cleaner'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be one of: admin, owner, guest, cleaner' });
    }

    const invitation = await userService.inviteUser(email, role, invitedBy);

    res.status(201).json({
      message: 'User invitation created successfully',
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitation_expires_at: invitation.invitation_expires_at,
        invitation_status: invitation.invitation_status,
        email_sent: invitation.email_sent || false
      }
    });
  } catch (error) {
    console.error('Error sending user invitation:', error);

    if (error.message.includes('User with this email already exists')) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    res.status(500).json({ error: 'Failed to send user invitation' });
  }
});

// Get invitation details by token (public access)
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    const invitation = await userService.getInvitationByToken(token);

    res.status(200).json({
      message: 'Invitation details retrieved successfully',
      invitation
    });
  } catch (error) {
    console.error('Error getting invitation details:', error);

    if (error.message.includes('This user has already been registered')) {
      return res.status(409).json({ error: 'This user has already been registered' });
    }

    if (error.message.includes('Invalid or expired invitation token') || 
        error.message.includes('Invitation token has expired')) {
      return res.status(404).json({ error: 'Invalid or expired invitation token' });
    }

    res.status(500).json({ error: 'Failed to retrieve invitation details' });
  }
});

// Accept invitation and complete user setup
router.post('/accept-invitation', async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;

    // Validate required fields
    if (!token || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Token, password, first name, and last name are required' 
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    const user = await userService.acceptInvitation(token, password, firstName, lastName);

    res.status(200).json({
      message: 'Invitation accepted successfully',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        is_active: user.is_active,
        invitation_status: user.invitation_status
      }
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);

    if (error.message.includes('This user has already been registered')) {
      return res.status(409).json({ error: 'This user has already been registered' });
    }

    if (error.message.includes('Invalid or expired invitation token') || 
        error.message.includes('Invitation token has expired')) {
      return res.status(404).json({ error: 'Invalid or expired invitation token' });
    }

    if (error.message.includes('Failed to set password')) {
      return res.status(400).json({ error: 'Failed to set password. Please try again.' });
    }

    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Get pending invitations (admin only)
router.get('/invitations/pending', adminAuth, async (req, res) => {
  try {
    const invitations = await userService.getPendingInvitations();

    res.status(200).json({
      message: 'Pending invitations retrieved successfully',
      invitations
    });
  } catch (error) {
    console.error('Error fetching pending invitations:', error);
    res.status(500).json({ error: 'Failed to fetch pending invitations' });
  }
});

// Clean up expired invitations (admin only - maintenance endpoint)
router.post('/invitations/cleanup', adminAuth, async (req, res) => {
  try {
    const cleanupCount = await userService.cleanupExpiredInvitations();

    res.status(200).json({
      message: 'Expired invitations cleanup completed',
      cleaned_up_count: cleanupCount
    });
  } catch (error) {
    console.error('Error cleaning up expired invitations:', error);
    res.status(500).json({ error: 'Failed to cleanup expired invitations' });
  }
});

module.exports = router;
