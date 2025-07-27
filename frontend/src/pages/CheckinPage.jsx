import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useCheckinProcess } from '../hooks/useCheckinProcess'
import CheckinLayout from '../components/checkin/shared/CheckinLayout'
import Step1ReservationOverview from '../components/checkin/steps/Step1ReservationOverview'
import Step2GuestInformation from '../components/checkin/steps/Step2GuestInformation'
import Step3DocumentUpload from '../components/checkin/steps/Step3DocumentUpload'
import Step4Agreement from '../components/checkin/steps/Step4Agreement'
import LoadingSpinner from '../components/LoadingSpinner'
import { CheckCircle } from 'lucide-react'

export default function CheckinPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  
  const {
    currentStep,
    reservation,
    formData,
    loading,
    submitting,
    error,
    checkinCompleted,
    existingCheckin,
    guestData,
    isModificationMode,
    updateFormData,
    nextStep,
    previousStep,
    submitCheckin,
    enterModificationMode,
    exitModificationMode,
    getStepTitle,
    getStepSubtitle
  } = useCheckinProcess(token)

  const handleSubmit = async () => {
    const result = await submitCheckin()
    if (result.success) {
      // Navigate to success page or show success state
      navigate(`/checkin/${token}/success`, { 
        state: { checkinId: result.checkinId } 
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-red-900 mb-4">
              Check-in Error
            </h1>
            <p className="text-red-800 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/')}
              className="btn-primary"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Reservation Not Found
          </h1>
          <p className="text-gray-600 mb-8">
            The reservation you're looking for could not be found or the link may have expired.
          </p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <CheckinLayout
      currentStep={currentStep}
      title={getStepTitle()}
      subtitle={getStepSubtitle()}
    >
      {currentStep === 1 && (
        <Step1ReservationOverview 
          reservation={reservation} 
          onNext={nextStep}
          checkinCompleted={checkinCompleted}
          existingCheckin={existingCheckin}
          guestData={guestData}
          isModificationMode={isModificationMode}
          onEnterModificationMode={enterModificationMode}
          onExitModificationMode={exitModificationMode}
        />
      )}
      
      {currentStep === 2 && (
        <Step2GuestInformation
          reservation={reservation}
          formData={formData}
          onUpdateFormData={updateFormData}
          onNext={nextStep}
          onPrevious={previousStep}
        />
      )}
      
      {currentStep === 3 && (
        <Step3DocumentUpload
          formData={formData}
          onUpdateFormData={updateFormData}
          onNext={nextStep}
          onPrevious={previousStep}
        />
      )}
      
      {currentStep === 4 && (
        <Step4Agreement
          formData={formData}
          onUpdateFormData={updateFormData}
          onSubmit={handleSubmit}
          onPrevious={previousStep}
          isSubmitting={submitting}
        />
      )}
    </CheckinLayout>
  )
}

// Success Page Component (can be moved to separate file later)
export function CheckinSuccessPage() {
  const { reservationId } = useParams()
  const navigate = useNavigate()
  const { state } = useLocation()
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Check-in Submitted Successfully!
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Thank you for completing your check-in. Your information has been submitted 
            and is now being reviewed by our team.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">
              What happens next?
            </h2>
            <ul className="text-blue-800 space-y-2 text-left">
              <li>• Our team will review your submitted information</li>
              <li>• You'll receive a confirmation email once approved</li>
              <li>• Property access details will be provided upon approval</li>
              <li>• You can arrive at your scheduled check-in time</li>
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Need Help?
            </h3>
            <p className="text-gray-700 mb-4">
              If you have any questions or need to make changes to your check-in information, 
              please contact our support team.
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p><strong>Check-in ID:</strong> {state?.checkinId || 'N/A'}</p>
              <p><strong>Reservation ID:</strong> {reservationId}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/')}
              className="btn-secondary"
            >
              Return Home
            </button>
            <button
              onClick={() => navigate(`/guest-dashboard`)}
              className="btn-primary"
            >
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




