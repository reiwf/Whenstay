import { useState } from 'react'
import { FileText, CheckCircle, AlertCircle } from 'lucide-react'
import StepNavigation from '../shared/StepNavigation'
import { GUEST_AGREEMENT_TEMPLATE } from '../templates/GuestAgreementTemplate'

export default function Step4Agreement({ 
  formData, 
  onUpdateFormData, 
  onSubmit, 
  onPrevious,
  isSubmitting = false 
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
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Guest Agreement
        </h2>
        <p className="text-gray-600">
          Please review and accept our terms and conditions
        </p>
      </div>

      {/* Agreement Text */}
      <div className="bg-white border border-gray-300 rounded-lg mb-6">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center">
            <FileText className="w-5 h-5 text-gray-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">
              Terms and Conditions
            </h3>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Please scroll through the entire document before accepting
          </p>
        </div>
        
        <div 
          className="p-6 max-h-96 overflow-y-auto"
          onScroll={handleScroll}
        >
          <div className="prose prose-sm max-w-none">
            {formatAgreementText(GUEST_AGREEMENT_TEMPLATE)}
          </div>
        </div>
        
        {!hasReadAgreement && (
          <div className="p-4 border-t border-gray-200 bg-yellow-50">
            <div className="flex items-center">
              <AlertCircle className="w-4 h-4 text-yellow-600 mr-2" />
              <p className="text-sm text-yellow-800">
                Please scroll to the bottom of the agreement to continue
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Agreement Acceptance */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start">
          <input
            type="checkbox"
            id="agreement"
            checked={agreementAccepted}
            onChange={(e) => handleAgreementChange(e.target.checked)}
            disabled={!hasReadAgreement}
            className="mt-1 mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
          />
          <label htmlFor="agreement" className="text-sm text-gray-700">
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Success Indicator */}
      {hasReadAgreement && agreementAccepted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-800">
              Thank you for reviewing and accepting our guest agreement. You're ready to complete your check-in!
            </p>
          </div>
        </div>
      )}

      {/* Final Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          What happens next?
        </h4>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Your check-in information will be submitted for review</li>
          <li>• You'll receive a confirmation email with property access details</li>
          <li>• Property management will verify your information</li>
          <li>• You'll be notified when your check-in is approved</li>
        </ul>
      </div>

      <StepNavigation
        currentStep={4}
        totalSteps={4}
        onNext={handleSubmit}
        onPrevious={onPrevious}
        isNextDisabled={!agreementAccepted || !hasReadAgreement}
        isLoading={isSubmitting}
        nextButtonText="Complete Check-in"
      />
    </div>
  )
}




