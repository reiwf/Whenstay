import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCheckinProcess } from '../../hooks/useCheckinProcess'
import CheckinLayout from '../checkin/shared/CheckinLayout'
import Step1ReservationOverview from '../checkin/steps/Step1ReservationOverview'
import Step2GuestInformation from '../checkin/steps/Step2GuestInformation'
import Step3DocumentUpload from '../checkin/steps/Step3DocumentUpload'
import Step4Agreement from '../checkin/steps/Step4Agreement'
import LoadingSpinner from '../LoadingSpinner'
import toast from 'react-hot-toast'

export default function CheckinModal({ 
  isOpen, 
  onClose, 
  token,
  onCheckInComplete 
}) {
  const { t } = useTranslation('guest')
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
  } = useCheckinProcess(token)

  const handleSubmit = async () => {
    const result = await submitCheckin()
    if (result.success) {
      // Show success message
      toast.success(result.message || t('checkinModal.checkinCompletedSuccessfully'), {
        duration: 5000,
        icon: '🎉'
      })
      
      // Close modal and notify parent
      onClose()
      
      // Trigger parent refresh
      if (onCheckInComplete) {
        onCheckInComplete()
      }
    }
  }

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-8">
          <LoadingSpinner size="large" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-red-900">{t('checkinModal.checkinError')}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-red-800 mb-4">{error}</p>
          <button
            onClick={onClose}
            className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
          >
            {t('checkinModal.close')}
          </button>
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">{t('checkinModal.reservationNotFound')}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-gray-600 mb-4">
            {t('checkinModal.reservationNotFoundMessage')}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
          >
            {t('checkinModal.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Close button - positioned outside overflow container */}
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-[80] p-2 rounded-full bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50 shadow-lg border border-gray-200"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Modal content - contains full check-in flow */}
          <div className="overflow-y-auto max-h-[90vh]">
            <CheckinLayout currentStep={currentStep}>
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
          </div>
        </div>
      </div>
    </div>
  )
}
