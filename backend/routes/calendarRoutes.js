const express = require('express');
const router = express.Router();
const calendarService = require('../services/calendarService');
const { adminAuth } = require('../middleware/auth');

/**
 * Calendar Routes - PMS Timeline Calendar API
 * All routes require admin authentication
 */

// Apply admin authentication to all calendar routes
router.use(adminAuth);

/**
 * GET /api/calendar/properties
 * Get available properties for the property selector
 */
router.get('/properties', async (req, res) => {
  try {
    const properties = await calendarService.getAvailableProperties();
    
    res.status(200).json({
      success: true,
      data: properties,
      message: `Found ${properties.length} available properties`
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties',
      details: error.message
    });
  }
});

/**
 * GET /api/calendar/timeline/:propertyId
 * Get timeline data for a specific property
 * Query params: startDate, endDate (optional - defaults to yesterday + 29 days)
 */
router.get('/timeline/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { startDate, endDate } = req.query;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
    }

    const timelineData = await calendarService.getTimelineData(
      propertyId, 
      startDate, 
      endDate
    );
    
    res.status(200).json({
      success: true,
      data: timelineData,
      message: `Timeline data loaded for ${timelineData.dateRange.totalDays} days`
    });
  } catch (error) {
    console.error('Error fetching timeline data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline data',
      details: error.message
    });
  }
});

/**
 * GET /api/calendar/rooms/:propertyId
 * Get room hierarchy for a specific property
 */
router.get('/rooms/:propertyId', async (req, res) => {
  try {
    const { propertyId } = req.params;

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'Property ID is required'
      });
    }

    const roomHierarchy = await calendarService.getPropertyRoomHierarchy(propertyId);
    
    res.status(200).json({
      success: true,
      data: roomHierarchy,
      message: `Found ${roomHierarchy.length} room types`
    });
  } catch (error) {
    console.error('Error fetching room hierarchy:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room hierarchy',
      details: error.message
    });
  }
});

/**
 * PUT /api/calendar/reservation/:reservationId/move
 * Move a reservation to different room/dates
 * Body: { newRoomUnitId?, newStartDate?, newEndDate? }
 */
router.put('/reservation/:reservationId/move', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { newRoomUnitId, newStartDate, newEndDate } = req.body;

    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: 'Reservation ID is required'
      });
    }

    // At least one change must be specified
    if (!newRoomUnitId && !newStartDate && !newEndDate) {
      return res.status(400).json({
        success: false,
        error: 'At least one change (room or dates) must be specified'
      });
    }

    const result = await calendarService.moveReservation(
      reservationId,
      newRoomUnitId,
      newStartDate,
      newEndDate
    );
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Reservation moved successfully'
    });
  } catch (error) {
    console.error('Error moving reservation:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to move reservation',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar/reservation/:reservationId/split
 * Split a reservation into segments for mid-stay room changes
 * Body: { splitDate, newRoomUnitId }
 */
router.post('/reservation/:reservationId/split', async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { splitDate, newRoomUnitId } = req.body;

    if (!reservationId || !splitDate || !newRoomUnitId) {
      return res.status(400).json({
        success: false,
        error: 'Reservation ID, split date, and new room unit ID are required'
      });
    }

    const result = await calendarService.splitReservation(
      reservationId,
      splitDate,
      newRoomUnitId
    );
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Reservation split successfully'
    });
  } catch (error) {
    console.error('Error splitting reservation:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to split reservation',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar/reservations/swap
 * Swap positions of two reservations
 * Body: { 
 *   reservationA: { id, newRoomUnitId, newStartDate, newEndDate },
 *   reservationB: { id, newRoomUnitId, newStartDate, newEndDate }
 * }
 */
router.post('/reservations/swap', async (req, res) => {
  try {
    const { reservationA, reservationB } = req.body;

    // Validate input
    if (!reservationA || !reservationB) {
      return res.status(400).json({
        success: false,
        error: 'Both reservationA and reservationB are required'
      });
    }

    if (!reservationA.id || !reservationB.id) {
      return res.status(400).json({
        success: false,
        error: 'Both reservations must have valid IDs'
      });
    }

    if (!reservationA.newRoomUnitId || !reservationB.newRoomUnitId) {
      return res.status(400).json({
        success: false,
        error: 'Both reservations must specify new room unit IDs'
      });
    }

    if (!reservationA.newStartDate || !reservationA.newEndDate || 
        !reservationB.newStartDate || !reservationB.newEndDate) {
      return res.status(400).json({
        success: false,
        error: 'Both reservations must specify new start and end dates'
      });
    }

    const result = await calendarService.swapReservations(reservationA, reservationB);
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Reservations swapped successfully'
    });
  } catch (error) {
    console.error('Error swapping reservations:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to swap reservations',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar/allocate
 * Smart gap-fill allocation across multiple rooms
 */
router.post('/allocate', async (req, res) => {
  try {
    const {
      guestName,
      checkInDate,
      checkOutDate,
      roomUnitIds,
      allowSwaps = true,
      guestEmail,
      numGuests
    } = req.body;

    // Validate required fields
    if (!guestName || !checkInDate || !checkOutDate || !roomUnitIds || roomUnitIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Guest name, check-in date, check-out date, and room unit IDs are required'
      });
    }

    // Validate date range
    const startDate = new Date(checkInDate);
    const endDate = new Date(checkOutDate);
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    const reservationData = {
      guestName,
      guestEmail,
      checkInDate,
      checkOutDate,
      roomUnitIds,
      allowSwaps,
      numGuests
    };

    const result = await calendarService.allocateWithGapFill(reservationData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        data: result,
        message: result.message || 'Allocation completed successfully'
      });
    } else {
      res.status(409).json({
        success: false,
        error: result.error,
        data: {
          segments: result.segments,
          swaps: result.swaps
        }
      });
    }
  } catch (error) {
    console.error('Error in gap-fill allocation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to allocate reservation',
      details: error.message
    });
  }
});

