import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

/**
 * Custom hook for managing property translations
 * Provides translated property content based on current language
 * For guest usage (with token) or admin usage (with propertyId)
 */
export const usePropertyTranslations = (propertyIdOrToken, isGuestMode = false) => {
  const { i18n } = useTranslation();
  const [translations, setTranslations] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentLanguage = i18n.language;

  // Fetch property with translations
  const fetchPropertyWithTranslations = useCallback(async (language = currentLanguage) => {
    if (!propertyIdOrToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (isGuestMode) {
        // Use guest endpoint - token is the parameter
        response = await api.get(`/guest/${propertyIdOrToken}/property-translations`, {
          params: { language }
        });
        
        if (response.data.success) {
          // For guest mode, we only get translations, not full property data
          setTranslations(response.data.data.translations);
          setProperty(null); // Guest mode doesn't return full property data
        } else {
          throw new Error(response.data.message || 'Failed to fetch property translations');
        }
      } else {
        // Use admin endpoint - propertyId is the parameter
        response = await api.get(`/translations/properties/${propertyIdOrToken}/with-translations`, {
          params: { language }
        });
        
        if (response.data.success) {
          setProperty(response.data.data);
          setTranslations(response.data.data.translations);
        } else {
          throw new Error(response.data.message || 'Failed to fetch property translations');
        }
      }
    } catch (err) {
      console.error(`❌ [usePropertyTranslations] Error fetching translations:`, err);
      
      // More specific error handling
      if (err.response?.status === 404) {
        setError('Property or translations not found');
      } else if (err.response?.status === 400) {
        setError('Invalid request - check language code or token');
      } else if (err.response?.status === 500) {
        setError('Server error - please try again later');
      } else {
        setError(err.message || 'Failed to load property translations');
      }
      
      // Only reset on critical errors (404, 400), preserve on network errors
      if (err.response?.status === 404 || err.response?.status === 400) {
        setTranslations(null);
        setProperty(null);
      }
    } finally {
      setLoading(false);
    }
  }, [propertyIdOrToken, currentLanguage, isGuestMode]);

  // Fetch only translation data for a property
  const fetchTranslations = useCallback(async (language = currentLanguage) => {
    if (!propertyIdOrToken) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let response;
      
      if (isGuestMode) {
        // Use guest endpoint - token is the parameter
        response = await api.get(`/guest/${propertyIdOrToken}/property-translations`, {
          params: { language }
        });
        
        if (response.data.success) {
          setTranslations(response.data.data.translations);
        } else {
          throw new Error(response.data.message || 'Failed to fetch translations');
        }
      } else {
        // Use admin endpoint - propertyId is the parameter
        response = await api.get(`/translations/properties/${propertyIdOrToken}/translations`, {
          params: { language }
        });
        
        if (response.data.success) {
          const translationData = response.data.data.reduce((acc, translation) => {
            acc[translation.field_name] = translation.translated_text;
            return acc;
          }, {});

          setTranslations(translationData);
        } else {
          throw new Error(response.data.message || 'Failed to fetch translations');
        }
      }
    } catch (err) {
      console.error(`❌ [usePropertyTranslations] Error fetching translations only:`, err);
      
      // More specific error handling
      if (err.response?.status === 404) {
        setError('Property or translations not found');
      } else if (err.response?.status === 400) {
        setError('Invalid request - check language code or token');
      } else if (err.response?.status === 500) {
        setError('Server error - please try again later');
      } else {
        setError(err.message || 'Failed to load translations');
      }
      
      // Only reset on critical errors (404, 400), preserve on network errors
      if (err.response?.status === 404 || err.response?.status === 400) {
        setTranslations(null);
      }
    } finally {
      setLoading(false);
    }
  }, [propertyIdOrToken, currentLanguage, isGuestMode]);

  // Get translated text for a specific field with fallback
  const getTranslatedText = useCallback((fieldName, fallback = '') => {
    if (translations && translations[fieldName]) {
      return translations[fieldName];
    }
    
    // Fallback to original property field if available
    if (property && property[fieldName]) {
      return property[fieldName];
    }
    
    return fallback;
  }, [translations, property]);

  // Create or update a translation (admin mode only)
  const saveTranslation = useCallback(async (fieldName, languageCode, translatedText, options = {}) => {
    if (!propertyIdOrToken || isGuestMode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`/translations/properties/${propertyIdOrToken}/translations`, {
        fieldName,
        languageCode,
        translatedText,
        isAutoTranslated: options.isAutoTranslated || false,
        isApproved: options.isApproved || false
      });
      
      if (response.data.success) {
        // Refresh translations after saving
        await fetchTranslations();
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to save translation');
      }
    } catch (err) {
      console.error('Error saving translation:', err);
      setError(err.message || 'Failed to save translation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [propertyIdOrToken, isGuestMode, fetchTranslations]);

  // Batch save multiple translations (admin mode only)
  const batchSaveTranslations = useCallback(async (translations, options = {}) => {
    if (!propertyIdOrToken || isGuestMode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`/translations/properties/${propertyIdOrToken}/translations/batch`, {
        translations,
        isAutoTranslated: options.isAutoTranslated || false,
        isApproved: options.isApproved || false
      });
      
      if (response.data.success) {
        // Refresh translations after saving
        await fetchTranslations();
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to save translations');
      }
    } catch (err) {
      console.error('Error batch saving translations:', err);
      setError(err.message || 'Failed to save translations');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [propertyIdOrToken, isGuestMode, fetchTranslations]);

  // Delete a translation (admin mode only)
  const deleteTranslation = useCallback(async (fieldName, languageCode) => {
    if (!propertyIdOrToken || isGuestMode) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.delete(`/translations/properties/${propertyIdOrToken}/translations/${fieldName}/${languageCode}`);
      
      if (response.data.success) {
        // Refresh translations after deletion
        await fetchTranslations();
        return true;
      } else {
        throw new Error(response.data.message || 'Failed to delete translation');
      }
    } catch (err) {
      console.error('Error deleting translation:', err);
      setError(err.message || 'Failed to delete translation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [propertyIdOrToken, isGuestMode, fetchTranslations]);

  // Get translation statistics (admin mode only)
  const getTranslationStats = useCallback(async () => {
    if (!propertyIdOrToken || isGuestMode) return null;
    
    try {
      const response = await api.get(`/translations/properties/${propertyIdOrToken}/translation-stats`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch translation stats');
      }
    } catch (err) {
      console.error('Error fetching translation stats:', err);
      return null;
    }
  }, [propertyIdOrToken, isGuestMode]);

  // Memoized translated content object
  const translatedContent = useMemo(() => {
    if (!translations && !property) return null;
    
    return {
      houseRules: getTranslatedText('house_rules', ''),
      description: getTranslatedText('description', ''),
      luggageInfo: getTranslatedText('luggage_info', ''),
      checkInInstructions: getTranslatedText('check_in_instructions', '')
    };
  }, [translations, property, getTranslatedText]);

  // Auto-fetch translations when propertyIdOrToken or language changes
  useEffect(() => {
    if (propertyIdOrToken) {
      fetchPropertyWithTranslations();
    }
  }, [fetchPropertyWithTranslations]);

  // Return hook interface
  return {
    // Data
    property,
    translations,
    translatedContent,
    currentLanguage,
    
    // State
    loading,
    error,
    
    // Methods
    fetchPropertyWithTranslations,
    fetchTranslations,
    getTranslatedText,
    saveTranslation,
    batchSaveTranslations,
    deleteTranslation,
    getTranslationStats,
    
    // Utility
    hasTranslations: Boolean(translations && Object.keys(translations).length > 0),
    isTranslated: (fieldName) => Boolean(translations && translations[fieldName])
  };
};

/**
 * Hook for managing multiple properties with translations
 */
export const usePropertiesWithTranslations = () => {
  const { i18n } = useTranslation();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const currentLanguage = i18n.language;

  // Fetch multiple properties with translations
  const fetchPropertiesWithTranslations = useCallback(async (language = currentLanguage) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/translations/properties/with-translations', {
        params: { language }
      });
      
      if (response.data.success) {
        setProperties(response.data.data);
      } else {
        throw new Error(response.data.message || 'Failed to fetch properties with translations');
      }
    } catch (err) {
      console.error('Error fetching properties with translations:', err);
      setError(err.message || 'Failed to load properties with translations');
    } finally {
      setLoading(false);
    }
  }, [currentLanguage]);

  // Auto-fetch when language changes
  useEffect(() => {
    fetchPropertiesWithTranslations();
  }, [fetchPropertiesWithTranslations]);

  return {
    // Data
    properties,
    currentLanguage,
    
    // State
    loading,
    error,
    
    // Methods
    fetchPropertiesWithTranslations,
    refreshProperties: fetchPropertiesWithTranslations
  };
};

/**
 * Hook for translation management (admin interface)
 */
export const useTranslationManagement = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get translation configuration
  const getTranslationConfig = useCallback(async () => {
    try {
      const response = await api.get('/translations/config');
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch translation config');
      }
    } catch (err) {
      console.error('Error fetching translation config:', err);
      return null;
    }
  }, []);

  // Get properties needing translation
  const getPropertiesNeedingTranslation = useCallback(async (language = 'ja', limit = 10) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/translations/properties/needing-translation', {
        params: { language, limit }
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to fetch properties needing translation');
      }
    } catch (err) {
      console.error('Error fetching properties needing translation:', err);
      setError(err.message || 'Failed to load properties needing translation');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Search translations
  const searchTranslations = useCallback(async (searchTerm, language = null, limit = 50) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/translations/search', {
        params: { q: searchTerm, language, limit }
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to search translations');
      }
    } catch (err) {
      console.error('Error searching translations:', err);
      setError(err.message || 'Failed to search translations');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Update translation approval
  const updateTranslationApproval = useCallback(async (translationId, isApproved) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.patch(`/translations/${translationId}/approval`, {
        isApproved
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.message || 'Failed to update translation approval');
      }
    } catch (err) {
      console.error('Error updating translation approval:', err);
      setError(err.message || 'Failed to update translation approval');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    loading,
    error,
    
    // Methods
    getTranslationConfig,
    getPropertiesNeedingTranslation,
    searchTranslations,
    updateTranslationApproval
  };
};

export default usePropertyTranslations;
