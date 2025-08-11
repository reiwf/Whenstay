const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { adminAuth } = require('../middleware/auth');

// User login with email and password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { user, profile, session } = await userService.authenticateUser(email, password);

    res.status(200).json({
      message: 'Login successful',
      token: session?.access_token || `mock_token_${user.id}_${Date.now()}`,
      user: {
        id: user.id,
        email: user.email,
        profile: {
          id: profile.id,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          company_name: profile.company_name,
          is_active: profile.is_active,
          created_at: profile.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error during login:', error);

    if (error.message.includes('Invalid email or password')) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (error.message.includes('User profile not found')) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    if (error.message.includes('User account is deactivated')) {
      return res.status(401).json({ error: 'User account is deactivated' });
    }

    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', adminAuth, async (req, res) => {
  try {
    const profile = req.userProfile;
    const user = req.user;

    res.status(200).json({
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        email: user.email,
        profile: {
          id: profile.id,
          role: profile.role,
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          company_name: profile.company_name,
          is_active: profile.is_active,
          created_at: profile.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Logout (client-side token removal, server-side session invalidation)
router.post('/logout', adminAuth, async (req, res) => {
  try {
    res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});


module.exports = router;
