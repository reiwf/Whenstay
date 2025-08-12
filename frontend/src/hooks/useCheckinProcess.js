import { useState, useEffect } from 'react'
import { checkinAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useCheckinProcess(reservationId) {
  const [currentStep, setCurrentStep] = useState(1)
  const [reservation, setReservation] = useState(null)
  const [checkinCompleted, setCheckinCompleted] = useState(false)
  const [existingCheckin, setExistingCheckin] = useState(null)
  const [guestData, setGuestData] = useState(null)
  const [isModificationMode, setIsModificationMode] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    personalEmail: '',
    contactNumber: '',
    address: '',
    estimatedCheckinTime: '',
    travelPurpose: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    passportFile: null,
    passportUrl: null,
    agreementAccepted: false
  })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Load reservation data on mount
  useEffect(() => {
    if (reservationId) {
      loadReservation()
    }
  }, [reservationId])

  const loadReservation = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('Loading reservation with token:', reservationId)
      const response = await checkinAPI.getReservation(reservationId)
      console.log('API response:', response.data)
      
      // Handle the response structure from API
      const reservationData = response.data.reservation
      
      if (!reservationData) {
        throw new Error('No reservation data found in response')
      }
      
      setReservation(reservationData)
      setCheckinCompleted(response.data.checkinCompleted || false)
      setExistingCheckin(response.data.checkin || null)
      setGuestData(response.data.guestData || null)
      
      // If check-in is completed, we can pre-populate form data for potential modifications
      if (response.data.checkinCompleted && response.data.guestData) {
        const guestData = response.data.guestData
        setFormData(prev => ({
          ...prev,
          firstName: guestData.firstName || '',
          lastName: guestData.lastName || '',
          personalEmail: guestData.personalEmail || '',
          contactNumber: guestData.contactNumber || '',
          address: guestData.address || '',
          estimatedCheckinTime: guestData.estimatedCheckinTime || '',
          travelPurpose: guestData.travelPurpose || '',
          emergencyContactName: guestData.emergencyContactName || '',
          emergencyContactPhone: guestData.emergencyContactPhone || '',
          passportUrl: guestData.passportUrl || null,
          agreementAccepted: guestData.agreementAccepted || false
        }))
      }
      
    } catch (error) {
      console.error('Error loading reservation:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load reservation details. Please check your link and try again.'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const nextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    }
  }

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const enterModificationMode = () => {
    setIsModificationMode(true)
    setCurrentStep(1)
    toast.info('You are now modifying your existing check-in information.')
  }

  const exitModificationMode = () => {
    setIsModificationMode(false)
    setCurrentStep(1)
    // Reset form data to original values
    if (guestData) {
      setFormData(prev => ({
        ...prev,
        firstName: guestData.firstName || '',
        lastName: guestData.lastName || '',
        personalEmail: guestData.personalEmail || '',
        contactNumber: guestData.contactNumber || '',
        address: guestData.address || '',
        estimatedCheckinTime: guestData.estimatedCheckinTime || '',
        travelPurpose: guestData.travelPurpose || '',
        emergencyContactName: guestData.emergencyContactName || '',
        emergencyContactPhone: guestData.emergencyContactPhone || '',
        passportUrl: guestData.passportUrl || null,
        agreementAccepted: guestData.agreementAccepted || false
      }))
    }
  }

  const submitCheckin = async () => {
    try {
      setSubmitting(true)
      setError(null)

      // Prepare submission data
      const submissionData = {
        guestInfo: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          personalEmail: formData.personalEmail,
          contactNumber: formData.contactNumber,
          address: formData.address,
          estimatedCheckinTime: formData.estimatedCheckinTime,
          travelPurpose: formData.travelPurpose,
          emergencyContactName: formData.emergencyContactName,
          emergencyContactPhone: formData.emergencyContactPhone
        },
        passportUrl: formData.passportUrl,
        agreementAccepted: formData.agreementAccepted.toString(),
        submittedAt: new Date().toISOString(),
        isModification: isModificationMode
      }

      console.log('Submitting check-in with token:', reservationId, 'and data:', submissionData)

      // Submit check-in data with token
      const response = await checkinAPI.submitCheckin(reservationId, submissionData)
      
      console.log('Submit response:', response.data)

      // The API returns different structure
      if (response.data.message === 'Check-in completed successfully') {
        const successMessage = isModificationMode 
          ? 'Check-in information updated successfully!' 
          : 'Check-in submitted successfully!'
        toast.success(successMessage)
        
        // If this was a modification, exit modification mode and reload data
        if (isModificationMode) {
          setIsModificationMode(false)
          await loadReservation()
        }
        
        return {
          success: true,
          checkinId: response.data.checkin?.id,
          message: isModificationMode 
            ? 'Your check-in information has been updated.'
            : 'Your check-in has been submitted and is pending review.'
        }
      } else {
        throw new Error(response.data.message || 'Failed to submit check-in')
      }
      
    } catch (error) {
      console.error('Error submitting check-in:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Failed to submit check-in'
      setError(errorMessage)
      toast.error(errorMessage)
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setSubmitting(false)
    }
  }

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return true // No validation needed for overview
      
      case 2:
        return (
          formData.firstName?.trim() &&
          formData.lastName?.trim() &&
          formData.personalEmail?.trim() &&
          formData.contactNumber?.trim() &&
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.personalEmail)
        )
      
      case 3:
        return formData.passportFile || formData.passportUrl
      
      case 4:
        return formData.agreementAccepted
      
      default:
        return false
    }
  }

  return {
    // State
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
    
    // Actions
    updateFormData,
    nextStep,
    previousStep,
    submitCheckin,
    loadReservation,
    enterModificationMode,
    exitModificationMode,
    
    // Computed
    validateCurrentStep,
    isValid: validateCurrentStep(),
    totalSteps: 4
  }
}

export default useCheckinProcess




