const userService = require('../services/userService');

// Middleware to verify admin token and attach user/profile
const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    const { user, profile } = await userService.verifyTokenAndGetProfile(token);

    if (!['admin', 'owner', 'cleaner'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user = user;
    req.userProfile = profile;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware for admin-only routes (admin and owner only)
const adminOnlyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);

    const { user, profile } = await userService.verifyTokenAndGetProfile(token);

    if (!['admin', 'owner'].includes(profile.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.user = user;
    req.userProfile = profile;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { adminAuth, adminOnlyAuth };