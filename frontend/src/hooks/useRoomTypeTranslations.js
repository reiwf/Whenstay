import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const useRoomTypeTranslations = (guestToken = null, isGuestMode = false) => {
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [config, setConfig] = useState({
    supportedLanguages: [],
    roomTypeTranslatableFields: []
  });

  // Fetch translation configuration
  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/translations/config');
      const result = await response.json();
      
      if (result.success) {
        setConfig({
          supportedLanguages: result.data.supportedLanguages || [],
          roomTypeTranslatableFields: result.data.roomTypeTranslatableFields || []
        });
      }
    } catch (err) {
      console.error('Error fetching translation config:', err);
    }
  }, []);

  // Load configuration on hook initialization
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Get all translations for a room type
  const getRoomTypeTranslations = useCallback(async (roomTypeId, language = null) => {
    if (!roomTypeId) return [];

    setLoading(true);
    setError(null);

    try {
      const url = `/api/translations/room-types/${roomTypeId}/translations${language ? `?language=${language}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to fetch room type translations');
      }
    } catch (err) {
      console.error('Error fetching room type translations:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Get translated fields for a room type in specific language
  const getRoomTypeTranslatedFields = useCallback(async (roomTypeId, language = 'en') => {
    if (!roomTypeId) return {};

    setLoading(true);
    setError(null);

    try {
      let response;
      
      if (isGuestMode && guestToken) {
        // Use guest endpoint with token authentication
        response = await api.get(`/guest/${guestToken}/room-type-translations/${roomTypeId}`, {
          params: { language }
        });
        
        if (response.data.success) {
          return response.data.data.fields || {};
        } else {
          throw new Error(response.data.message || 'Failed to fetch room type translated fields');
        }
      } else {
        // Use admin endpoint with regular authentication
        const fetchResponse = await fetch(`/api/translations/room-types/${roomTypeId}/translated-fields?language=${language}`);
        const result = await fetchResponse.json();

        if (result.success) {
          return result.data.fields || {};
        } else {
          throw new Error(result.message || 'Failed to fetch room type translated fields');
        }
      }
    } catch (err) {
      console.error('Error fetching room type translated fields:', err);
      setError(err.message);
      return {};
    } finally {
      setLoading(false);
    }
  }, [isGuestMode, guestToken]);

  // Get translated text for a specific field
  const getRoomTypeTranslatedText = useCallback(async (roomTypeId, fieldName, language) => {
    if (!roomTypeId || !fieldName || !language) return '';

    try {
      const response = await fetch(`/api/translations/room-types/${roomTypeId}/translations/${fieldName}/${language}`);
      const result = await response.json();

      if (result.success) {
        return result.data.translatedText;
      } else {
        throw new Error(result.message || 'Failed to fetch translated text');
      }
    } catch (err) {
      console.error('Error fetching room type translated text:', err);
      return '';
    }
  }, []);

  // Create or update a translation
  const upsertRoomTypeTranslation = useCallback(async (roomTypeId, fieldName, languageCode, translatedText, options = {}) => {
    if (!roomTypeId || !fieldName || !languageCode || !translatedText) {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/translations/room-types/${roomTypeId}/translations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fieldName,
          languageCode,
          translatedText,
          isAutoTranslated: options.isAutoTranslated || false,
          isApproved: options.isApproved || false
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update local cache
        const cacheKey = `${roomTypeId}_${languageCode}`;
        setTranslations(prev => ({
          ...prev,
          [cacheKey]: {
            ...prev[cacheKey],
            [fieldName]: translatedText
          }
        }));

        return result.data;
      } else {
        throw new Error(result.message || 'Failed to save room type translation');
      }
    } catch (err) {
      console.error('Error saving room type translation:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Batch create/update translations
  const batchUpsertRoomTypeTranslations = useCallback(async (roomTypeId, translations, options = {}) => {
    if (!roomTypeId || !translations) {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/translations/room-types/${roomTypeId}/translations/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          translations,
          isAutoTranslated: options.isAutoTranslated || false,
          isApproved: options.isApproved || false
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update local cache for all languages
        Object.entries(translations).forEach(([fieldName, languageTranslations]) => {
          Object.entries(languageTranslations).forEach(([languageCode, translatedText]) => {
            const cacheKey = `${roomTypeId}_${languageCode}`;
            setTranslations(prev => ({
              ...prev,
              [cacheKey]: {
                ...prev[cacheKey],
                [fieldName]: translatedText
              }
            }));
          });
        });

        return result.data;
      } else {
        throw new Error(result.message || 'Failed to save room type translations');
      }
    } catch (err) {
      console.error('Error batch saving room type translations:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a translation
  const deleteRoomTypeTranslation = useCallback(async (roomTypeId, fieldName, language) => {
    if (!roomTypeId || !fieldName || !language) {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/translations/room-types/${roomTypeId}/translations/${fieldName}/${language}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        // Update local cache
        const cacheKey = `${roomTypeId}_${language}`;
        setTranslations(prev => {
          if (prev[cacheKey]) {
            const updated = { ...prev[cacheKey] };
            delete updated[fieldName];
            return {
              ...prev,
              [cacheKey]: updated
            };
          }
          return prev;
        });

        return true;
      } else {
        throw new Error(result.message || 'Failed to delete room type translation');
      }
    } catch (err) {
      console.error('Error deleting room type translation:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get translation statistics
  const getRoomTypeTranslationStats = useCallback(async (roomTypeId) => {
    if (!roomTypeId) return null;

    try {
      const response = await fetch(`/api/translations/room-types/${roomTypeId}/translation-stats`);
      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to fetch translation stats');
      }
    } catch (err) {
      console.error('Error fetching room type translation stats:', err);
      return null;
    }
  }, []);

  // Get room types needing translation
  const getRoomTypesNeedingTranslation = useCallback(async (language = 'ja', limit = 10) => {
    try {
      const response = await fetch(`/api/translations/room-types/needing-translation?language=${language}&limit=${limit}`);
      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to fetch room types needing translation');
      }
    } catch (err) {
      console.error('Error fetching room types needing translation:', err);
      return [];
    }
  }, []);

  // Search room type translations
  const searchRoomTypeTranslations = useCallback(async (searchTerm, language = null, limit = 50) => {
    if (!searchTerm) return [];

    try {
      const url = `/api/translations/room-type-translations/search?q=${encodeURIComponent(searchTerm)}${language ? `&language=${language}` : ''}&limit=${limit}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to search room type translations');
      }
    } catch (err) {
      console.error('Error searching room type translations:', err);
      return [];
    }
  }, []);

  // Cached translation getter
  const getCachedTranslation = useCallback((roomTypeId, language, fieldName) => {
    const cacheKey = `${roomTypeId}_${language}`;
    return translations[cacheKey]?.[fieldName] || null;
  }, [translations]);

  // Load and cache translations for a room type
  const loadRoomTypeTranslations = useCallback(async (roomTypeId, language) => {
    const cacheKey = `${roomTypeId}_${language}`;
    
    if (translations[cacheKey]) {
      return translations[cacheKey];
    }

    try {
      const fields = await getRoomTypeTranslatedFields(roomTypeId, language);
      setTranslations(prev => ({
        ...prev,
        [cacheKey]: fields
      }));
      return fields;
    } catch (err) {
      console.error('Error loading room type translations:', err);
      return {};
    }
  }, [translations, getRoomTypeTranslatedFields]);

  // Clear cache
  const clearCache = useCallback(() => {
    setTranslations({});
  }, []);

  // Update translation approval
  const updateRoomTypeTranslationApproval = useCallback(async (translationId, isApproved) => {
    if (!translationId || typeof isApproved !== 'boolean') {
      throw new Error('Missing required parameters');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/translations/room-type-translations/${translationId}/approval`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isApproved
        })
      });

      const result = await response.json();

      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to update translation approval');
      }
    } catch (err) {
      console.error('Error updating room type translation approval:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // Data
    translations,
    loading,
    error,
    config,

    // Methods
    getRoomTypeTranslations,
    getRoomTypeTranslatedFields,
    getRoomTypeTranslatedText,
    upsertRoomTypeTranslation,
    batchUpsertRoomTypeTranslations,
    deleteRoomTypeTranslation,
    getRoomTypeTranslationStats,
    getRoomTypesNeedingTranslation,
    searchRoomTypeTranslations,
    updateRoomTypeTranslationApproval,

    // Cache utilities
    getCachedTranslation,
    loadRoomTypeTranslations,
    clearCache,

    // Configuration
    fetchConfig
  };
};

export default useRoomTypeTranslations;