/**
 * POST /api/calendar/swaps/apply
 * Apply room swaps (used after gap-fill allocation suggests swaps)
 * Body: { swaps: [{ reservation_id, from_room, to_room }] }
 */
router.post('/swaps/apply', async (req, res) => {
  try {
    const { swaps } = req.body;

    if (!swaps || !Array.isArray(swaps) || swaps.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Swaps array is required'
      });
    }

    const results = await calendarService.applyRoomSwaps(swaps);
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    res.status(200).json({
      success: true,
      data: results,
      message: `Applied ${successCount} swap(s) successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`
    });
  } catch (error) {
    console.error('Error applying room swaps:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to apply room swaps',
      details: error.message
    });
  }
});

/**
 * GET /api/calendar/conflicts
 * Check for conflicts in specific rooms and date range
 * Query params: roomUnitIds[], startDate, endDate, excludeReservationId?
 */
router.get('/conflicts', async (req, res) => {
  try {
    const { roomUnitIds, startDate, endDate, excludeReservationId } = req.query;

    if (!roomUnitIds || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Room unit IDs, start date, and end date are required'
      });
    }

    // Parse roomUnitIds (can be string or array)
    const roomIds = Array.isArray(roomUnitIds) ? roomUnitIds : [roomUnitIds];

    const conflicts = await calendarService.getConflicts(
      roomIds,
      startDate,
      endDate,
      excludeReservationId
    );
    
    res.status(200).json({
      success: true,
      data: conflicts,
      message: `Found ${conflicts.length} conflict(s)`
    });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check conflicts',
      details: error.message
    });
  }
});

/**
 * GET /api/calendar/availability
 * Check room availability for a specific date range
 * Query params: roomUnitId, startDate, endDate, excludeReservationId?
 */
router.get('/availability', async (req, res) => {
  try {
    const { roomUnitId, startDate, endDate, excludeReservationId } = req.query;

    if (!roomUnitId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Room unit ID, start date, and end date are required'
      });
    }

    const isAvailable = await calendarService.checkRoomAvailability(
      roomUnitId,
      startDate,
      endDate,
      excludeReservationId
    );
    
    res.status(200).json({
      success: true,
      data: {
        roomUnitId,
        startDate,
        endDate,
        isAvailable
      },
      message: isAvailable ? 'Room is available' : 'Room is not available'
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability',
      details: error.message
    });
  }
});

/**
 * DELETE /api/calendar/segment/:segmentId
 * Delete a reservation segment
 */
router.delete('/segment/:segmentId', async (req, res) => {
  try {
    const { segmentId } = req.params;

    if (!segmentId) {
      return res.status(400).json({
        success: false,
        error: 'Segment ID is required'
      });
    }

    const result = await calendarService.deleteReservationSegment(segmentId);
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Reservation segment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting reservation segment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete reservation segment',
      details: error.message
    });
  }
});

/**
 * GET /api/calendar/date-range
 * Get default calendar date range (yesterday + 29 days)
 */
router.get('/date-range', async (req, res) => {
  try {
    const dateRange = calendarService.getDefaultDateRange();
    
    res.status(200).json({
      success: true,
      data: dateRange,
      message: `Default date range: ${dateRange.totalDays} days`
    });
  } catch (error) {
    console.error('Error getting date range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get date range',
      details: error.message
    });
  }
});

module.exports = router;
