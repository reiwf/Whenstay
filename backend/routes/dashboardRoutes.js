const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const { adminAuth, adminOnlyAuth } = require('../middleware/auth');

// Get dashboard statistics
router.get('/stats', adminOnlyAuth, async (req, res) => {
  try {
    const stats = await reservationService.getDashboardStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get today's dashboard statistics
router.get('/today-stats', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile;
    const stats = await reservationService.getTodayDashboardStats(userProfile);
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error fetching today dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch today dashboard statistics' });
  }
});

// Get today's arrivals
router.get('/today-arrivals', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile;
    const arrivals = await reservationService.getTodayArrivals(userProfile);
    res.status(200).json({
      message: 'Today arrivals retrieved successfully',
      arrivals,
      count: arrivals.length
    });
  } catch (error) {
    console.error('Error fetching today arrivals:', error);
    res.status(500).json({ error: 'Failed to fetch today arrivals' });
  }
});

// Get today's departures
router.get('/today-departures', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile;
    const departures = await reservationService.getTodayDepartures(userProfile);
    res.status(200).json({
      message: 'Today departures retrieved successfully',
      departures,
      count: departures.length
    });
  } catch (error) {
    console.error('Error fetching today departures:', error);
    res.status(500).json({ error: 'Failed to fetch today departures' });
  }
});

// Get currently in-house guests
router.get('/in-house-guests', adminAuth, async (req, res) => {
  try {
    const userProfile = req.userProfile;
    const inHouseGuests = await reservationService.getInHouseGuests(userProfile);
    res.status(200).json({
      message: 'In-house guests retrieved successfully',
      inHouseGuests,
      count: inHouseGuests.length
    });
  } catch (error) {
    console.error('Error fetching in-house guests:', error);
    res.status(500).json({ error: 'Failed to fetch in-house guests' });
  }
});

module.exports = router;