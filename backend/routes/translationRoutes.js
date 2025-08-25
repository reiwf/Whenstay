const express = require('express');
const router = express.Router();
const translationService = require('../services/translationService');
const propertyService = require('../services/propertyService');
const { adminAuth } = require('../middleware/auth');

// Get all translations for a property
router.get('/properties/:propertyId/translations', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { language } = req.query;

    const translations = await translationService.getPropertyTranslations(propertyId, language);
    
    res.json({
      success: true,
      data: translations
    });
  } catch (error) {
    console.error('Error fetching property translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property translations',
      error: error.message
    });
  }
});

// Get property with translations in specific language
router.get('/properties/:propertyId/with-translations', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { language = 'en' } = req.query;

    const property = await propertyService.getPropertyWithTranslations(propertyId, language);
    
    res.json({
      success: true,
      data: property
    });
  } catch (error) {
    console.error('Error fetching property with translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property with translations',
      error: error.message
    });
  }
});

// Get multiple properties with translations
router.get('/properties/with-translations', adminAuth, async (req, res) => {
  try {
    const { language = 'en' } = req.query;
    const userProfile = req.user;

    const properties = await propertyService.getPropertiesWithTranslations(language, userProfile);
    
    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching properties with translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties with translations',
      error: error.message
    });
  }
});

// Get translated text for a specific field
router.get('/properties/:propertyId/translations/:fieldName/:language', adminAuth, async (req, res) => {
  try {
    const { propertyId, fieldName, language } = req.params;

    const translatedText = await translationService.getTranslatedText(propertyId, fieldName, language);
    
    res.json({
      success: true,
      data: {
        propertyId,
        fieldName,
        language,
        translatedText
      }
    });
  } catch (error) {
    console.error('Error fetching translated text:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translated text',
      error: error.message
    });
  }
});

// Create or update a translation
router.post('/properties/:propertyId/translations', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { fieldName, languageCode, translatedText, isAutoTranslated, isApproved } = req.body;
    const createdBy = req.user?.id;

    // Validate required fields
    if (!fieldName || !languageCode || !translatedText) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fieldName, languageCode, and translatedText'
      });
    }

    const options = {
      isAutoTranslated: isAutoTranslated || false,
      createdBy,
      isApproved: isApproved || false
    };

    const translation = await translationService.upsertTranslation(
      propertyId,
      fieldName,
      languageCode,
      translatedText,
      options
    );
    
    res.json({
      success: true,
      data: translation,
      message: 'Translation saved successfully'
    });
  } catch (error) {
    console.error('Error creating/updating translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save translation',
      error: error.message
    });
  }
});

// Batch create/update translations
router.post('/properties/:propertyId/translations/batch', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { translations, isAutoTranslated, isApproved } = req.body;
    const createdBy = req.user?.id;

    // Validate required fields
    if (!translations || typeof translations !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid translations object'
      });
    }

    const options = {
      isAutoTranslated: isAutoTranslated || false,
      createdBy,
      isApproved: isApproved || false
    };

    const results = await translationService.batchUpsertTranslations(
      propertyId,
      translations,
      options
    );
    
    res.json({
      success: true,
      data: results,
      message: `${results.length} translations saved successfully`
    });
  } catch (error) {
    console.error('Error batch creating/updating translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save translations',
      error: error.message
    });
  }
});

// Update translation approval status
router.patch('/translations/:translationId/approval', adminAuth, async (req, res) => {
  try {
    const { translationId } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isApproved must be a boolean value'
      });
    }

    const translation = await translationService.updateTranslationApproval(translationId, isApproved);
    
    res.json({
      success: true,
      data: translation,
      message: `Translation ${isApproved ? 'approved' : 'unapproved'} successfully`
    });
  } catch (error) {
    console.error('Error updating translation approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update translation approval',
      error: error.message
    });
  }
});

