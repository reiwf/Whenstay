import { useState } from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Briefcase, 
  UserCheck,
  AlertCircle 
} from 'lucide-react'
import StepNavigation from '../shared/StepNavigation'

export default function Step2GuestInformation({ 
  reservation, 
  formData, 
  onUpdateFormData, 
  onNext, 
  onPrevious 
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
    } else if (!/^[\+]?[1-9][\d]{0,15}$/.test(formData.contactNumber.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.contactNumber = 'Please enter a valid phone number'
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

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Guest Information
        </h2>
        <p className="text-gray-600">
          Please provide your personal information for check-in
        </p>
      </div>

      <form className="space-y-6">
        {/* Personal Information Section */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Who will stay with us?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName || ''}
                onChange={(e) => handleInputChange('firstName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.firstName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your first name"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.firstName}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName || ''}
                onChange={(e) => handleInputChange('lastName', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.lastName ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your last name"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.lastName}
                </p>
              )}
            </div>

            {/* Personal Email Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.personalEmail || ''}
                onChange={(e) => handleInputChange('personalEmail', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.personalEmail ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="your.personal@email.com"
              />
              {errors.personalEmail && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.personalEmail}
                </p>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number *
              </label>
              <input
                type="tel"
                required
                value={formData.contactNumber || ''}
                onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="+1 (555) 123-4567"
              />
              {errors.contactNumber && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {errors.contactNumber}
                </p>
              )}
            </div>

            
          </div>
        </div>

        {/* Check-in Preferences Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Check-in Preferences
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Estimated Check-in Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Check-in Time
              </label>
              <input
                type="time"
                value={formData.estimatedCheckinTime || ''}
                onChange={(e) => handleInputChange('estimatedCheckinTime', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                What time do you expect to arrive for check-in?
              </p>
            </div>

            {/* Travel Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Briefcase className="w-4 h-4 inline mr-2" />
                Travel Purpose
              </label>
              <select
                value={formData.travelPurpose || ''}
                onChange={(e) => handleInputChange('travelPurpose', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select purpose</option>
                <option value="Business">Business</option>
                <option value="Leisure">Leisure</option>
                <option value="Family Visit">Family Visit</option>
                <option value="Medical">Medical</option>
                <option value="Education">Education</option>
                <option value="Other">Other</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
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




