const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Simple test reservations data with consistent tokens
const testReservations = [
  {
    id: '851fd7de-0e34-44f7-afcd-78b3c5fed99d',
    beds24_booking_id: 'DEMO-001',
    guest_name: 'John Smith',
    guest_email: 'john.smith@example.com',
    check_in_date: '2025-01-28',
    check_out_date: '2025-01-30',
    room_number: '101',
    num_guests: 2,
    total_amount: 250.00,
    currency: 'JPY',
    status: 'invited',
    check_in_token: '851fd7de-0e34-44f7-afcd-78b3c5fed99d',
    created_at: new Date().toISOString()
  },
  {
    id: '2e71d017-b6b8-496d-846a-ab10cc0be4ec',
    beds24_booking_id: 'DEMO-002',
    guest_name: 'Sarah Johnson',
    guest_email: 'sarah.johnson@example.com',
    check_in_date: '2025-01-29',
    check_out_date: '2025-02-01',
    room_number: '102',
    num_guests: 1,
    total_amount: 180.00,
    currency: 'JPY',
    status: 'invited',
    check_in_token: '2e71d017-b6b8-496d-846a-ab10cc0be4ec',
    created_at: new Date().toISOString()
  },
  {
    id: 'b32469c5-fed6-4d98-ae09-f847e63e708d',
    beds24_booking_id: 'DEMO-003',
    guest_name: 'Michael Brown',
    guest_email: 'michael.brown@example.com',
    check_in_date: '2025-01-30',
    check_out_date: '2025-02-02',
    room_number: '201',
    num_guests: 3,
    total_amount: 320.00,
    currency: 'JPY',
    status: 'invited',
    check_in_token: 'b32469c5-fed6-4d98-ae09-f847e63e708d',
    created_at: new Date().toISOString()
  }
];

// Get test reservations
router.get('/reservations', (req, res) => {
  res.json({
    message: 'Test reservations retrieved',
    reservations: testReservations
  });
});

// Get specific test reservation by token
router.get('/reservations/:token', (req, res) => {
  const { token } = req.params;
  const reservation = testReservations.find(r => r.check_in_token === token);
  
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  res.json({
    message: 'Reservation found',
    reservation
  });
});

// Create test check-in
router.post('/checkin/:token', (req, res) => {
  const { token } = req.params;
  const reservation = testReservations.find(r => r.check_in_token === token);
  
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  const checkinData = {
    id: uuidv4(),
    reservation_id: reservation.id,
    passport_url: req.body.passportUrl || 'https://example.com/passport.jpg',
    address: req.body.address || '123 Test Street, Test City',
    estimated_checkin_time: req.body.estimatedCheckinTime || '15:00',
    travel_purpose: req.body.travelPurpose || 'Tourism',
    admin_verified: false,
    submitted_at: new Date().toISOString()
  };
  
  // Update reservation status
  reservation.status = 'completed';
  
  res.json({
    message: 'Check-in completed successfully',
    checkin: checkinData,
    reservation
  });
});

// Get dashboard stats (mock data)
router.get('/dashboard/stats', (req, res) => {
  const stats = {
    totalReservations: testReservations.length,
    completedCheckins: testReservations.filter(r => r.status === 'completed').length,
    pendingCheckins: testReservations.filter(r => r.status === 'invited').length,
    verifiedCheckins: Math.floor(testReservations.length / 2)
  };
  
  res.json(stats);
});

// Get check-ins for admin dashboard
router.get('/checkins', (req, res) => {
  const checkins = testReservations.map(reservation => ({
    reservation_id: reservation.id,
    guest_name: reservation.guest_name,
    guest_email: reservation.guest_email,
    room_number: reservation.room_number,
    check_in_date: reservation.check_in_date,
    status: reservation.status,
    admin_verified: Math.random() > 0.5
  }));
  
  res.json({
    message: 'Check-ins retrieved',
    checkins
  });
});

module.exports = router;
