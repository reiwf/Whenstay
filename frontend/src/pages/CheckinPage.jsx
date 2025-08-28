import React from 'react'
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
    // Group booking state and functions
    groupBooking,
    isGroupBooking,
    groupCheckInMode,
    toggleGroupCheckInMode,
    submitGroupCheckin,
  } = useCheckinProcess(token)

  // Debug logging for CheckinPage props
  React.useEffect(() => {
    if (currentStep === 2) {
      console.log('🔍 CheckinPage Debug (Step 2):', {
        currentStep,
        isGroupBooking,
        groupCheckInMode,
        groupBooking: groupBooking ? {
          summary: groupBooking.summary,
          totalRooms: groupBooking.summary?.totalRooms || groupBooking.rooms?.length,
          hasRooms: !!groupBooking.rooms
        } : null
      })
    }
  }, [currentStep, isGroupBooking, groupCheckInMode, groupBooking])

  const handleSubmit = async () => {
    // Use appropriate submission method based on mode
    const result = groupCheckInMode 
      ? await submitGroupCheckin() 
      : await submitCheckin()
      
    if (result.success) {
      // Navigate to guest dashboard after successful check-in
      navigate(`/guest/${token}`, { 
        state: { 
          checkinId: result.checkinId,
          message: result.message,
          justCompleted: true,
          isGroupBooking: groupCheckInMode,
          allRoomsComplete: result.allRoomsComplete,
          allGuestsComplete: result.allGuestsComplete
        } 
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
            <h1 className="text-2xl sm:text-3xl font-bold text-red-900 mb-4">
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
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
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
          // Group booking props
          groupBooking={groupBooking}
          isGroupBooking={isGroupBooking}
          groupCheckInMode={groupCheckInMode}
          onToggleGroupCheckInMode={toggleGroupCheckInMode}
        />
      )}
      
      {currentStep === 2 && (
        <Step2GuestInformation
          reservation={reservation}
          formData={formData}
          onUpdateFormData={updateFormData}
          onNext={nextStep}
          onPrevious={previousStep}
          checkinCompleted={checkinCompleted}
          isModificationMode={isModificationMode}
          guestData={guestData}
          // Group booking props
          groupBooking={groupBooking}
          isGroupBooking={isGroupBooking}
          groupCheckInMode={groupCheckInMode}
        />
      )}
      
      {currentStep === 3 && (
        <Step3DocumentUpload
          formData={formData}
          onUpdateFormData={updateFormData}
          onNext={nextStep}
          onPrevious={previousStep}
          checkinCompleted={checkinCompleted}
          isModificationMode={isModificationMode}
          guestData={guestData}
          reservation={reservation}
          // Group booking props
          groupBooking={groupBooking}
          isGroupBooking={isGroupBooking}
          groupCheckInMode={groupCheckInMode}
        />
      )}
      
      {currentStep === 4 && (
        <Step4Agreement
          formData={formData}
          onUpdateFormData={updateFormData}
          onSubmit={handleSubmit}
          onPrevious={previousStep}
          isSubmitting={submitting}
          checkinCompleted={checkinCompleted}
          isModificationMode={isModificationMode}
        />
      )}
    </CheckinLayout>
  )
}
