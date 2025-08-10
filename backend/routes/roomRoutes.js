const express = require('express');
const router = express.Router();
const roomService = require('../services/roomService');
const { adminAuth } = require('../middleware/auth');

// Get all room types for a property
router.get('/properties/:propertyId/room-types', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { withUnits } = req.query;

    let roomTypes;
    if (withUnits === 'true') {
      roomTypes = await roomService.getRoomTypesWithUnits(propertyId);
    } else {
      roomTypes = await roomService.getRoomTypesByProperty(propertyId);
    }

    res.status(200).json({
      message: 'Room types retrieved successfully',
      roomTypes
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({ error: 'Failed to fetch room types' });
  }
});

// Create room type for a property
router.post('/properties/:propertyId/room-types', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      name,
      description,
      maxGuests,
      roomSizeSqm,
      bedConfiguration,
      hasBalcony,
      hasKitchen,
      isAccessible
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Room type name is required' });
    }

    const roomTypeData = {
      name,
      description,
      maxGuests,
      roomSizeSqm,
      bedConfiguration,
      hasBalcony,
      hasKitchen,
      isAccessible
    };

    const roomType = await roomService.createRoomType(propertyId, roomTypeData);

    res.status(201).json({
      message: 'Room type created successfully',
      roomType
    });
  } catch (error) {
    console.error('Error creating room type:', error);
    res.status(500).json({ error: 'Failed to create room type' });
  }
});

// Update room type
router.put('/room-types/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const roomType = await roomService.updateRoomType(id, updateData);

    res.status(200).json({
      message: 'Room type updated successfully',
      roomType
    });
  } catch (error) {
    console.error('Error updating room type:', error);
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

// Delete room type
router.delete('/room-types/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const roomType = await roomService.deleteRoomType(id);

    res.status(200).json({
      message: 'Room type deleted successfully',
      roomType
    });
  } catch (error) {
    console.error('Error deleting room type:', error);
    res.status(500).json({ error: 'Failed to delete room type' });
  }
});

// Get room units for a room type
router.get('/room-types/:roomTypeId/room-units', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const roomUnits = await roomService.getRoomUnitsByRoomType(roomTypeId);

    res.status(200).json({
      message: 'Room units retrieved successfully',
      roomUnits
    });
  } catch (error) {
    console.error('Error fetching room units:', error);
    res.status(500).json({ error: 'Failed to fetch room units' });
  }
});

// Create room unit for a room type
router.post('/room-types/:roomTypeId/room-units', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const {
      unitNumber,
      floorNumber,
      accessCode,
      accessInstructions
    } = req.body;

    if (!unitNumber) {
      return res.status(400).json({ error: 'Unit number is required' });
    }

    const roomUnitData = {
      unitNumber,
      floorNumber,
      accessCode,
      accessInstructions
    };

    const roomUnit = await roomService.createRoomUnit(roomTypeId, roomUnitData);

    res.status(201).json({
      message: 'Room unit created successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error creating room unit:', error);
    res.status(500).json({ error: 'Failed to create room unit' });
  }
});

// Update room unit
router.put('/room-units/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const roomUnit = await roomService.updateRoomUnit(id, updateData);

    res.status(200).json({
      message: 'Room unit updated successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error updating room unit:', error);
    res.status(500).json({ error: 'Failed to update room unit' });
  }
});

// Delete room unit
router.delete('/room-units/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const roomUnit = await roomService.deleteRoomUnit(id);

    res.status(200).json({
      message: 'Room unit deleted successfully',
      roomUnit
    });
  } catch (error) {
    console.error('Error deleting room unit:', error);
    res.status(500).json({ error: 'Failed to delete room unit' });
  }
});

// Legacy room management routes
router.post('/properties/:propertyId/rooms', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      roomNumber,
      roomName,
      roomType,
      maxGuests,
      accessCode,
      accessInstructions,
      roomAmenities,
      roomSizeSqm,
      bedConfiguration,
      floorNumber,
      wifiName,
      wifiPassword,
      hasBalcony,
      hasKitchen,
      isAccessible
    } = req.body;

    if (!roomNumber) {
      return res.status(400).json({ error: 'Room number is required' });
    }

    const roomData = {
      roomNumber,
      roomName,
      roomType,
      maxGuests,
      accessCode,
      accessInstructions,
      roomAmenities,
      roomSizeSqm,
      bedConfiguration,
      floorNumber,
      wifiName,
      wifiPassword,
      hasBalcony,
      hasKitchen,
      isAccessible
    };

    const room = await roomService.createRoom(propertyId, roomData);

    res.status(201).json({
      message: 'Room created successfully',
      room
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.put('/rooms/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const room = await roomService.updateRoom(id, updateData);

    res.status(200).json({
      message: 'Room updated successfully',
      room
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

router.delete('/rooms/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const room = await roomService.deleteRoom(id);

    res.status(200).json({
      message: 'Room deleted successfully',
      room
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;