import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Languages } from 'lucide-react'
import { getAllLanguages, getLanguageDisplayInfo } from '../utils/phoneLanguageDetection'
import { changeLanguage } from '../i18n/config'

const LanguageSwitcher = ({ 
  userType = 'admin', 
  identifier = '', 
  compact = false,
  className = ''
}) => {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const languages = getAllLanguages()
  const currentLanguage = getLanguageDisplayInfo(i18n.language)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLanguageChange = (languageCode) => {
    changeLanguage(languageCode, userType, identifier)
    setIsOpen(false)
  }

  if (compact) {
    // Compact version for guest header
    return (
      <div className={`relative ${className}`} ref={dropdownRef}>
        <button
          type="button"
          className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors text-sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full right-0 mt-1 w-40 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-[60]">
            <div className="py-1">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`flex items-center w-full px-3 py-2 text-sm hover:bg-gray-100 ${
                    lang.code === i18n.language ? 'bg-gray-50 text-primary-600' : 'text-gray-700'
                  }`}
                >
                  <span className="mr-2 text-base">{lang.flag}</span>
                  <span className="truncate">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Full version for admin profile dropdown
  return (
    <div className={`${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
      >
        <Languages className="mr-3 h-4 w-4" />
        <span className="flex-1 text-left">Language</span>
        <div className="flex items-center space-x-1">
          <span className="text-base">{currentLanguage.flag}</span>
          <span className="text-xs text-gray-500">{currentLanguage.name}</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-full bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`flex items-center w-full px-4 py-2 text-sm hover:bg-gray-100 ${
                  lang.code === i18n.language ? 'bg-gray-50 text-primary-600' : 'text-gray-700'
                }`}
              >
                <span className="mr-3 text-base">{lang.flag}</span>
                <span className="flex-1 text-left">{lang.name}</span>
                {lang.code === i18n.language && (
                  <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
