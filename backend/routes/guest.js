const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');

// Get guest dashboard data by check-in token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get guest dashboard data
    const dashboardData = await reservationService.getGuestDashboardData(token);

    if (!dashboardData) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching guest dashboard data:', error);
    res.status(500).json({ error: 'Failed to fetch guest dashboard data' });
  }
});

// Update access_read status to true when guest views access code
router.post('/:token/access-read', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Update access_read to true
    const result = await reservationService.updateAccessRead(token);

    if (!result) {
      return res.status(404).json({ error: 'Reservation not found or invalid token' });
    }

    res.json({ success: true, message: 'Access read status updated' });
  } catch (error) {
    console.error('Error updating access read status:', error);
    res.status(500).json({ error: 'Failed to update access read status' });
  }
});

module.exports = router;
