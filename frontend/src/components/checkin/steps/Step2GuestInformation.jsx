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
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Plus,
  Users
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
  const [expandedGuests, setExpandedGuests] = useState(new Set([1])) // Guest 1 always expanded

  // Initialize guests array based on reservation.numGuests
  const numGuests = reservation?.numGuests || 1
  const initializeGuests = () => {
    const guests = []
    for (let i = 1; i <= numGuests; i++) {
      const existingGuest = guestData?.guests?.find(g => g.guestNumber === i)
      const formDataGuest = formData?.guests?.find(g => g.guestNumber === i)
      
      guests.push({
        guestNumber: i,
        firstName: existingGuest?.firstName || formDataGuest?.firstName || (i === 1 ? formData.firstName : '') || '',
        lastName: existingGuest?.lastName || formDataGuest?.lastName || (i === 1 ? formData.lastName : '') || '',
        personalEmail: existingGuest?.personalEmail || formDataGuest?.personalEmail || (i === 1 ? formData.personalEmail : '') || '',
        contactNumber: existingGuest?.contactNumber || formDataGuest?.contactNumber || (i === 1 ? formData.contactNumber : '') || '',
        address: existingGuest?.address || formDataGuest?.address || (i === 1 ? formData.address : '') || '',
        estimatedCheckinTime: existingGuest?.estimatedCheckinTime || formDataGuest?.estimatedCheckinTime || (i === 1 ? formData.estimatedCheckinTime : '') || '',
        travelPurpose: existingGuest?.travelPurpose || formDataGuest?.travelPurpose || (i === 1 ? formData.travelPurpose : '') || '',
        emergencyContactName: existingGuest?.emergencyContactName || formDataGuest?.emergencyContactName || (i === 1 ? formData.emergencyContactName : '') || '',
        emergencyContactPhone: existingGuest?.emergencyContactPhone || formDataGuest?.emergencyContactPhone || (i === 1 ? formData.emergencyContactPhone : '') || '',
        isCompleted: existingGuest?.isCompleted || formDataGuest?.isCompleted || false,
        isPrimaryGuest: i === 1
      })
    }
    return guests
  }

  const [guests, setGuests] = useState(initializeGuests())

  const toggleGuestExpansion = (guestNumber) => {
    setExpandedGuests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(guestNumber)) {
        // Don't allow collapsing guest 1
        if (guestNumber !== 1) {
          newSet.delete(guestNumber)
        }
      } else {
        newSet.add(guestNumber)
      }
      return newSet
    })
  }

  const validateForm = () => {
    const newErrors = {}

    // Validate all guests - simplified validation for additional guests
    guests.forEach((guest, index) => {
      const guestKey = `guest${guest.guestNumber}`
      
      // All guests need first and last name
      if (!guest.firstName?.trim()) {
        newErrors[`${guestKey}.firstName`] = `First name is required for Guest ${guest.guestNumber}`
      }

      if (!guest.lastName?.trim()) {
        newErrors[`${guestKey}.lastName`] = `Last name is required for Guest ${guest.guestNumber}`
      }

      // Only primary guest needs full information
      if (guest.isPrimaryGuest) {
        if (!guest.personalEmail?.trim()) {
          newErrors[`${guestKey}.personalEmail`] = `Email address is required for primary guest`
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.personalEmail)) {
          newErrors[`${guestKey}.personalEmail`] = `Please enter a valid email address for primary guest`
        }

        if (!guest.contactNumber?.trim()) {
          newErrors[`${guestKey}.contactNumber`] = `Contact number is required for primary guest`
        }

        // Address validation (optional but if provided, should not be empty)
        if (guest.address && !guest.address.trim()) {
          newErrors[`${guestKey}.address`] = `Please provide a complete address or leave empty`
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateForm()) {
      // Update formData with all guests information for next steps
      onUpdateFormData({ 
        guests: guests,
        // Keep backward compatibility with single guest fields (Guest #1)
        firstName: guests[0]?.firstName,
        lastName: guests[0]?.lastName,
        personalEmail: guests[0]?.personalEmail,
        contactNumber: guests[0]?.contactNumber,
        address: guests[0]?.address,
        estimatedCheckinTime: guests[0]?.estimatedCheckinTime,
        travelPurpose: guests[0]?.travelPurpose,
        emergencyContactName: guests[0]?.emergencyContactName,
        emergencyContactPhone: guests[0]?.emergencyContactPhone
      })
      onNext()
    }
  }

  const handleGuestInputChange = (guestNumber, field, value) => {
    setGuests(prev => prev.map(guest => 
      guest.guestNumber === guestNumber 
        ? { ...guest, [field]: value }
        : guest
    ))
    
    // Clear error when user starts typing
    const errorKey = `guest${guestNumber}.${field}`
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }))
    }

    // For backward compatibility, update formData for guest #1
    if (guestNumber === 1) {
      onUpdateFormData({ [field]: value })
    }
  }

  // Legacy handler for backward compatibility
  const handleInputChange = (field, value) => {
    handleGuestInputChange(1, field, value)
  }

  // Helper function to check if a guest has validation errors
  const hasGuestErrors = (guestNumber) => {
    const guestKey = `guest${guestNumber}`
    return Object.keys(errors).some(errorKey => errorKey.startsWith(guestKey))
  }

  const renderGuestForm = (guest) => {
    const isExpanded = expandedGuests.has(guest.guestNumber)
    const guestKey = `guest${guest.guestNumber}`
    const hasErrors = hasGuestErrors(guest.guestNumber)
    
    return (
      <div key={guest.guestNumber} className="border border-primary-200 rounded-lg overflow-hidden">
        {/* Guest Header */}
        <div 
          className={`p-4 cursor-pointer transition-colors ${
            guest.isPrimaryGuest 
              ? 'bg-primary-100 border-b border-primary-200' 
              : 'bg-gray-50 hover:bg-gray-100'
          }`}
          onClick={() => !guest.isPrimaryGuest && toggleGuestExpansion(guest.guestNumber)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-3 text-primary-600" />
              <div>
                <h4 className="font-semibold text-primary-900">
                  {guest.isPrimaryGuest ? 'Primary Guest' : `Additional Guest ${guest.guestNumber}`}
                </h4>
                <p className="text-sm text-primary-600">
                  {guest.firstName && guest.lastName 
                    ? `${guest.firstName} ${guest.lastName}` 
                    : guest.isPrimaryGuest ? 'Main contact person' : 'Click to expand and fill information'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center">
              {hasErrors && (
                <div className="relative mr-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  {/* Optional: Add a small pulse animation for better visibility */}
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                </div>
              )}
              {guest.isCompleted && !hasErrors && (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              )}
              {!guest.isPrimaryGuest && (
                isExpanded ? 
                  <ChevronUp className="w-5 h-5 text-primary-600" /> :
                  <ChevronDown className="w-5 h-5 text-primary-600" />
              )}
            </div>
          </div>
        </div>

        {/* Guest Form - Always expanded for primary guest */}
        {(isExpanded || guest.isPrimaryGuest) && (
          <div className="p-4 sm:p-6 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* First Name */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={guest.firstName || ''}
                  onChange={(e) => handleGuestInputChange(guest.guestNumber, 'firstName', e.target.value)}
                  disabled={isReadOnly}
                  className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                    errors[`${guestKey}.firstName`] ? 'error' : ''
                  }`}
                  style={{
                    width: "100%",
                    padding: "8px 16px",
                    fontSize: "14px",
                    background: isReadOnly ? "#f5f5f5" : "white",
                    cursor: isReadOnly ? "not-allowed" : "text"
                  }}
                  placeholder="Enter first name"
                />
                {errors[`${guestKey}.firstName`] && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                    {errors[`${guestKey}.firstName`]}
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
                  value={guest.lastName || ''}
                  onChange={(e) => handleGuestInputChange(guest.guestNumber, 'lastName', e.target.value)}
                  disabled={isReadOnly}
                  className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                    errors[`${guestKey}.lastName`] ? 'error' : ''
                  }`}
                  style={{
                    width: "100%",
                    padding: "8px 16px",
                    fontSize: "14px",
                    background: isReadOnly ? "#f5f5f5" : "white",
                    cursor: isReadOnly ? "not-allowed" : "text"
                  }}
                  placeholder="Enter last name"
                />
                {errors[`${guestKey}.lastName`] && (
                  <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                    {errors[`${guestKey}.lastName`]}
                  </p>
                )}
              </div>

              {/* Additional fields only for primary guest */}
              {guest.isPrimaryGuest && (
                <>
                  {/* Personal Email */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={guest.personalEmail || ''}
                      onChange={(e) => handleGuestInputChange(guest.guestNumber, 'personalEmail', e.target.value)}
                      disabled={isReadOnly}
                      className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                        errors[`${guestKey}.personalEmail`] ? 'error' : ''
                      }`}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        fontSize: "14px",
                        background: isReadOnly ? "#f5f5f5" : "white",
                        cursor: isReadOnly ? "not-allowed" : "text"
                      }}
                      placeholder="personal@email.com"
                    />
                    {errors[`${guestKey}.personalEmail`] && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                        {errors[`${guestKey}.personalEmail`]}
                      </p>
                    )}
                  </div>

                  {/* Contact Number */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                      Contact Number *
                    </label>
                    <div className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                      errors[`${guestKey}.contactNumber`] ? 'error' : ''
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
                        value={guest.contactNumber || ''}
                        onChange={(value) => handleGuestInputChange(guest.guestNumber, 'contactNumber', value || '')}
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
                    {errors[`${guestKey}.contactNumber`] && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                        {errors[`${guestKey}.contactNumber`]}
                      </p>
                    )}
                  </div>

                  {/* Address (Optional) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4 inline mr-2" />
                      Address (Optional)
                    </label>
                    <textarea
                      value={guest.address || ''}
                      onChange={(e) => handleGuestInputChange(guest.guestNumber, 'address', e.target.value)}
                      disabled={isReadOnly}
                      rows="2"
                      className={`form-field ${isReadOnly ? 'disabled' : ''} ${
                        errors[`${guestKey}.address`] ? 'error' : ''
                      }`}
                      style={{
                        width: "100%",
                        padding: "8px 16px",
                        fontSize: "14px",
                        background: isReadOnly ? "#f5f5f5" : "white",
                        cursor: isReadOnly ? "not-allowed" : "text",
                        resize: "vertical"
                      }}
                      placeholder="Your current address"
                    />
                    {errors[`${guestKey}.address`] && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                        {errors[`${guestKey}.address`]}
                      </p>
                    )}
                  </div>

                  {/* Estimated Check-in Time */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-primary-700 mb-2">
                      Estimated Check-in Time
                    </label>
                    <div className="w-full">
                      <TimePicker
                        value={guest.estimatedCheckinTime || null}
                        onChange={(val) => handleGuestInputChange(guest.guestNumber, 'estimatedCheckinTime', val || '')}
                        disabled={isReadOnly}
                        format="24"
                        step={60}
                        placeholder="HH:mm"
                        clearable
                        overnightRange={{ start: "16:00", end: "03:00" }}
                        error={!!errors[`${guestKey}.estimatedCheckinTime`]}
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
                      value={guest.travelPurpose || ''}
                      onChange={(e) => handleGuestInputChange(guest.guestNumber, 'travelPurpose', e.target.value)}
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
                </>
              )}
            </div>
          </div>
        )}
      </div>
    )
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

      {/* Multi-guest progress indicator */}
      {numGuests > 1 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-900">
                Guest Information for {numGuests} guests
              </span>
            </div>
            <div className="text-sm text-blue-700">
              {guests.filter(g => {
                // Primary guest needs full info, additional guests only need first/last name
                if (g.isPrimaryGuest) {
                  return g.firstName && g.lastName && g.personalEmail && g.contactNumber
                } else {
                  return g.firstName && g.lastName
                }
              }).length} of {numGuests} completed
            </div>
          </div>
        </div>
      )}

      <form className="space-y-4 sm:space-y-6">
        {/* Multi-Guest Forms */}
        <div className="space-y-4">
          <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-4 flex items-center">
            <User className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
            Who will stay with us?
            {numGuests > 1 && (
              <span className="ml-2 text-sm text-primary-600 font-normal">
                ({numGuests} guests)
              </span>
            )}
          </h3>
          
          {guests.map(renderGuestForm)}
        </div>

        {/* Expand all additional guests button */}
        {numGuests > 1 && !isReadOnly && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                const allExpanded = guests.slice(1).every(g => expandedGuests.has(g.guestNumber))
                if (allExpanded) {
                  // Collapse all except guest 1
                  setExpandedGuests(new Set([1]))
                } else {
                  // Expand all guests
                  setExpandedGuests(new Set(guests.map(g => g.guestNumber)))
                }
              }}
              className="text-sm text-primary-600 hover:text-primary-800 flex items-center mx-auto"
            >
              <Users className="w-4 h-4 mr-2" />
              {guests.slice(1).every(g => expandedGuests.has(g.guestNumber)) 
                ? 'Collapse additional guests' 
                : 'Expand all additional guests'
              }
            </button>
          </div>
        )}

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
