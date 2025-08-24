/**
 * Phone number country code to language mapping utility
 * Detects language based on international phone number prefixes
 */

// Country code to language mapping
const COUNTRY_CODE_TO_LANGUAGE = {
  // Japan
  '+81': 'ja',
  '81': 'ja',
  
  // China (Mainland)
  '+86': 'zh-CN', 
  '86': 'zh-CN',
  
  // Hong Kong
  '+852': 'zh-TW',
  '852': 'zh-TW',
  
  // Macau
  '+853': 'zh-TW',
  '853': 'zh-TW',
  
  // Taiwan
  '+886': 'zh-TW',
  '886': 'zh-TW',
  
  // South Korea
  '+82': 'ko',
  '82': 'ko',
}

// Language display names for UI
export const LANGUAGE_NAMES = {
  'en': 'English',
  'ja': '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'ko': '한국어'
}

// Language flag emojis (for compact display)
export const LANGUAGE_FLAGS = {
  'en': '🇺🇸',
  'ja': '🇯🇵', 
  'zh-CN': '🇨🇳',
  'zh-TW': '🇹🇼',
  'ko': '🇰🇷'
}

// Supported languages list
export const SUPPORTED_LANGUAGES = ['en', 'ja', 'zh-CN', 'zh-TW', 'ko']

/**
 * Extract country code from phone number
 * @param {string} phoneNumber - Phone number in various formats
 * @returns {string|null} - Country code or null if not found
 */
export const extractCountryCode = (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return null
  }

  // Clean phone number - remove spaces, dashes, parentheses
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '')
  
  // Check for + prefix
  if (cleaned.startsWith('+')) {
    // Extract potential country codes (1-4 digits after +)
    for (let i = 4; i >= 1; i--) {
      const code = cleaned.substring(0, i + 1) // include the +
      if (COUNTRY_CODE_TO_LANGUAGE[code]) {
        return code
      }
    }
  } else {
    // Check without + prefix for common Asian country codes
    const commonCodes = ['81', '82', '86', '852', '853', '886']
    for (const code of commonCodes) {
      if (cleaned.startsWith(code)) {
        return code
      }
    }
  }
  
  return null
}

/**
 * Detect language from phone number
 * @param {string} phoneNumber - Phone number in various formats
 * @returns {string} - Language code (defaults to 'en' if not detected)
 */
export const detectLanguageFromPhone = (phoneNumber) => {
  const countryCode = extractCountryCode(phoneNumber)
  
  if (countryCode && COUNTRY_CODE_TO_LANGUAGE[countryCode]) {
    return COUNTRY_CODE_TO_LANGUAGE[countryCode]
  }
  
  // Default to English if no match found
  return 'en'
}

/**
 * Get language display info
 * @param {string} languageCode - Language code (en, ja, zh-CN, etc.)
 * @returns {object} - Object with name, flag, and code
 */
export const getLanguageDisplayInfo = (languageCode) => {
  return {
    code: languageCode,
    name: LANGUAGE_NAMES[languageCode] || 'English',
    flag: LANGUAGE_FLAGS[languageCode] || '🇺🇸'
  }
}

/**
 * Get all supported languages with display info
 * @returns {array} - Array of language objects with code, name, and flag
 */
export const getAllLanguages = () => {
  return SUPPORTED_LANGUAGES.map(code => getLanguageDisplayInfo(code))
}
