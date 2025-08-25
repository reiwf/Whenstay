import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import Backend from 'i18next-http-backend'
import { detectLanguageFromPhone } from '../utils/phoneLanguageDetection'

// Translation namespace configuration
const namespaces = [
  'common',
  'navigation', 
  'auth',
  'dashboard',
  'reservations',
  'properties',
  'guest',
  'modals',
  'forms',
  'notifications'
]

// i18n configuration
i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    lng: 'en', // default language
    fallbackLng: 'en',
    supportedLngs: ['en', 'ja','zh', 'zh-CN', 'zh-TW', 'ko'],
    nonExplicitSupportedLngs: true, 
    load: 'currentOnly',  
    
    // Namespace configuration
    defaultNS: 'common',
    ns: namespaces,
    
    // Backend configuration for loading translation files
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    
    // Language detection configuration
    detection: {
      // Detection order and caching
      order: ['localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      
      // Storage keys for different user types
      lookupLocalStorage: 'staylabel_language',
      lookupCookie: 'staylabel_language',
      
      // Convert detected language codes to match our supported languages
      convertDetectedLanguage: (lng) => {
        // Handle generic Chinese language code
        if (lng === 'zh') {
          return 'zh-CN' // Default to Simplified Chinese
        }
        // Handle other Chinese variants
        if (lng === 'zh-Hans') return 'zh-CN'
        if (lng === 'zh-Hant') return 'zh-TW'
        if (lng === 'zh-HK') return 'zh-TW'
        if (lng === 'zh-MO') return 'zh-TW'
        if (lng === 'zh-SG') return 'zh-CN'
        // Return as-is for other languages
        return lng
      },
    },
    
    // React i18next configuration
    react: {
      useSuspense: false, // Prevent Suspense issues during SSR
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '', // Return empty string for empty values
      transSupportBasicHtmlNodes: true, // Allow basic HTML in translations
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em'], // Allowed HTML tags
    },
    
    // Interpolation configuration
    interpolation: {
      escapeValue: false,
    },

    // NEW
    formatters: {
      uppercase: (value) => String(value).toUpperCase(),
      lowercase: (value) => String(value).toLowerCase(),
      date: (value, lng) => {
        const date = new Date(value)
        switch (lng) {
          case 'ja':    return date.toLocaleDateString('ja-JP')
          case 'ko':    return date.toLocaleDateString('ko-KR')
          case 'zh-CN': return date.toLocaleDateString('zh-CN')
          case 'zh-TW': return date.toLocaleDateString('zh-TW')
          default:      return date.toLocaleDateString('en-US')
        }
      }
    },

    
    // Debug configuration (disable in production)
    debug: process.env.NODE_ENV === 'development',
    
    // Key separator and nesting
    keySeparator: '.',
    nsSeparator: ':',
    
    // Pluralization
    pluralSeparator: '_',
    contextSeparator: '_',
    
    // Fallback configuration
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key, fallbackValue) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation key: ${ns}:${key} for language: ${lng}`)
      }
    }
  }
)
// i18n.on('languageChanged', (lng) => {
//   if (lng === 'zh') {
//     i18n.changeLanguage('zh-CN')
//   }
// })

  
/**
 * Initialize language for guest users based on phone number
 * @param {string} phoneNumber - Guest's booking phone number
 * @param {string} guestToken - Guest token for unique storage
 */
export const initGuestLanguage = (phoneNumber, guestToken) => {
  // Detect language from phone number
  const detectedLanguage = detectLanguageFromPhone(phoneNumber)
  
  // Check if guest has a previous language preference
  const savedLanguage = localStorage.getItem(`staylabel_guest_language_${guestToken}`)
  
  // Use saved preference if exists, otherwise use detected language
  const finalLanguage = savedLanguage || detectedLanguage
  
  // Set language and save preference
  i18n.changeLanguage(finalLanguage)
  localStorage.setItem(`staylabel_guest_language_${guestToken}`, finalLanguage)
  
  return finalLanguage
}

/**
 * Initialize language for admin/staff users
 * @param {string} userId - User ID for unique storage
 */
export const initAdminLanguage = (userId) => {
  // Check for saved admin language preference
  const savedLanguage = localStorage.getItem('staylabel_admin_language')
  
  if (savedLanguage && i18n.options.supportedLngs.includes(savedLanguage)) {
    i18n.changeLanguage(savedLanguage)
    return savedLanguage
  }
  
  // Fallback to browser language or English
  const browserLanguage = navigator.language
  let detectedLanguage = 'en'
  
  // Map browser language to supported languages
  if (browserLanguage.startsWith('ja')) {
    detectedLanguage = 'ja'
  } else if (browserLanguage.startsWith('ko')) {
    detectedLanguage = 'ko'
  } else if (browserLanguage.includes('CN') || browserLanguage === 'zh-Hans') {
    detectedLanguage = 'zh-CN'
  } else if (browserLanguage.includes('TW') || browserLanguage.includes('HK') || browserLanguage === 'zh-Hant') {
    detectedLanguage = 'zh-TW'
  }
  
  i18n.changeLanguage(detectedLanguage)
  localStorage.setItem('staylabel_admin_language', detectedLanguage)
  
  return detectedLanguage
}

/**
 * Change language and persist preference
 * @param {string} languageCode - Target language code
 * @param {string} userType - 'admin' or 'guest'
 * @param {string} identifier - userId for admin, guestToken for guest
 */
export const changeLanguage = (languageCode, userType = 'admin', identifier = '') => {
  if (!i18n.options.supportedLngs.includes(languageCode)) {
    console.warn(`Unsupported language: ${languageCode}`)
    return false
  }
  
  // Change language
  i18n.changeLanguage(languageCode)
  
  // Persist preference based on user type
  if (userType === 'guest' && identifier) {
    localStorage.setItem(`staylabel_guest_language_${identifier}`, languageCode)
  } else {
    localStorage.setItem('staylabel_admin_language', languageCode)
  }
  
  return true
}

export default i18n
