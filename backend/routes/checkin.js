const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const reservationService = require('../services/reservationService');
const emailService = require('../services/emailService');
const { supabaseAdmin } = require('../config/supabase');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Get reservation details by check-in token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get comprehensive reservation details using guest dashboard data method
    const dashboardData = await reservationService.getGuestDashboardData(token);
    
    if (!dashboardData) {
      return res.status(404).json({ error: 'Invalid or expired check-in link' });
    }

    const reservation = dashboardData.reservation;
    
    // Check if check-in is already completed
    const checkinCompleted = !!reservation.checkin_submitted_at;
    
    if (checkinCompleted) {
      return res.status(200).json({
        reservation: {
          id: reservation.id,
          guestName: reservation.booking_name,
          guestEmail: reservation.booking_email,
          guestPhone: reservation.booking_phone,
          checkInDate: reservation.check_in_date,
          checkOutDate: reservation.check_out_date,
          roomNumber: dashboardData.room.room_number,
          roomTypes: dashboardData.room.room_type_name,
          numGuests: reservation.num_guests,
          // Enhanced information from reservations_details view
          propertyName: dashboardData.property.name,
          roomTypeName: dashboardData.room.room_type_name,
          roomTypeDescription: dashboardData.room.room_type_description,
          unitNumber: dashboardData.room.unit_number,
          floorNumber: dashboardData.room.floor_number,
          bedConfiguration: dashboardData.room.bed_configuration,
          roomSizeSqm: dashboardData.room.room_size_sqm,
          hasBalcony: dashboardData.room.has_balcony,
          hasKitchen: dashboardData.room.has_kitchen,
          maxGuests: dashboardData.room.max_guests
        },
        checkinCompleted: true,
        checkin: {
          id: reservation.id,
          submitted_at: reservation.checkin_submitted_at,
          admin_verified: reservation.admin_verified || false
        },
        guestData: {
          firstName: reservation.guest_firstname,
          lastName: reservation.guest_lastname,
          personalEmail: reservation.guest_mail,
          contactNumber: reservation.guest_contact,
          address: reservation.guest_address,
          estimatedCheckinTime: reservation.estimated_checkin_time,
          travelPurpose: reservation.travel_purpose,
          emergencyContactName: reservation.emergency_contact_name,
          emergencyContactPhone: reservation.emergency_contact_phone,
          passportUrl: reservation.passport_url,
          agreementAccepted: reservation.agreement_accepted,
          submittedAt: reservation.checkin_submitted_at,
          adminVerified: reservation.admin_verified
        }
      });
    }

    // Return enhanced reservation details for check-in form
    return res.status(200).json({
      reservation: {
        id: reservation.id,
        guestName: reservation.booking_name,
        guestEmail: reservation.booking_email,
        guestPhone: reservation.booking_phone,
        checkInDate: reservation.check_in_date,
        checkOutDate: reservation.check_out_date,
        roomNumber: dashboardData.room.room_number,
        roomTypes: dashboardData.room.room_type_name,
        numGuests: reservation.num_guests,
        // Enhanced information from reservations_details view
        propertyName: dashboardData.property.name,
        roomTypeName: dashboardData.room.room_type_name,
        roomTypeDescription: dashboardData.room.room_type_description,
        unitNumber: dashboardData.room.unit_number,
        floorNumber: dashboardData.room.floor_number,
        bedConfiguration: dashboardData.room.bed_configuration,
        roomSizeSqm: dashboardData.room.room_size_sqm,
        hasBalcony: dashboardData.room.has_balcony,
        hasKitchen: dashboardData.room.has_kitchen,
        maxGuests: dashboardData.room.max_guests
      },
      checkinCompleted: false
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit check-in form
router.post('/:token/submit', 
  [
    body('guestInfo.firstName').notEmpty().withMessage('First name is required'),
    body('guestInfo.lastName').notEmpty().withMessage('Last name is required'),
    body('guestInfo.personalEmail').isEmail().withMessage('Valid personal email is required'),
    body('guestInfo.contactNumber').notEmpty().withMessage('Contact number is required'),
    body('passportUrl').notEmpty().withMessage('Passport/ID document is required'),
    body('agreementAccepted').equals('true').withMessage('Agreement must be accepted')
  ],
  async (req, res) => {
    try {
      const { token } = req.params;
      const { guestInfo, passportUrl, agreementAccepted, submittedAt } = req.body;
      
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: errors.array() 
        });
      }

      // Get reservation from database
      const reservation = await reservationService.getReservationByToken(token);
      
      if (!reservation) {
        return res.status(404).json({ error: 'Invalid or expired check-in link' });
      }

      // Check if check-in is already completed
      const existingCheckin = await reservationService.getGuestCheckinByReservationId(reservation.id);
      
      // Allow modification if isModification flag is set
      const isModification = req.body.isModification === true || req.body.isModification === 'true';
      
      if (existingCheckin && !isModification) {
        return res.status(400).json({ error: 'Check-in already completed. Use modification mode to update.' });
      }

      // Prepare guest information for database update
      const guestInfoForDb = {
        firstName: guestInfo.firstName,
        lastName: guestInfo.lastName,
        personalEmail: guestInfo.personalEmail,
        contactNumber: guestInfo.contactNumber,
        address: guestInfo.address,
        estimatedCheckinTime: guestInfo.estimatedCheckinTime,
        travelPurpose: guestInfo.travelPurpose,
        emergencyContactName: guestInfo.emergencyContactName,
        emergencyContactPhone: guestInfo.emergencyContactPhone,
        passportUrl: passportUrl,
        agreementAccepted: agreementAccepted === 'true' || agreementAccepted === true,
        submittedAt: submittedAt || new Date().toISOString()
      };

      // Update reservation with guest information
      const updatedReservation = await reservationService.updateReservationGuestInfo(reservation.id, guestInfoForDb);

      // Send confirmation email to guest
      try {
        await emailService.sendCheckinConfirmation(
          guestInfo.personalEmail,
          `${guestInfo.firstName} ${guestInfo.lastName}`,
          reservation.check_in_date
        );
      } catch (emailError) {
        console.log('Email service not available:', emailError.message);
      }

      // Send notification to admin
      try {
        await emailService.sendAdminNotification(
          `${guestInfo.firstName} ${guestInfo.lastName}`,
          guestInfo.personalEmail,
          reservation.check_in_date,
          reservation.id
        );
      } catch (emailError) {
        console.log('Email service not available:', emailError.message);
      }

      res.status(200).json({
        message: 'Check-in completed successfully',
        checkin: {
          id: updatedReservation.id,
          submittedAt: updatedReservation.checkin_submitted_at,
          adminVerified: false
        }
      });

    } catch (error) {
      console.error('Error submitting check-in:', error);
      res.status(500).json({ error: 'Failed to submit check-in' });
    }
  }
);

