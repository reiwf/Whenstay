const { supabaseAdmin } = require('../config/supabase');

class TranslationService {
  
  // Supported languages from your i18n config
  static SUPPORTED_LANGUAGES = ['en', 'ja', 'ko', 'zh-CN', 'zh-TW'];
  
  // Translatable fields from properties table
  static TRANSLATABLE_FIELDS = [
    'house_rules',
    'description', 
    'luggage_info',
    'check_in_instructions'
  ];

  // Translatable fields from room_types table
  static ROOM_TYPE_TRANSLATABLE_FIELDS = [
    'name',
    'description',
    'bed_configuration'
  ];

  /**
   * Get all translations for a specific property
   * @param {string} propertyId - Property UUID
   * @param {string} languageCode - Optional language filter
   * @returns {Promise<Array>} Array of translation objects
   */
  async getPropertyTranslations(propertyId, languageCode = null) {
    try {
      let query = supabaseAdmin
        .from('property_translations')
        .select(`
          id,
          property_id,
          field_name,
          language_code,
          translated_text,
          is_auto_translated,
          is_approved,
          created_at,
          updated_at
        `)
        .eq('property_id', propertyId)
        .order('field_name')
        .order('language_code');

      if (languageCode) {
        query = query.eq('language_code', languageCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching property translations:', error);
        throw new Error('Failed to fetch property translations');
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching property translations:', error);
      throw error;
    }
  }

  /**
   * Get translated text for a specific field with fallback logic
   * @param {string} propertyId - Property UUID
   * @param {string} fieldName - Field to translate
   * @param {string} languageCode - Target language
   * @returns {Promise<string>} Translated text or fallback
   */
  async getTranslatedText(propertyId, fieldName, languageCode = 'en') {
    try {
      // Use the database function for fallback logic
      const { data, error } = await supabaseAdmin
        .rpc('get_translated_text', {
          p_property_id: propertyId,
          p_field_name: fieldName,
          p_language_code: languageCode
        });

      if (error) {
        console.error('Error getting translated text:', error);
        throw new Error('Failed to get translated text');
      }

      return data || '';
    } catch (error) {
      console.error('Database error getting translated text:', error);
      throw error;
    }
  }

  /**
   * Get all translated fields for a property in a specific language
   * @param {string} propertyId - Property UUID
   * @param {string} languageCode - Target language
   * @returns {Promise<Object>} Object with translated fields
   */
  async getPropertyTranslatedFields(propertyId, languageCode = 'en') {
    try {
      const translations = await this.getPropertyTranslations(propertyId, languageCode);
      const translatedFields = {};

      // Get translations for each field
      for (const fieldName of TranslationService.TRANSLATABLE_FIELDS) {
        const translation = translations.find(t => t.field_name === fieldName);
        if (translation) {
          translatedFields[fieldName] = translation.translated_text;
        } else {
          // Fallback to get_translated_text function
          translatedFields[fieldName] = await this.getTranslatedText(
            propertyId, 
            fieldName, 
            languageCode
          );
        }
      }

      return translatedFields;
    } catch (error) {
      console.error('Database error getting property translated fields:', error);
      throw error;
    }
  }

  /**
   * Create or update a translation
   * @param {string} propertyId - Property UUID
   * @param {string} fieldName - Field name
   * @param {string} languageCode - Language code
   * @param {string} translatedText - Translated content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created/updated translation
   */
  async upsertTranslation(propertyId, fieldName, languageCode, translatedText, options = {}) {
    try {
      const {
        isAutoTranslated = false,
        createdBy = null,
        isApproved = false
      } = options;

      // Validate inputs
      if (!TranslationService.SUPPORTED_LANGUAGES.includes(languageCode)) {
        throw new Error(`Unsupported language: ${languageCode}`);
      }

      if (!TranslationService.TRANSLATABLE_FIELDS.includes(fieldName)) {
        throw new Error(`Field not translatable: ${fieldName}`);
      }

      // Use the database function for upsert
      const { data, error } = await supabaseAdmin
        .rpc('upsert_property_translation', {
          p_property_id: propertyId,
          p_field_name: fieldName,
          p_language_code: languageCode,
          p_translated_text: translatedText,
          p_is_auto_translated: isAutoTranslated,
          p_created_by: createdBy
        });

      if (error) {
        console.error('Error upserting translation:', error);
        throw new Error('Failed to upsert translation');
      }

      // Get the full translation record
      const { data: translation, error: fetchError } = await supabaseAdmin
        .from('property_translations')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        console.error('Error fetching upserted translation:', fetchError);
        throw new Error('Failed to fetch upserted translation');
      }

      return translation;
    } catch (error) {
      console.error('Database error upserting translation:', error);
      throw error;
    }
  }

  /**
   * Create translations for multiple fields and languages
   * @param {string} propertyId - Property UUID
   * @param {Object} translations - Object with structure: { fieldName: { languageCode: text } }
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of created translations
   */
  async batchUpsertTranslations(propertyId, translations, options = {}) {
    try {
      const results = [];

      for (const [fieldName, languageTranslations] of Object.entries(translations)) {
        for (const [languageCode, translatedText] of Object.entries(languageTranslations)) {
          if (translatedText && translatedText.trim() !== '') {
            const translation = await this.upsertTranslation(
              propertyId,
              fieldName,
              languageCode,
              translatedText,
              options
            );
            results.push(translation);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch upsert translations:', error);
      throw error;
    }
  }

  /**
   * Delete a specific translation
   * @param {string} propertyId - Property UUID
   * @param {string} fieldName - Field name
   * @param {string} languageCode - Language code
   * @returns {Promise<boolean>} Success status
   */
  async deleteTranslation(propertyId, fieldName, languageCode) {
    try {
      const { error } = await supabaseAdmin
        .from('property_translations')
        .delete()
        .eq('property_id', propertyId)
        .eq('field_name', fieldName)
        .eq('language_code', languageCode);

      if (error) {
        console.error('Error deleting translation:', error);
        throw new Error('Failed to delete translation');
      }

      return true;
    } catch (error) {
      console.error('Database error deleting translation:', error);
      throw error;
    }
  }

  /**
   * Delete all translations for a property
   * @param {string} propertyId - Property UUID
   * @returns {Promise<boolean>} Success status
   */
  async deletePropertyTranslations(propertyId) {
    try {
      const { error } = await supabaseAdmin
        .from('property_translations')
        .delete()
        .eq('property_id', propertyId);

      if (error) {
        console.error('Error deleting property translations:', error);
        throw new Error('Failed to delete property translations');
      }

      return true;
    } catch (error) {
      console.error('Database error deleting property translations:', error);
      throw error;
    }
  }

  /**
   * Get translation statistics for a property
   * @param {string} propertyId - Property UUID
   * @returns {Promise<Object>} Translation statistics
   */
  async getTranslationStats(propertyId) {
    try {
      const translations = await this.getPropertyTranslations(propertyId);
      
      const stats = {
        totalTranslations: translations.length,
        byLanguage: {},
        byField: {},
        completionRate: {},
        autoTranslated: translations.filter(t => t.is_auto_translated).length,
        approved: translations.filter(t => t.is_approved).length
      };

      // Count by language
      for (const lang of TranslationService.SUPPORTED_LANGUAGES) {
        const langTranslations = translations.filter(t => t.language_code === lang);
        stats.byLanguage[lang] = langTranslations.length;
        stats.completionRate[lang] = (langTranslations.length / TranslationService.TRANSLATABLE_FIELDS.length) * 100;
      }

      // Count by field
      for (const field of TranslationService.TRANSLATABLE_FIELDS) {
        stats.byField[field] = translations.filter(t => t.field_name === field).length;
      }

      return stats;
    } catch (error) {
      console.error('Error getting translation stats:', error);
      throw error;
    }
  }

  /**
   * Get properties that need translations
   * @param {string} languageCode - Target language
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Properties missing translations
   */
  async getPropertiesNeedingTranslation(languageCode = 'ja', limit = 10) {
    try {
      const { data, error } = await supabaseAdmin
        .from('properties')
        .select(`
          id,
          name,
          description,
          house_rules,
          luggage_info,
          check_in_instructions
        `)
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        console.error('Error fetching properties:', error);
        throw new Error('Failed to fetch properties');
      }

      const propertiesNeedingTranslation = [];

      for (const property of data) {
        const translations = await this.getPropertyTranslations(property.id, languageCode);
        const translatedFields = translations.map(t => t.field_name);
        
        const missingFields = TranslationService.TRANSLATABLE_FIELDS.filter(
          field => !translatedFields.includes(field) && property[field]
        );

        if (missingFields.length > 0) {
          propertiesNeedingTranslation.push({
            ...property,
            missingFields,
            missingCount: missingFields.length
          });
        }
      }

      return propertiesNeedingTranslation.sort((a, b) => b.missingCount - a.missingCount);
    } catch (error) {
      console.error('Error getting properties needing translation:', error);
      throw error;
    }
  }

  /**
   * Approve or unapprove a translation
   * @param {string} translationId - Translation UUID
   * @param {boolean} isApproved - Approval status
   * @returns {Promise<Object>} Updated translation
   */
  async updateTranslationApproval(translationId, isApproved) {
    try {
      const { data, error } = await supabaseAdmin
        .from('property_translations')
        .update({ 
          is_approved: isApproved,
          updated_at: new Date().toISOString()
        })
        .eq('id', translationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating translation approval:', error);
        throw new Error('Failed to update translation approval');
      }

      return data;
    } catch (error) {
      console.error('Database error updating translation approval:', error);
      throw error;
    }
  }

  /**
   * Search translations by text content
   * @param {string} searchTerm - Search term
   * @param {string} languageCode - Optional language filter
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Matching translations
   */
  async searchTranslations(searchTerm, languageCode = null, limit = 50) {
    try {
      let query = supabaseAdmin
        .from('property_translations')
        .select(`
          *,
          properties!inner (
            id,
            name
          )
        `)
        .textSearch('translated_text', searchTerm)
        .limit(limit);

      if (languageCode) {
        query = query.eq('language_code', languageCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching translations:', error);
        throw new Error('Failed to search translations');
      }

      return data || [];
    } catch (error) {
      console.error('Database error searching translations:', error);
      throw error;
    }
  }

  // ===== ROOM TYPE TRANSLATION METHODS =====

  /**
   * Get all translations for a specific room type
   * @param {string} roomTypeId - Room Type UUID
   * @param {string} languageCode - Optional language filter
   * @returns {Promise<Array>} Array of translation objects
   */
  async getRoomTypeTranslations(roomTypeId, languageCode = null) {
    try {
      let query = supabaseAdmin
        .from('room_type_translations')
        .select(`
          id,
          room_type_id,
          field_name,
          language_code,
          translated_text,
          is_auto_translated,
          is_approved,
          created_at,
          updated_at
        `)
        .eq('room_type_id', roomTypeId)
        .order('field_name')
        .order('language_code');

      if (languageCode) {
        query = query.eq('language_code', languageCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching room type translations:', error);
        throw new Error('Failed to fetch room type translations');
      }

      return data || [];
    } catch (error) {
      console.error('Database error fetching room type translations:', error);
      throw error;
    }
  }

  /**
   * Get translated text for a specific room type field with fallback logic
   * @param {string} roomTypeId - Room Type UUID
   * @param {string} fieldName - Field to translate
   * @param {string} languageCode - Target language
   * @returns {Promise<string>} Translated text or fallback
   */
  async getRoomTypeTranslatedText(roomTypeId, fieldName, languageCode = 'en') {
    try {
      // Use the database function for fallback logic
      const { data, error } = await supabaseAdmin
        .rpc('get_room_type_translated_text', {
          p_room_type_id: roomTypeId,
          p_field_name: fieldName,
          p_language_code: languageCode
        });

      if (error) {
        console.error('Error getting room type translated text:', error);
        throw new Error('Failed to get room type translated text');
      }

      return data || '';
    } catch (error) {
      console.error('Database error getting room type translated text:', error);
      throw error;
    }
  }

  /**
   * Get all translated fields for a room type in a specific language
   * @param {string} roomTypeId - Room Type UUID
   * @param {string} languageCode - Target language
   * @returns {Promise<Object>} Object with translated fields
   */
  async getRoomTypeTranslatedFields(roomTypeId, languageCode = 'en') {
    try {
      const translations = await this.getRoomTypeTranslations(roomTypeId, languageCode);
      const translatedFields = {};

      // Get translations for each field
      for (const fieldName of TranslationService.ROOM_TYPE_TRANSLATABLE_FIELDS) {
        const translation = translations.find(t => t.field_name === fieldName);
        if (translation) {
          translatedFields[fieldName] = translation.translated_text;
        } else {
          // Fallback to get_room_type_translated_text function
          translatedFields[fieldName] = await this.getRoomTypeTranslatedText(
            roomTypeId, 
            fieldName, 
            languageCode
          );
        }
      }

      return translatedFields;
    } catch (error) {
      console.error('Database error getting room type translated fields:', error);
      throw error;
    }
  }

  /**
   * Create or update a room type translation
   * @param {string} roomTypeId - Room Type UUID
   * @param {string} fieldName - Field name
   * @param {string} languageCode - Language code
   * @param {string} translatedText - Translated content
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created/updated translation
   */
  async upsertRoomTypeTranslation(roomTypeId, fieldName, languageCode, translatedText, options = {}) {
    try {
      const {
        isAutoTranslated = false,
        createdBy = null,
        isApproved = false
      } = options;

      // Validate inputs
      if (!TranslationService.SUPPORTED_LANGUAGES.includes(languageCode)) {
        throw new Error(`Unsupported language: ${languageCode}`);
      }

      if (!TranslationService.ROOM_TYPE_TRANSLATABLE_FIELDS.includes(fieldName)) {
        throw new Error(`Field not translatable: ${fieldName}`);
      }

      // Use the database function for upsert
      const { data, error } = await supabaseAdmin
        .rpc('upsert_room_type_translation', {
          p_room_type_id: roomTypeId,
          p_field_name: fieldName,
          p_language_code: languageCode,
          p_translated_text: translatedText,
          p_is_auto_translated: isAutoTranslated,
          p_created_by: createdBy
        });

      if (error) {
        console.error('Error upserting room type translation:', error);
        throw new Error('Failed to upsert room type translation');
      }

      // Get the full translation record
      const { data: translation, error: fetchError } = await supabaseAdmin
        .from('room_type_translations')
        .select('*')
        .eq('id', data)
        .single();

      if (fetchError) {
        console.error('Error fetching upserted room type translation:', fetchError);
        throw new Error('Failed to fetch upserted room type translation');
      }

      return translation;
    } catch (error) {
      console.error('Database error upserting room type translation:', error);
      throw error;
    }
  }

  /**
   * Create translations for multiple room type fields and languages
   * @param {string} roomTypeId - Room Type UUID
   * @param {Object} translations - Object with structure: { fieldName: { languageCode: text } }
   * @param {Object} options - Additional options
   * @returns {Promise<Array>} Array of created translations
   */
  async batchUpsertRoomTypeTranslations(roomTypeId, translations, options = {}) {
    try {
      const results = [];

      for (const [fieldName, languageTranslations] of Object.entries(translations)) {
        for (const [languageCode, translatedText] of Object.entries(languageTranslations)) {
          if (translatedText && translatedText.trim() !== '') {
            const translation = await this.upsertRoomTypeTranslation(
              roomTypeId,
              fieldName,
              languageCode,
              translatedText,
              options
            );
            results.push(translation);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Error in batch upsert room type translations:', error);
      throw error;
    }
  }

  /**
   * Delete a specific room type translation
   * @param {string} roomTypeId - Room Type UUID
   * @param {string} fieldName - Field name
   * @param {string} languageCode - Language code
   * @returns {Promise<boolean>} Success status
   */
  async deleteRoomTypeTranslation(roomTypeId, fieldName, languageCode) {
    try {
      const { error } = await supabaseAdmin
        .from('room_type_translations')
        .delete()
        .eq('room_type_id', roomTypeId)
        .eq('field_name', fieldName)
        .eq('language_code', languageCode);

      if (error) {
        console.error('Error deleting room type translation:', error);
        throw new Error('Failed to delete room type translation');
      }

      return true;
    } catch (error) {
      console.error('Database error deleting room type translation:', error);
      throw error;
    }
  }

  /**
   * Delete all translations for a room type
   * @param {string} roomTypeId - Room Type UUID
   * @returns {Promise<boolean>} Success status
   */
  async deleteRoomTypeTranslations(roomTypeId) {
    try {
      const { error } = await supabaseAdmin
        .from('room_type_translations')
        .delete()
        .eq('room_type_id', roomTypeId);

      if (error) {
        console.error('Error deleting room type translations:', error);
        throw new Error('Failed to delete room type translations');
      }

      return true;
    } catch (error) {
      console.error('Database error deleting room type translations:', error);
      throw error;
    }
  }

  /**
   * Get translation statistics for a room type
   * @param {string} roomTypeId - Room Type UUID
   * @returns {Promise<Object>} Translation statistics
   */
  async getRoomTypeTranslationStats(roomTypeId) {
    try {
      const translations = await this.getRoomTypeTranslations(roomTypeId);
      
      const stats = {
        totalTranslations: translations.length,
        byLanguage: {},
        byField: {},
        completionRate: {},
        autoTranslated: translations.filter(t => t.is_auto_translated).length,
        approved: translations.filter(t => t.is_approved).length
      };

      // Count by language
      for (const lang of TranslationService.SUPPORTED_LANGUAGES) {
        const langTranslations = translations.filter(t => t.language_code === lang);
        stats.byLanguage[lang] = langTranslations.length;
        stats.completionRate[lang] = (langTranslations.length / TranslationService.ROOM_TYPE_TRANSLATABLE_FIELDS.length) * 100;
      }

      // Count by field
      for (const field of TranslationService.ROOM_TYPE_TRANSLATABLE_FIELDS) {
        stats.byField[field] = translations.filter(t => t.field_name === field).length;
      }

      return stats;
    } catch (error) {
      console.error('Error getting room type translation stats:', error);
      throw error;
    }
  }

  /**
   * Get room types that need translations
   * @param {string} languageCode - Target language
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Room types missing translations
   */
  async getRoomTypesNeedingTranslation(languageCode = 'ja', limit = 10) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_types')
        .select(`
          id,
          name,
          description,
          bed_configuration,
          property_id,
          properties!inner (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .limit(limit);

      if (error) {
        console.error('Error fetching room types:', error);
        throw new Error('Failed to fetch room types');
      }

      const roomTypesNeedingTranslation = [];

      for (const roomType of data) {
        const translations = await this.getRoomTypeTranslations(roomType.id, languageCode);
        const translatedFields = translations.map(t => t.field_name);
        
        const missingFields = TranslationService.ROOM_TYPE_TRANSLATABLE_FIELDS.filter(
          field => !translatedFields.includes(field) && roomType[field]
        );

        if (missingFields.length > 0) {
          roomTypesNeedingTranslation.push({
            ...roomType,
            missingFields,
            missingCount: missingFields.length
          });
        }
      }

      return roomTypesNeedingTranslation.sort((a, b) => b.missingCount - a.missingCount);
    } catch (error) {
      console.error('Error getting room types needing translation:', error);
      throw error;
    }
  }

  /**
   * Approve or unapprove a room type translation
   * @param {string} translationId - Translation UUID
   * @param {boolean} isApproved - Approval status
   * @returns {Promise<Object>} Updated translation
   */
  async updateRoomTypeTranslationApproval(translationId, isApproved) {
    try {
      const { data, error } = await supabaseAdmin
        .from('room_type_translations')
        .update({ 
          is_approved: isApproved,
          updated_at: new Date().toISOString()
        })
        .eq('id', translationId)
        .select()
        .single();

      if (error) {
        console.error('Error updating room type translation approval:', error);
        throw new Error('Failed to update room type translation approval');
      }

      return data;
    } catch (error) {
      console.error('Database error updating room type translation approval:', error);
      throw error;
    }
  }

  /**
   * Search room type translations by text content
   * @param {string} searchTerm - Search term
   * @param {string} languageCode - Optional language filter
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Matching translations
   */
  async searchRoomTypeTranslations(searchTerm, languageCode = null, limit = 50) {
    try {
      let query = supabaseAdmin
        .from('room_type_translations')
        .select(`
          *,
          room_types!inner (
            id,
            name,
            properties (
              id,
              name
            )
          )
        `)
        .textSearch('translated_text', searchTerm)
        .limit(limit);

      if (languageCode) {
        query = query.eq('language_code', languageCode);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error searching room type translations:', error);
        throw new Error('Failed to search room type translations');
      }

      return data || [];
    } catch (error) {
      console.error('Database error searching room type translations:', error);
      throw error;
    }
  }
}

module.exports = new TranslationService();
