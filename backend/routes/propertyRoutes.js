const express = require('express');
const router = express.Router();
const propertyService = require('../services/propertyService');
const { adminAuth } = require('../middleware/auth');

// Get all properties
router.get('/', adminAuth, async (req, res) => {
  try {
    const { withStats } = req.query;
    const userProfile = req.userProfile;

    let properties;
    if (withStats === 'true') {
      properties = await propertyService.getPropertiesWithStats(userProfile);
    } else {
      properties = await propertyService.getAllProperties(userProfile);
    }

    res.status(200).json({
      message: 'Properties retrieved successfully',
      properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get specific property by ID
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await propertyService.getPropertyById(id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.status(200).json({
      message: 'Property retrieved successfully',
      property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// Create new property
router.post('/', adminAuth, async (req, res) => {
  try {
    const {
      name,
      address,
      ownerId,
      description,
      propertyType,
      wifiName,
      wifiPassword,
      houseRules,
      checkInInstructions,
      emergencyContact,
      propertyAmenities,
      locationInfo,
      accessTime,
      defaultCleanerId
    } = req.body;

    if (!name || !address) {
      return res.status(400).json({ error: 'Name and address are required' });
    }

    const propertyData = {
      name,
      address,
      ownerId: ownerId || 'c339d395-9910-44cd-ae8a-362e153c35de',
      description,
      propertyType,
      wifiName,
      wifiPassword,
      houseRules,
      checkInInstructions,
      emergencyContact,
      propertyAmenities,
      locationInfo,
      accessTime,
      defaultCleanerId
    };

    const property = await propertyService.createProperty(propertyData);

    res.status(201).json({
      message: 'Property created successfully',
      property
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
});

// Update property
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const property = await propertyService.updateProperty(id, updateData);

    res.status(200).json({
      message: 'Property updated successfully',
      property
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

// Delete property
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const property = await propertyService.deleteProperty(id);

    res.status(200).json({
      message: 'Property deleted successfully',
      property
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

module.exports = router;