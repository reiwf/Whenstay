import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import StepNavigation from '../shared/StepNavigation'
import { GUEST_AGREEMENT_TEMPLATE } from '../templates/GuestAgreementTemplate'

export default function Step4Agreement({ 
  formData, 
  onUpdateFormData, 
  onSubmit, 
  onPrevious,
  isSubmitting = false,
  checkinCompleted = false,
  isModificationMode = false
}) {
  const [hasReadAgreement, setHasReadAgreement] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(formData.agreementAccepted || false)
  const [error, setError] = useState('')

  const handleSubmit = () => {
    if (!agreementAccepted) {
      setError('Please accept the guest agreement to complete your check-in')
      return
    }
    
    if (!hasReadAgreement) {
      setError('Please scroll through and read the entire agreement before accepting')
      return
    }

    setError('')
    onUpdateFormData({ agreementAccepted: true })
    onSubmit()
  }

  const handleAgreementChange = (accepted) => {
    setAgreementAccepted(accepted)
    onUpdateFormData({ agreementAccepted: accepted })
    if (error) setError('')
  }

  const handleScroll = (e) => {
    const element = e.target
    const isScrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 10
    if (isScrolledToBottom && !hasReadAgreement) {
      setHasReadAgreement(true)
    }
  }

  // Determine if we should show read-only view
  const isReadOnly = checkinCompleted && !isModificationMode

  // Convert markdown-style text to JSX
  const formatAgreementText = (text) => {
    return text.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        // Bold headers
        return (
          <h3 key={index} className="text-lg font-bold text-gray-900 mt-6 mb-3">
            {line.slice(2, -2)}
          </h3>
        )
      } else if (line.startsWith('•')) {
        // Bullet points
        return (
          <li key={index} className="text-gray-700 mb-1">
            {line.slice(1).trim()}
          </li>
        )
      } else if (line.trim() === '') {
        // Empty lines
        return <br key={index} />
      } else {
        // Regular paragraphs
        return (
          <p key={index} className="text-gray-700 mb-3">
            {line}
          </p>
        )
      }
    })
  }

  return (
    <div>
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-primary-900 mb-2">
          Guest Agreement
        </h2>
        <p className="text-sm sm:text-base text-primary-600">
          {isReadOnly 
            ? "Your accepted guest agreement" 
            : isModificationMode 
              ? "Review and update your agreement acceptance"
              : "Please review and accept our terms and conditions"
          }
        </p>
      </div>

      {/* Read-only confirmation when check-in is completed */}
      {isReadOnly && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6 mb-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600 mr-3 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-primary-900">
              Agreement Accepted
            </h3>
          </div>
          <p className="text-sm sm:text-base text-primary-800">
            You have successfully reviewed and accepted our guest agreement. Your check-in is complete!
          </p>
        </div>
      )}

      {/* Agreement Text */}
      <div className="text-xs sm:text-sm bg-white border border-gray-300 rounded-lg mb-4 sm:mb-6">
        <div className="p-3 sm:p-4 border-b border-primary-200 bg-primary-50">
          <div className="flex items-center">
            <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600 mr-2 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-semibold text-primary-900">
              Terms and Conditions
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-primary-600 mt-1">
            Please scroll through the entire document before accepting
          </p>
        </div>
        
        <div 
          className="p-3 sm:p-6 max-h-64 sm:max-h-96 overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="prose prose-xs sm:prose-sm max-w-none">
            {formatAgreementText(GUEST_AGREEMENT_TEMPLATE)}
          </div>
        </div>
        
        {!hasReadAgreement && (
            <div className="p-3 sm:p-4 border-t border-primary-200 bg-primary-100">
            <div className="flex items-start">
              <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-primary-800">
                Please scroll to the bottom of the agreement to continue
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Agreement Acceptance */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="agreement"
            checked={agreementAccepted}
            onChange={(e) => handleAgreementChange(e.target.checked)}
            disabled={!hasReadAgreement || isReadOnly}
            className="mt-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50 flex-shrink-0"
          />
          <label htmlFor="agreement" className={`text-xs sm:text-sm text-gray-700 select-none ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}>
            <span className="font-medium">I acknowledge that I have read, understood, and agree to comply with all terms and conditions outlined in this guest agreement.</span>
            <br />
            <span className="text-gray-600">
              By checking this box, I confirm that I am at least 18 years of age and have the authority to enter into this agreement on behalf of all guests in my party.
            </span>
          </label>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm sm:text-base text-red-800 break-words">{error}</p>
          </div>
        </div>
      )}

      {/* Success Indicator */}
      {hasReadAgreement && agreementAccepted && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm sm:text-base text-green-800">
              Thank you for reviewing and accepting our guest agreement. You're ready to complete your check-in!
            </p>
          </div>
        </div>
      )}

      <StepNavigation
        currentStep={4}
        totalSteps={4}
        onNext={handleSubmit}
        onPrevious={onPrevious}
        isNextDisabled={!agreementAccepted || !hasReadAgreement}
        isLoading={isSubmitting}
        nextButtonText="Complete Check-in"
        showNext={!(checkinCompleted && agreementAccepted && !isModificationMode)}
      />
    </div>
  )
}
