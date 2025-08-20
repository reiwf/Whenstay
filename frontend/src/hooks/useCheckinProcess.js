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
      
      // Handle the response structure from API (now includes multi-guest data)
      const reservationData = response.data.reservation
      const guestsData = response.data.guests || []
      const allGuestsCompleted = response.data.allGuestsCompleted || false
      
      if (!reservationData) {
        throw new Error('No reservation data found in response')
      }
      
      setReservation(reservationData)
      setCheckinCompleted(allGuestsCompleted)
      setExistingCheckin(response.data.checkin || null)
      
      // Set guest data with multi-guest support
      setGuestData({
        guests: guestsData,
        primaryGuest: guestsData.find(g => g.isPrimaryGuest) || guestsData[0],
        allCompleted: allGuestsCompleted,
        // Legacy compatibility
        ...guestsData.find(g => g.isPrimaryGuest) || guestsData[0] || {}
      })
      
      // Pre-populate form data with multi-guest structure
      const primaryGuest = guestsData.find(g => g.isPrimaryGuest) || guestsData[0]
      
      if (primaryGuest || response.data.guestData) {
        const guestInfo = primaryGuest || response.data.guestData
        setFormData(prev => ({
          ...prev,
          // Primary guest data for backward compatibility
          firstName: guestInfo.firstName || '',
          lastName: guestInfo.lastName || '',
          personalEmail: guestInfo.personalEmail || '',
          contactNumber: guestInfo.contactNumber || '',
          address: guestInfo.address || '',
          estimatedCheckinTime: guestInfo.estimatedCheckinTime || '',
          travelPurpose: guestInfo.travelPurpose || '',
          emergencyContactName: guestInfo.emergencyContactName || '',
          emergencyContactPhone: guestInfo.emergencyContactPhone || '',
          passportUrl: guestInfo.passportUrl || null,
          agreementAccepted: guestInfo.agreementAccepted || false,
          // Multi-guest arrays
          guests: guestsData.map(guest => ({
            guestNumber: guest.guestNumber || 1,
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            personalEmail: guest.personalEmail || '',
            contactNumber: guest.contactNumber || '',
            address: guest.address || '',
            estimatedCheckinTime: guest.estimatedCheckinTime || '',
            travelPurpose: guest.travelPurpose || '',
            emergencyContactName: guest.emergencyContactName || '',
            emergencyContactPhone: guest.emergencyContactPhone || '',
            isPrimaryGuest: guest.isPrimaryGuest || guest.guestNumber === 1,
            isCompleted: guest.isCompleted || false
          })),
          guestDocuments: guestsData.map(guest => ({
            guestNumber: guest.guestNumber || 1,
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            passportUrl: guest.passportUrl || null,
            hasDocument: !!guest.passportUrl,
            isPrimaryGuest: guest.isPrimaryGuest || guest.guestNumber === 1
          }))
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

      // Prepare multi-guest submission data
      const guests = formData.guests || []
      const numGuests = reservation?.numGuests || 1

      // Build guests array with documents
      const guestsWithDocuments = []
      for (let i = 1; i <= numGuests; i++) {
        const guestInfo = guests.find(g => g.guestNumber === i) || formData
        const guestDocuments = formData.guestDocuments || []
        const guestDoc = guestDocuments.find(d => d.guestNumber === i)

        guestsWithDocuments.push({
          firstName: guestInfo.firstName || (i === 1 ? formData.firstName : ''),
          lastName: guestInfo.lastName || (i === 1 ? formData.lastName : ''),
          personalEmail: i === 1 ? (guestInfo.personalEmail || formData.personalEmail) : null,
          contactNumber: i === 1 ? (guestInfo.contactNumber || formData.contactNumber) : null,
          address: i === 1 ? (guestInfo.address || formData.address) : null,
          estimatedCheckinTime: i === 1 ? (guestInfo.estimatedCheckinTime || formData.estimatedCheckinTime) : null,
          travelPurpose: i === 1 ? (guestInfo.travelPurpose || formData.travelPurpose) : null,
          emergencyContactName: i === 1 ? (guestInfo.emergencyContactName || formData.emergencyContactName) : null,
          emergencyContactPhone: i === 1 ? (guestInfo.emergencyContactPhone || formData.emergencyContactPhone) : null,
          passportUrl: guestDoc?.passportUrl || (i === 1 ? formData.passportUrl : null)
        })
      }

      const submissionData = {
        guests: guestsWithDocuments,
        agreementAccepted: formData.agreementAccepted.toString(),
        submittedAt: new Date().toISOString(),
        isModification: isModificationMode
      }

      console.log('Submitting multi-guest check-in with token:', reservationId, 'and data:', submissionData)

      // Use new bulk submission endpoint
      const response = await fetch(`/api/checkin/${reservationId}/submit-all-guests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit check-in')
      }

      const responseData = await response.json()
      console.log('Submit response:', responseData)

      // Check if submission was successful
      if (responseData.message && responseData.data) {
        const successMessage = isModificationMode 
          ? 'Check-in information updated successfully!' 
          : responseData.data.allGuestsComplete
            ? 'All guests check-in completed successfully!'
            : 'Guest information submitted successfully!'
        
        toast.success(successMessage)
        
        // If this was a modification, exit modification mode and reload data
        if (isModificationMode) {
          setIsModificationMode(false)
          await loadReservation()
        }
        
        return {
          success: true,
          checkinId: responseData.data.processedGuests?.[0]?.id,
          allGuestsComplete: responseData.data.allGuestsComplete,
          completion: responseData.data.completion,
          message: isModificationMode 
            ? 'Your check-in information has been updated.'
            : responseData.data.allGuestsComplete
              ? 'All guests have completed check-in!'
              : 'Guest information submitted and pending completion.'
        }
      } else {
        throw new Error(responseData.message || 'Failed to submit check-in')
      }
      
    } catch (error) {
      console.error('Error submitting check-in:', error)
      const errorMessage = error.message || 'Failed to submit check-in'
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
        // Validate multi-guest forms
        const guests = formData.guests || []
        const numGuests = reservation?.numGuests || 1
        
        // Check if we have all required guests with required fields
        for (let i = 1; i <= numGuests; i++) {
          const guest = guests.find(g => g.guestNumber === i) || (i === 1 ? formData : {})
          
          // All guests need first and last name
          if (!guest.firstName?.trim() || !guest.lastName?.trim()) {
            return false
          }
          
          // Primary guest needs additional info
          if (i === 1) {
            if (!guest.personalEmail?.trim() || 
                !guest.contactNumber?.trim() ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.personalEmail)) {
              return false
            }
          }
        }
        return true
      
      case 3:
        // Validate all guests have documents
        const guestDocuments = formData.guestDocuments || []
        const numGuestsStep3 = reservation?.numGuests || 1
        
        for (let i = 1; i <= numGuestsStep3; i++) {
          const guestDoc = guestDocuments.find(d => d.guestNumber === i)
          const hasDoc = guestDoc?.passportUrl || guestDoc?.hasDocument || (i === 1 && formData.passportUrl)
          if (!hasDoc) {
            return false
          }
        }
        return true
      
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
