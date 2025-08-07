const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');

// Get guest dashboard data by check-in token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get guest dashboard data
    const dashboardData = await databaseService.getGuestDashboardData(token);

    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching guest dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch guest dashboard data' });
  }
});

module.exports = router;
