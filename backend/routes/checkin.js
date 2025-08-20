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

// Get reservation details by check-in token (supports multi-guest)
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ error: 'Check-in token is required' });
    }

    // Get comprehensive reservation details using guest dashboard data method
    const dashboardData = await reservationService.getGuestAppData(token);
    
    if (!dashboardData) {
      return res.status(404).json({ error: 'Invalid or expired check-in link' });
    }

    const reservation = dashboardData.reservation;
    const guests = dashboardData.guests || [];
    
    // Check if ALL guests have completed check-in (new multi-guest logic)
    const allGuestsCompleted = reservation.all_guests_completed;
    
    // Build reservation response
    const reservationResponse = {
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
      maxGuests: dashboardData.room.max_guests,
      // Multi-guest completion info
      totalGuestsRequired: reservation.total_guests_required,
      completedGuestsCount: reservation.completed_guests_count,
      remainingGuests: reservation.remaining_guests
    };

    if (allGuestsCompleted) {
      // All guests completed - return full details
      const primaryGuest = guests.find(g => g.is_primary_guest) || guests[0];
      
      return res.status(200).json({
        reservation: reservationResponse,
        checkinCompleted: true,
        allGuestsCompleted: true,
        guests: guests.map(guest => ({
          guestNumber: guest.guest_number,
          firstName: guest.guest_firstname,
          lastName: guest.guest_lastname,
          personalEmail: guest.guest_mail,
          contactNumber: guest.guest_contact,
          address: guest.guest_address,
          estimatedCheckinTime: guest.estimated_checkin_time,
          travelPurpose: guest.travel_purpose,
          emergencyContactName: guest.emergency_contact_name,
          emergencyContactPhone: guest.emergency_contact_phone,
          passportUrl: guest.passport_url,
          agreementAccepted: guest.agreement_accepted,
          submittedAt: guest.checkin_submitted_at,
          adminVerified: guest.admin_verified,
          isCompleted: guest.is_completed,
          displayName: guest.display_name
        })),
        // Legacy guestData for backward compatibility (primary guest only)
        guestData: primaryGuest ? {
          firstName: primaryGuest.guest_firstname,
          lastName: primaryGuest.guest_lastname,
          personalEmail: primaryGuest.guest_mail,
          contactNumber: primaryGuest.guest_contact,
          address: primaryGuest.guest_address,
          estimatedCheckinTime: primaryGuest.estimated_checkin_time,
          travelPurpose: primaryGuest.travel_purpose,
          emergencyContactName: primaryGuest.emergency_contact_name,
          emergencyContactPhone: primaryGuest.emergency_contact_phone,
          passportUrl: primaryGuest.passport_url,
          agreementAccepted: primaryGuest.agreement_accepted,
          submittedAt: primaryGuest.checkin_submitted_at,
          adminVerified: primaryGuest.admin_verified
        } : null,
        checkin: {
          id: reservation.id,
          submitted_at: primaryGuest?.checkin_submitted_at,
          admin_verified: primaryGuest?.admin_verified || false
        }
      });
    }

    // Check-in not completed yet - return form data with guest status
    return res.status(200).json({
      reservation: reservationResponse,
      checkinCompleted: false,
      allGuestsCompleted: false,
      guests: guests.map(guest => ({
        guestNumber: guest.guest_number,
        isPrimaryGuest: guest.is_primary_guest,
        isCompleted: guest.is_completed,
        displayName: guest.display_name,
        // Include existing data if available (for editing)
        firstName: guest.guest_firstname,
        lastName: guest.guest_lastname,
        personalEmail: guest.guest_mail,
        contactNumber: guest.guest_contact,
        address: guest.guest_address,
        estimatedCheckinTime: guest.estimated_checkin_time,
        travelPurpose: guest.travel_purpose,
        emergencyContactName: guest.emergency_contact_name,
        emergencyContactPhone: guest.emergency_contact_phone,
        passportUrl: guest.passport_url,
        agreementAccepted: guest.agreement_accepted,
        submittedAt: guest.checkin_submitted_at,
        adminVerified: guest.admin_verified
      }))
    });

  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit all guest information in one request