// Upload passport file to Supabase Storage
async function uploadPassportFile(file, reservationId) {
  try {
    const fileName = `passports/${reservationId}-${Date.now()}.${file.originalname.split('.').pop()}`;
    
    const { data, error } = await supabaseAdmin.storage
      .from('guest-documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Error uploading file to Supabase:', error);
      throw new Error('Failed to upload passport file');
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('guest-documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;

  } catch (error) {
    console.error('Error in uploadPassportFile:', error);
    throw error;
  }
}

// Resend check-in invitation (for testing or if guest lost email)
router.post('/:token/resend-invitation', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get reservation by token
    const reservation = await reservationService.getReservationByToken(token);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Invalid or expired check-in link' });
    }

    // Send check-in invitation email
    await emailService.sendCheckinInvitation(
      reservation.booking_email,
      reservation.booking_name,
      token,
      reservation.check_in_date
    );

    res.status(200).json({ message: 'Check-in invitation resent successfully' });

  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// Get check-in status
router.get('/:token/status', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get reservation by token
    const reservation = await reservationService.getReservationByToken(token);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Invalid or expired check-in link' });
    }

    // Get check-in details if exists
    const checkin = await reservationService.getGuestCheckinByReservationId(reservation.id);

    res.status(200).json({
      reservationStatus: reservation.status,
      checkinCompleted: !!checkin,
      adminVerified: checkin ? checkin.admin_verified : false,
      submittedAt: checkin ? checkin.submitted_at : null
    });

  } catch (error) {
    console.error('Error getting check-in status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
