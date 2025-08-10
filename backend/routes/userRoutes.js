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

module.exports = router;