router.post('/:token/submit-all-guests', 
  [
    body('guests').isArray({ min: 1 }).withMessage('At least one guest is required'),
    body('guests.*.firstName').notEmpty().withMessage('First name is required for all guests'),
    body('guests.*.lastName').notEmpty().withMessage('Last name is required for all guests'),
    body('agreementAccepted').equals('true').withMessage('Agreement must be accepted')
  ],
  async (req, res) => {
    try {
      const { token } = req.params;
      const { guests: guestInfoArray, agreementAccepted, submittedAt } = req.body;
      
      // Validate basic input structure
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

      // Validate number of guests provided matches reservation
      const numGuests = reservation.num_guests || 1;
      if (guestInfoArray.length !== numGuests) {
        return res.status(400).json({ 
          error: `Expected ${numGuests} guests, but received ${guestInfoArray.length}` 
        });
      }

      // Custom validation for guest-specific requirements
      const customValidationErrors = [];
      guestInfoArray.forEach((guest, index) => {
        const guestNumber = index + 1;
        const isPrimary = guestNumber === 1;
        
        // All guests need first and last name
        if (!guest.firstName || !guest.firstName.trim()) {
          customValidationErrors.push(`Guest ${guestNumber}: First name is required`);
        }
        if (!guest.lastName || !guest.lastName.trim()) {
          customValidationErrors.push(`Guest ${guestNumber}: Last name is required`);
        }
        
        // Only primary guest needs email and contact
        if (isPrimary) {
          if (!guest.personalEmail || !guest.personalEmail.trim()) {
            customValidationErrors.push(`Primary guest: Email is required`);
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.personalEmail)) {
            customValidationErrors.push(`Primary guest: Valid email is required`);
          }
          
          if (!guest.contactNumber || !guest.contactNumber.trim()) {
            customValidationErrors.push(`Primary guest: Contact number is required`);
          }
        }
      });

      if (customValidationErrors.length > 0) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: customValidationErrors.map(msg => ({ msg }))
        });
      }

      // Check if check-in is already completed
      const completionStatus = await reservationService.validateAllGuestsComplete(reservation.id);
      
      // Allow modification if isModification flag is set
      const isModification = req.body.isModification === true || req.body.isModification === 'true';
      
      if (completionStatus.isComplete && !isModification) {
        return res.status(400).json({ 
          error: 'Check-in already completed for all guests. Use modification mode to update.' 
        });
      }

      // Process each guest
      const processedGuests = [];
      const failedGuests = [];

      for (let i = 0; i < guestInfoArray.length; i++) {
        const guestInfo = guestInfoArray[i];
        const guestNumber = i + 1;

        try {
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
            passportUrl: guestInfo.passportUrl,
            agreementAccepted: agreementAccepted === 'true' || agreementAccepted === true,
            submittedAt: submittedAt || new Date().toISOString()
          };

          // Create or update guest information
          const updatedGuest = await reservationService.createOrUpdateGuest(reservation.id, guestNumber, guestInfoForDb);
          processedGuests.push({
            guestNumber,
            id: updatedGuest.id,
            name: `${guestInfo.firstName} ${guestInfo.lastName}`.trim()
          });

          // Send confirmation email only to guests with email addresses (primary guest)
          if (guestInfo.personalEmail && guestInfo.personalEmail.trim()) {
            try {
              await emailService.sendCheckinConfirmation(
                guestInfo.personalEmail,
                `${guestInfo.firstName} ${guestInfo.lastName}`,
                reservation.check_in_date
              );
            } catch (emailError) {
              console.log(`Email service not available for guest ${guestNumber}:`, emailError.message);
            }
          }

        } catch (error) {
          console.error(`Error processing guest ${guestNumber}:`, error);
          failedGuests.push({
            guestNumber,
            error: error.message
          });
        }
      }

      // Get final completion status
      const finalCompletionStatus = await reservationService.validateAllGuestsComplete(reservation.id);

      // Send notification to admin if all guests are complete
      if (finalCompletionStatus.isComplete) {
        try {
          await emailService.sendAdminNotification(
            reservation.booking_name,
            reservation.booking_email,
            reservation.check_in_date,
            reservation.id
          );
        } catch (emailError) {
          console.log('Email service not available:', emailError.message);
        }
      }

      // Determine response status
      const hasFailures = failedGuests.length > 0;
      const allSuccessful = processedGuests.length === guestInfoArray.length;

      res.status(allSuccessful ? 200 : 207).json({
        message: allSuccessful 
          ? 'All guests check-in completed successfully'
          : `${processedGuests.length} of ${guestInfoArray.length} guests processed successfully`,
        data: {
          processedGuests,
          failedGuests,
          completion: finalCompletionStatus,
          allGuestsComplete: finalCompletionStatus.isComplete
        },
        warnings: hasFailures ? 'Some guests failed to process' : undefined
      });

    } catch (error) {
      console.error('Error submitting all guests check-in:', error);
      res.status(500).json({ error: 'Failed to submit guests check-in' });
    }
  }
);

