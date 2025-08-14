import { useState } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Briefcase, 
  UserCheck,
  AlertCircle,
  CheckCircle 
} from 'lucide-react'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import flags from 'react-phone-number-input/flags'
import './PhoneInput.css'
import StepNavigation from '../shared/StepNavigation'
import TimePicker from '@/components/ui/timepick'

export default function Step2GuestInformation({ 
  reservation, 
  formData, 
  onUpdateFormData, 
  onNext, 
  onPrevious,
  checkinCompleted = false,
  isModificationMode = false,
  guestData = null
}) {
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    // Required fields validation
    if (!formData.firstName?.trim()) {
      newErrors.firstName = 'First name is required'
    }

    if (!formData.lastName?.trim()) {
      newErrors.lastName = 'Last name is required'
    }

    if (!formData.personalEmail?.trim()) {
      newErrors.personalEmail = 'Personal email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)) {
      newErrors.personalEmail = 'Please enter a valid email address'
    }

    if (!formData.contactNumber?.trim()) {
      newErrors.contactNumber = 'Contact number is required'
    }

    // Address validation (optional but if provided, should not be empty)
    if (formData.address && !formData.address.trim()) {
      newErrors.address = 'Please provide a complete address or leave empty'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateForm()) {
      onNext()
    }
  }

  const handleInputChange = (field, value) => {
    onUpdateFormData({ [field]: value })
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  // Determine if we should show read-only view
  const isReadOnly = checkinCompleted && !isModificationMode

  return (
    <div>
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary-900 mb-2">
          Guest Information
        </h2>
        <p className="text-sm sm:text-base text-primary-600">
          {isReadOnly 
            ? "Your submitted guest information" 
            : isModificationMode 
              ? "Update your personal information for check-in"
              : "Please provide your personal information for check-in"
          }
        </p>
      </div>

      {/* Read-only confirmation when check-in is completed */}
      {isReadOnly && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-3 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-primary-900">
              Information Submitted
            </h3>
          </div>
          <p className="text-sm sm:text-base text-primary-800">
            Your guest information has been successfully submitted and is currently under review.
          </p>
        </div>
      )}

      <form className="space-y-4 sm:space-y-6">
        {/* Personal Information Section */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-4 flex items-center">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
            Who will stay with us?
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName || ''}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                disabled={isReadOnly}
                className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                  errors.firstName ? 'error' : ''
                }`}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: isReadOnly ? "#f5f5f5" : "white",
                  cursor: isReadOnly ? "not-allowed" : "text"
                }}
                placeholder="Enter your first name"
              />
              {errors.firstName && (
                <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                  {errors.firstName}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName || ''}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                disabled={isReadOnly}
                className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                  errors.lastName ? 'error' : ''
                }`}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: isReadOnly ? "#f5f5f5" : "white",
                  cursor: isReadOnly ? "not-allowed" : "text"
                }}
                placeholder="Enter your last name"
              />
              {errors.lastName && (
                <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                  {errors.lastName}
                </p>
              )}
            </div>

            {/* Personal Email Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.personalEmail || ''}
                onChange={(e) => handleInputChange('personalEmail', e.target.value)}
                disabled={isReadOnly}
                className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                  errors.personalEmail ? 'error' : ''
                }`}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: isReadOnly ? "#f5f5f5" : "white",
                  cursor: isReadOnly ? "not-allowed" : "text"
                }}
                placeholder="your.personal@email.com"
              />
              {errors.personalEmail && (
                <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                  {errors.personalEmail}
                </p>
              )}
            </div>

            {/* Contact Number */}
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                Contact Number *
              </label>
              <div className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                errors.contactNumber ? 'error' : ''
              }`} style={{
                padding: 0,
                background: isReadOnly ? "#f5f5f5" : "white",
                cursor: isReadOnly ? "not-allowed" : "default"
              }}>
                <PhoneInput
                  international
                  countryCallingCodeEditable={false}
                  defaultCountry="JP"
                  flags={flags}
                  value={formData.contactNumber || ''}
                  onChange={(value) => handleInputChange('contactNumber', value || '')}
                  disabled={isReadOnly}
                  placeholder="Enter phone number"
                  style={{
                    padding: "8px 16px",
                    fontSize: "14px",
                    background: "transparent",
                    border: "none",
                    height: "48px",
                    outline: "none"
                  }}
                />
              </div>
              {errors.contactNumber && (
                <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                  {errors.contactNumber}
                </p>
              )}
            </div>

            
          </div>
        </div>

        {/* Check-in Preferences Section */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-4 flex items-center">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
            Check-in Preferences
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Estimated Check-in Time */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                Estimated Check-in Time
              </label>
              <div className="w-full">
                <TimePicker
                  value={formData.estimatedCheckinTime || null}
                  onChange={(val) => handleInputChange("estimatedCheckinTime", val || "")}
                  disabled={isReadOnly}
                  format="24"
                  step={60} // or 30 / 15
                  placeholder="HH:mm"
                  clearable
                  overnightRange={{ start: "16:00", end: "03:00" }}
                  error={!!errors.estimatedCheckinTime}
                />
              </div>

              <p className="mt-1 text-xs sm:text-sm text-primary-500">
                What time do you expect to arrive for check-in?
              </p>
            </div>

            {/* Travel Purpose */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                <Briefcase className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                Travel Purpose
              </label>
              <select
                value={formData.travelPurpose || ''}
                onChange={(e) => handleInputChange('travelPurpose', e.target.value)}
                disabled={isReadOnly}
                className={`form-field ${isReadOnly ? 'disabled' : ''}`}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  fontSize: "14px",
                  background: isReadOnly ? "#f5f5f5" : "white",
                  cursor: isReadOnly ? "not-allowed" : "pointer"
                }}
              >
                <option value="">Select purpose</option>
                <option value="Business">Business</option>
                <option value="Leisure">Leisure</option>
                <option value="Family Visit">Family Visit</option>
                <option value="Medical">Medical</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
              <p className="mt-1 text-xs sm:text-sm text-primary-500">
                Purpose of your visit
              </p>
            </div>
          </div>
        </div>

      </form>

      <StepNavigation
        currentStep={2}
        totalSteps={4}
        onNext={handleNext}
        onPrevious={onPrevious}
        nextButtonText="Continue"
      />
    </div>
  )
}