// Delete a specific translation
router.delete('/properties/:propertyId/translations/:fieldName/:language', adminAuth, async (req, res) => {
  try {
    const { propertyId, fieldName, language } = req.params;

    const success = await translationService.deleteTranslation(propertyId, fieldName, language);
    
    if (success) {
      res.json({
        success: true,
        message: 'Translation deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Translation not found'
      });
    }
  } catch (error) {
    console.error('Error deleting translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete translation',
      error: error.message
    });
  }
});

// Delete all translations for a property
router.delete('/properties/:propertyId/translations', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const success = await translationService.deletePropertyTranslations(propertyId);
    
    if (success) {
      res.json({
        success: true,
        message: 'All property translations deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Property not found or no translations to delete'
      });
    }
  } catch (error) {
    console.error('Error deleting property translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete property translations',
      error: error.message
    });
  }
});

// Get translation statistics for a property
router.get('/properties/:propertyId/translation-stats', adminAuth, async (req, res) => {
  try {
    const { propertyId } = req.params;

    const stats = await translationService.getTranslationStats(propertyId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching translation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translation stats',
      error: error.message
    });
  }
});

// Get properties that need translations
router.get('/properties/needing-translation', adminAuth, async (req, res) => {
  try {
    const { language = 'ja', limit = 10 } = req.query;

    const properties = await translationService.getPropertiesNeedingTranslation(language, parseInt(limit));
    
    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching properties needing translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties needing translation',
      error: error.message
    });
  }
});

// Search translations
router.get('/translations/search', adminAuth, async (req, res) => {
  try {
    const { q: searchTerm, language, limit = 50 } = req.query;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term (q) is required'
      });
    }

    const results = await translationService.searchTranslations(searchTerm, language, parseInt(limit));
    
    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search translations',
      error: error.message
    });
  }
});

// Get supported languages and translatable fields (for frontend reference)
router.get('/config', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        supportedLanguages: translationService.constructor.SUPPORTED_LANGUAGES,
        translatableFields: translationService.constructor.TRANSLATABLE_FIELDS,
        roomTypeTranslatableFields: translationService.constructor.ROOM_TYPE_TRANSLATABLE_FIELDS
      }
    });
  } catch (error) {
    console.error('Error fetching translation config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translation config',
      error: error.message
    });
  }
});

// ===== ROOM TYPE TRANSLATION ROUTES =====

// Get all translations for a room type
router.get('/room-types/:roomTypeId/translations', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { language } = req.query;

    const translations = await translationService.getRoomTypeTranslations(roomTypeId, language);
    
    res.json({
      success: true,
      data: translations
    });
  } catch (error) {
    console.error('Error fetching room type translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room type translations',
      error: error.message
    });
  }
});

// Get translated text for a specific room type field
router.get('/room-types/:roomTypeId/translations/:fieldName/:language', adminAuth, async (req, res) => {
  try {
    const { roomTypeId, fieldName, language } = req.params;

    const translatedText = await translationService.getRoomTypeTranslatedText(roomTypeId, fieldName, language);
    
    res.json({
      success: true,
      data: {
        roomTypeId,
        fieldName,
        language,
        translatedText
      }
    });
  } catch (error) {
    console.error('Error fetching room type translated text:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room type translated text',
      error: error.message
    });
  }
});

// Get all translated fields for a room type in specific language
router.get('/room-types/:roomTypeId/translated-fields', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { language = 'en' } = req.query;

    const translatedFields = await translationService.getRoomTypeTranslatedFields(roomTypeId, language);
    
    res.json({
      success: true,
      data: {
        roomTypeId,
        language,
        fields: translatedFields
      }
    });
  } catch (error) {
    console.error('Error fetching room type translated fields:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room type translated fields',
      error: error.message
    });
  }
});

// Create or update a room type translation
router.post('/room-types/:roomTypeId/translations', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { fieldName, languageCode, translatedText, isAutoTranslated, isApproved } = req.body;
    const createdBy = req.user?.id;

    // Validate required fields
    if (!fieldName || !languageCode || !translatedText) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: fieldName, languageCode, and translatedText'
      });
    }

    const options = {
      isAutoTranslated: isAutoTranslated || false,
      createdBy,
      isApproved: isApproved || false
    };

    const translation = await translationService.upsertRoomTypeTranslation(
      roomTypeId,
      fieldName,
      languageCode,
      translatedText,
      options
    );
    
    res.json({
      success: true,
      data: translation,
      message: 'Room type translation saved successfully'
    });
  } catch (error) {
    console.error('Error creating/updating room type translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save room type translation',
      error: error.message
    });
  }
});