// Legacy endpoint for backward compatibility (now supports single guest submission)
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
      
      console.warn('Using legacy single-guest submission endpoint. Consider using /submit-all-guests for multi-guest support.');
      
      // Convert single guest to array format for compatibility with new system
      const guestsArray = [{
        ...guestInfo,
        passportUrl
      }];

      // Modify request body to match new format
      req.body = {
        guests: guestsArray,
        agreementAccepted,
        submittedAt,
        isModification: req.body.isModification
      };

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

      // For legacy compatibility, only submit guest #1
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

      // Create or update guest #1 using new service method
      const updatedGuest = await reservationService.createOrUpdateGuest(reservation.id, 1, guestInfoForDb);

      // Get completion status
      const completionStatus = await reservationService.validateAllGuestsComplete(reservation.id);

      // Send confirmation email
      try {
        await emailService.sendCheckinConfirmation(
          guestInfo.personalEmail,
          `${guestInfo.firstName} ${guestInfo.lastName}`,
          reservation.check_in_date
        );
      } catch (emailError) {
        console.log('Email service not available:', emailError.message);
      }

      // Send admin notification if all guests complete
      if (completionStatus.isComplete) {
        try {
          await emailService.sendAdminNotification(
            reservation.booking_name,
            reservation.booking_email,
            reservation.check_in_date,
            reservation.id
          );
        } catch (emailError) {
          console.log('Email service not available:', emailError.message);
        }
      }

      // Return legacy-compatible response
      res.status(200).json({
        message: 'Check-in completed successfully',
        checkin: {
          id: updatedGuest.id,
          submittedAt: updatedGuest.checkin_submitted_at,
          adminVerified: updatedGuest.admin_verified || false
        },
        // Additional info for multi-guest awareness
        multiGuestInfo: {
          guestNumber: 1,
          completion: completionStatus,
          allGuestsComplete: completionStatus.isComplete
        }
      });

    } catch (error) {
      console.error('Error submitting legacy check-in:', error);
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

// Get check-in status (supports multi-guest)
router.get('/:token/status', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Get reservation by token
    const reservation = await reservationService.getReservationByToken(token);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Invalid or expired check-in link' });
    }

    // Get all guests and completion status
    const guests = await reservationService.getReservationGuests(reservation.id);
    const completionStatus = await reservationService.validateAllGuestsComplete(reservation.id);

    // Get primary guest for backward compatibility
    const primaryGuest = guests.find(g => g.is_primary_guest) || guests[0];

    res.status(200).json({
      reservationStatus: reservation.status,
      checkinCompleted: completionStatus.isComplete,
      adminVerified: primaryGuest ? primaryGuest.admin_verified : false,
      submittedAt: primaryGuest ? primaryGuest.checkin_submitted_at : null,
      // Multi-guest specific status
      multiGuest: {
        totalGuests: reservation.num_guests || 1,
        completedGuests: completionStatus.completedGuests,
        remainingGuests: completionStatus.remainingGuests,
        allComplete: completionStatus.isComplete,
        guestStatus: guests.map(guest => ({
          guestNumber: guest.guest_number,
          isCompleted: !!guest.checkin_submitted_at,
          adminVerified: guest.admin_verified || false,
          displayName: guest.guest_firstname && guest.guest_lastname 
            ? `${guest.guest_firstname} ${guest.guest_lastname}`.trim()
            : `Guest #${guest.guest_number}`
        }))
      }
    });

  } catch (error) {
    console.error('Error getting check-in status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
