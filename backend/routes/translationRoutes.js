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
        translatableFields: translationService.constructor.TRANSLATABLE_FIELDS
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

module.exports = router;
