const express = require('express');
const router = express.Router();
const reservationService = require('../services/reservationService');
const { adminAuth } = require('../middleware/auth');

// Get all completed check-ins
router.get('/', adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const checkins = await reservationService.getCompletedCheckins(
      parseInt(limit),
      parseInt(offset)
    );

    res.status(200).json({
      checkins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: checkins.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    res.status(500).json({ error: 'Failed to fetch check-ins' });
  }
});

// Get specific check-in details
router.get('/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await reservationService.getReservationByToken(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const checkin = await reservationService.getGuestCheckinByReservationId(reservation.id);
    if (!checkin) {
      return res.status(404).json({ error: 'Check-in not found' });
    }

    res.status(200).json({
      reservation: {
        id: reservation.id,
        beds24BookingId: reservation.beds24_booking_id,
        guestName: reservation.guest_name,
        guestEmail: reservation.guest_email,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        roomNumber: reservation.room_number,
        numGuests: reservation.num_guests,
        status: reservation.status,
        createdAt: reservation.created_at
      },
      checkin: {
        id: checkin.id,
        passportUrl: checkin.passport_url,
        address: checkin.address,
        estimatedCheckinTime: checkin.estimated_checkin_time,
        travelPurpose: checkin.travel_purpose,
        adminVerified: checkin.admin_verified,
        submittedAt: checkin.submitted_at
      }
    });
  } catch (error) {
    console.error('Error fetching check-in details:', error);
    res.status(500).json({ error: 'Failed to fetch check-in details' });
  }
});

// Update admin verification status
router.patch('/:checkinId/verify', adminAuth, async (req, res) => {
  try {
    const { checkinId } = req.params;
    const { verified } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified status must be a boolean' });
    }

    const updatedCheckin = await reservationService.updateAdminVerification(
      checkinId,
      verified
    );

    res.status(200).json({
      message: `Check-in ${verified ? 'verified' : 'unverified'} successfully`,
      checkin: updatedCheckin
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

module.exports = router;