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
}

module.exports = new TranslationService();
