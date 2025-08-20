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

// Get specific check-in details (supports multi-guest)
router.get('/:reservationId', adminAuth, async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Get reservation details
    const reservation = await reservationService.getReservationFullDetails(reservationId);
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // Get all guests for this reservation
    const guests = await reservationService.getReservationGuests(reservationId);
    
    // Get completion status
    const completionStatus = await reservationService.validateAllGuestsComplete(reservationId);

    res.status(200).json({
      reservation: {
        id: reservation.id,
        beds24BookingId: reservation.beds24_booking_id,
        bookingName: reservation.booking_name,
        bookingEmail: reservation.booking_email,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        roomNumber: reservation.unit_number || reservation.room_number || 'TBD',
        numGuests: reservation.num_guests,
        status: reservation.status,
        createdAt: reservation.created_at,
        // Backward compatibility
        guestName: reservation.booking_name,
        guestEmail: reservation.booking_email
      },
      guests: guests.map(guest => ({
        id: guest.id,
        guestNumber: guest.guest_number,
        isPrimaryGuest: guest.is_primary_guest,
        firstName: guest.guest_firstname,
        lastName: guest.guest_lastname,
        email: guest.guest_mail,
        contact: guest.guest_contact,
        address: guest.guest_address,
        passportUrl: guest.passport_url,
        estimatedCheckinTime: guest.estimated_checkin_time,
        travelPurpose: guest.travel_purpose,
        emergencyContactName: guest.emergency_contact_name,
        emergencyContactPhone: guest.emergency_contact_phone,
        agreementAccepted: guest.agreement_accepted,
        adminVerified: guest.admin_verified,
        submittedAt: guest.checkin_submitted_at,
        verifiedAt: guest.verified_at,
        isCompleted: !!guest.checkin_submitted_at
      })),
      completion: completionStatus
    });
  } catch (error) {
    console.error('Error fetching check-in details:', error);
    res.status(500).json({ error: 'Failed to fetch check-in details' });
  }
});

// Update admin verification status for specific guest
router.patch('/:reservationId/guests/:guestNumber/verify', adminAuth, async (req, res) => {
  try {
    const { reservationId, guestNumber } = req.params;
    const { verified } = req.body;

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified status must be a boolean' });
    }

    // Validate guest number
    const guestNum = parseInt(guestNumber);
    if (isNaN(guestNum) || guestNum < 1) {
      return res.status(400).json({ error: 'Invalid guest number. Must be a positive integer.' });
    }

    // Get current guest data
    const currentGuest = await reservationService.getGuestByNumber(reservationId, guestNum);
    if (!currentGuest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Update admin verification status
    const { data: updatedGuest, error } = await require('../config/supabase').supabaseAdmin
      .from('reservation_guests')
      .update({ 
        admin_verified: verified,
        verified_at: verified ? new Date().toISOString() : null,
        verified_by: verified ? req.user?.id || null : null
      })
      .eq('reservation_id', reservationId)
      .eq('guest_number', guestNum)
      .select()
      .single();

    if (error) {
      console.error('Error updating guest verification:', error);
      throw new Error('Failed to update guest verification');
    }

    // Get updated completion status
    const completionStatus = await reservationService.validateAllGuestsComplete(reservationId);

    res.status(200).json({
      message: `Guest ${guestNum} ${verified ? 'verified' : 'unverified'} successfully`,
      data: {
        guest: updatedGuest,
        completion: completionStatus
      }
    });
  } catch (error) {
    console.error('Error updating guest verification status:', error);
    res.status(500).json({ 
      error: 'Failed to update guest verification status',
      details: error.message 
    });
  }
});

// Legacy endpoint for backward compatibility (verifies primary guest)
router.patch('/:checkinId/verify', adminAuth, async (req, res) => {
  try {
    const { checkinId } = req.params;
    const { verified } = req.body;

    console.warn('Using deprecated verification endpoint. Use /guests/1/verify instead.');

    if (typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'Verified status must be a boolean' });
    }

    // For backward compatibility, this verifies the primary guest (guest #1)
    const { data: updatedGuest, error } = await require('../config/supabase').supabaseAdmin
      .from('reservation_guests')
      .update({ 
        admin_verified: verified,
        verified_at: verified ? new Date().toISOString() : null,
        verified_by: verified ? req.user?.id || null : null
      })
      .eq('reservation_id', checkinId)
      .eq('guest_number', 1)
      .select()
      .single();

    if (error) {
      console.error('Error updating primary guest verification:', error);
      throw new Error('Failed to update primary guest verification');
    }

    res.status(200).json({
      message: `Primary guest ${verified ? 'verified' : 'unverified'} successfully`,
      checkin: updatedGuest // For backward compatibility
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ error: 'Failed to update verification status' });
  }
});

module.exports = router;
