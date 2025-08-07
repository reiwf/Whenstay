import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useReservations() {
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Load reservations with filters
  const loadReservations = useCallback(async (filters = {}, page = 1) => {
    try {
      setLoading(true)
      
      const params = {
        ...filters,
        page,
        limit: 20
      }

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') {
          delete params[key]
        }
      })

      const reservationsResponse = await adminAPI.getReservations(params)

      setReservations(reservationsResponse.data.reservations)
      setHasMore(reservationsResponse.data.pagination.hasMore)
      setCurrentPage(page)
      
      return reservationsResponse.data
    } catch (error) {
      console.error('Error loading reservations:', error)
      toast.error('Failed to load reservations')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Update reservation
  const updateReservation = useCallback(async (reservationId, reservationData) => {
    try {
      setLoading(true)
      
      console.log('Updating reservation:', reservationId, reservationData)
      
      // Map frontend data to backend expected format
      const mappedData = {
        // Basic booking information (maps to booking_* fields in DB)
        guestName: reservationData.bookingName || reservationData.guestName,
        guestEmail: reservationData.bookingEmail || reservationData.guestEmail,
        phoneNumber: reservationData.bookingPhone || reservationData.phoneNumber,
        
        // Stay details
        checkInDate: reservationData.checkInDate,
        checkOutDate: reservationData.checkOutDate,
        numGuests: reservationData.numGuests,
        numAdults: reservationData.numAdults,
        numChildren: reservationData.numChildren,
        totalAmount: reservationData.totalAmount,
        currency: reservationData.currency,
        status: reservationData.status,
        specialRequests: reservationData.specialRequests,
        bookingSource: reservationData.bookingSource,
        beds24BookingId: reservationData.beds24BookingId,
        
        // Room assignment (V5 schema)
        propertyId: reservationData.propertyId,
        roomTypeId: reservationData.roomTypeId,
        roomUnitId: reservationData.roomUnitId,
        roomId: reservationData.roomId, // Legacy support
        
        // Guest personal information (guest_* fields in DB)
        guestFirstname: reservationData.guestFirstname,
        guestLastname: reservationData.guestLastname,
        guestPersonalEmail: reservationData.guestPersonalEmail,
        guestContact: reservationData.guestContact,
        guestAddress: reservationData.guestAddress,
        
        // Check-in details
        estimatedCheckinTime: reservationData.estimatedCheckinTime,
        travelPurpose: reservationData.travelPurpose,
        passportUrl: reservationData.passportUrl,
        
        // Emergency contact
        emergencyContactName: reservationData.emergencyContactName,
        emergencyContactPhone: reservationData.emergencyContactPhone,
        
        // Administrative
        agreementAccepted: reservationData.agreementAccepted,
        adminVerified: reservationData.adminVerified
      }
      
      // Call the API to update the reservation
      const response = await adminAPI.updateReservation(reservationId, mappedData)
      
      // Update the local state with the returned data
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === reservationId 
            ? { ...reservation, ...response.data.reservation }
            : reservation
        )
      )
      
      toast.success('Reservation updated successfully')
      return response.data.reservation
    } catch (error) {
      console.error('Error updating reservation:', error)
      console.error('Error details:', error.response?.data)
      console.error('Error status:', error.response?.status)
      console.error('Error message:', error.message)
      
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update reservation'
      toast.error(errorMessage)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Create new reservation
  const createReservation = useCallback(async (reservationData) => {
    try {
      setLoading(true)
      
      // Map frontend data to backend expected format
      const mappedData = {
        // Basic booking information
        guestName: reservationData.bookingName || reservationData.guestName,
        guestEmail: reservationData.bookingEmail || reservationData.guestEmail,
        phoneNumber: reservationData.bookingPhone || reservationData.phoneNumber,
        
        // Stay details
        checkInDate: reservationData.checkInDate,
        checkOutDate: reservationData.checkOutDate,
        numGuests: reservationData.numGuests,
        numAdults: reservationData.numAdults,
        numChildren: reservationData.numChildren,
        totalAmount: reservationData.totalAmount,
        currency: reservationData.currency,
        specialRequests: reservationData.specialRequests,
        bookingSource: reservationData.bookingSource,
        beds24BookingId: reservationData.beds24BookingId || `MANUAL-${Date.now()}`,
        
        // Room assignment (V5 schema)
        propertyId: reservationData.propertyId,
        roomTypeId: reservationData.roomTypeId,
        roomUnitId: reservationData.roomUnitId,
        roomId: reservationData.roomId // Legacy support
      }
      
      const response = await adminAPI.createReservation(mappedData)
      const newReservation = response.data.reservation
      
      // Add to local state
      setReservations(prev => [newReservation, ...prev])
      
      toast.success('Reservation created successfully')
      return newReservation
    } catch (error) {
      console.error('Error creating reservation:', error)
      toast.error('Failed to create reservation')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Delete reservation
  const deleteReservation = useCallback(async (reservationId) => {
    try {
      setLoading(true)
      
      await adminAPI.deleteReservation(reservationId)
      
      // Remove from local state
      setReservations(prev => 
        prev.filter(reservation => reservation.id !== reservationId)
      )
      
      toast.success('Reservation deleted successfully')
      return true
    } catch (error) {
      console.error('Error deleting reservation:', error)
      toast.error('Failed to delete reservation')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Send invitation
  const sendInvitation = useCallback(async (reservationId) => {
    try {
      await adminAPI.sendInvitation(reservationId)
      
      // Update the reservation status in local state
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === reservationId 
            ? { ...reservation, status: 'invited' }
            : reservation
        )
      )
      
      toast.success('Invitation sent successfully')
      return true
    } catch (error) {
      console.error('Error sending invitation:', error)
      toast.error('Failed to send invitation')
      throw error
    }
  }, [])

  // Get reservation details
  const getReservationDetails = useCallback(async (reservationId) => {
    try {
      const response = await adminAPI.getReservationDetails(reservationId)
      return response.data.reservation
    } catch (error) {
      console.error('Error getting reservation details:', error)
      toast.error('Failed to load reservation details')
      throw error
    }
  }, [])

  // Refresh current page
  const refresh = useCallback(async (filters = {}) => {
    return loadReservations(filters, currentPage)
  }, [loadReservations, currentPage])

  // Reset pagination
  const resetPagination = useCallback(() => {
    setCurrentPage(1)
    setHasMore(false)
  }, [])

  return {
    // State
    loading,
    reservations,
    currentPage,
    hasMore,
    
    // Actions
    loadReservations,
    updateReservation,
    createReservation,
    deleteReservation,
    sendInvitation,
    getReservationDetails,
    refresh,
    resetPagination,
    
    // Pagination helpers
    setCurrentPage
  }
}

export default useReservations