// Batch create/update room type translations
router.post('/room-types/:roomTypeId/translations/batch', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { translations, isAutoTranslated, isApproved } = req.body;
    const createdBy = req.user?.id;

    // Validate required fields
    if (!translations || typeof translations !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid translations object'
      });
    }

    const options = {
      isAutoTranslated: isAutoTranslated || false,
      createdBy,
      isApproved: isApproved || false
    };

    const results = await translationService.batchUpsertRoomTypeTranslations(
      roomTypeId,
      translations,
      options
    );
    
    res.json({
      success: true,
      data: results,
      message: `${results.length} room type translations saved successfully`
    });
  } catch (error) {
    console.error('Error batch creating/updating room type translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save room type translations',
      error: error.message
    });
  }
});

// Update room type translation approval status
router.patch('/room-type-translations/:translationId/approval', adminAuth, async (req, res) => {
  try {
    const { translationId } = req.params;
    const { isApproved } = req.body;

    if (typeof isApproved !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isApproved must be a boolean value'
      });
    }

    const translation = await translationService.updateRoomTypeTranslationApproval(translationId, isApproved);
    
    res.json({
      success: true,
      data: translation,
      message: `Room type translation ${isApproved ? 'approved' : 'unapproved'} successfully`
    });
  } catch (error) {
    console.error('Error updating room type translation approval:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update room type translation approval',
      error: error.message
    });
  }
});

// Delete a specific room type translation
router.delete('/room-types/:roomTypeId/translations/:fieldName/:language', adminAuth, async (req, res) => {
  try {
    const { roomTypeId, fieldName, language } = req.params;

    const success = await translationService.deleteRoomTypeTranslation(roomTypeId, fieldName, language);
    
    if (success) {
      res.json({
        success: true,
        message: 'Room type translation deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Room type translation not found'
      });
    }
  } catch (error) {
    console.error('Error deleting room type translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete room type translation',
      error: error.message
    });
  }
});

// Delete all translations for a room type
router.delete('/room-types/:roomTypeId/translations', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;

    const success = await translationService.deleteRoomTypeTranslations(roomTypeId);
    
    if (success) {
      res.json({
        success: true,
        message: 'All room type translations deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Room type not found or no translations to delete'
      });
    }
  } catch (error) {
    console.error('Error deleting room type translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete room type translations',
      error: error.message
    });
  }
});

// Get translation statistics for a room type
router.get('/room-types/:roomTypeId/translation-stats', adminAuth, async (req, res) => {
  try {
    const { roomTypeId } = req.params;

    const stats = await translationService.getRoomTypeTranslationStats(roomTypeId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching room type translation stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room type translation stats',
      error: error.message
    });
  }
});

// Get room types that need translations
router.get('/room-types/needing-translation', adminAuth, async (req, res) => {
  try {
    const { language = 'ja', limit = 10 } = req.query;

    const roomTypes = await translationService.getRoomTypesNeedingTranslation(language, parseInt(limit));
    
    res.json({
      success: true,
      data: roomTypes
    });
  } catch (error) {
    console.error('Error fetching room types needing translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room types needing translation',
      error: error.message
    });
  }
});

// Search room type translations
router.get('/room-type-translations/search', adminAuth, async (req, res) => {
  try {
    const { q: searchTerm, language, limit = 50 } = req.query;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: 'Search term (q) is required'
      });
    }

    const results = await translationService.searchRoomTypeTranslations(searchTerm, language, parseInt(limit));
    
    res.json({
      success: true,
      data: results,
      total: results.length
    });
  } catch (error) {
    console.error('Error searching room type translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search room type translations',
      error: error.message
    });
  }
});

module.exports = router;
