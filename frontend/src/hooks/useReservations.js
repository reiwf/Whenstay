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
      
      // Increase limit significantly when date range is specified
      const hasDateRange = filters.checkInDateFrom && filters.checkInDateTo;
      const limit = hasDateRange ? 500 : 50; // Much higher limit for date ranges
      
      const params = {
        ...filters,
        page,
        limit
      }

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') {
          delete params[key]
        }
      })

      const reservationsResponse = await adminAPI.getReservations(params)

      // Handle the updated API response structure
      // Backend returns: { data: { reservations: [], pagination: {} } }
      const responseData = reservationsResponse.data || {}
      const reservationsData = responseData.data?.reservations || responseData.reservations || []
      const paginationData = responseData.data?.pagination || responseData.pagination || {}

      setReservations(reservationsData)
      setHasMore(paginationData.hasMore || false)
      setCurrentPage(page)
      
      return {
        reservations: reservationsData,
        pagination: paginationData
      }
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
        bookingFirstname: reservationData.bookingFirstname,
        bookingLastname: reservationData.bookingLastname,
        bookingEmail: reservationData.bookingEmail || reservationData.guestEmail,
        phoneNumber: reservationData.bookingPhone || reservationData.phoneNumber,
        
        // Stay details
        checkInDate: reservationData.checkInDate,
        checkOutDate: reservationData.checkOutDate,
        numGuests: reservationData.numGuests,
        numAdults: reservationData.numAdults,
        numChildren: reservationData.numChildren,
        totalAmount: reservationData.totalAmount,
        price: reservationData.price,
        commission: reservationData.commission,
        currency: reservationData.currency,
        status: reservationData.status,
        specialRequests: reservationData.specialRequests,
        bookingSource: reservationData.bookingSource,
        comments: reservationData.comments,
        beds24BookingId: reservationData.beds24BookingId,
        
        // Beds24 webhook specific fields
        apiReference: reservationData.apiReference,
        rateDescription: reservationData.rateDescription,
        apiMessage: reservationData.apiMessage,
        bookingTime: reservationData.bookingTime,
        timeStamp: reservationData.timeStamp,
        lang: reservationData.lang,
        
        // Room assignment (V5 schema)
        propertyId: reservationData.propertyId,
        roomTypeId: reservationData.roomTypeId,
        roomUnitId: reservationData.roomUnitId,
        roomId: reservationData.roomId, // Legacy support
        
        // Group booking fields
        bookingGroupMasterId: reservationData.bookingGroupMasterId,
        isGroupMaster: reservationData.isGroupMaster,
        groupRoomCount: reservationData.groupRoomCount,
        bookingGroupIds: reservationData.bookingGroupIds,
        
        // Guest personal information (guest_* fields in DB)
        guestFirstname: reservationData.guestFirstname,
        guestLastname: reservationData.guestLastname,
        guestMail: reservationData.guestMail,
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
        adminVerified: reservationData.adminVerified,
        accessRead: reservationData.accessRead
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
        bookingFirstname: reservationData.bookingFirstname,
        bookingLastname: reservationData.bookingLastname,
        bookingEmail: reservationData.bookingEmail || reservationData.guestEmail,
        phoneNumber: reservationData.bookingPhone || reservationData.phoneNumber,
        
        // Stay details
        checkInDate: reservationData.checkInDate,
        checkOutDate: reservationData.checkOutDate,
        numGuests: reservationData.numGuests,
        numAdults: reservationData.numAdults,
        numChildren: reservationData.numChildren,
        totalAmount: reservationData.totalAmount,
        price: reservationData.price,
        commission: reservationData.commission,
        currency: reservationData.currency,
        status: reservationData.status,
        specialRequests: reservationData.specialRequests,
        bookingSource: reservationData.bookingSource,
        comments: reservationData.comments,
        beds24BookingId: reservationData.beds24BookingId || `MANUAL-${Date.now()}`,
        
        // Beds24 webhook specific fields
        apiReference: reservationData.apiReference,
        rateDescription: reservationData.rateDescription,
        apiMessage: reservationData.apiMessage,
        bookingTime: reservationData.bookingTime,
        timeStamp: reservationData.timeStamp,
        lang: reservationData.lang,
        
        // Room assignment (V5 schema)
        propertyId: reservationData.propertyId,
        roomTypeId: reservationData.roomTypeId,
        roomUnitId: reservationData.roomUnitId,
        roomId: reservationData.roomId, // Legacy support
        
        // Group booking fields
        bookingGroupMasterId: reservationData.bookingGroupMasterId,
        isGroupMaster: reservationData.isGroupMaster,
        groupRoomCount: reservationData.groupRoomCount,
        bookingGroupIds: reservationData.bookingGroupIds,
        
        // Guest personal information (guest_* fields in DB)
        guestFirstname: reservationData.guestFirstname,
        guestLastname: reservationData.guestLastname,
        guestMail: reservationData.guestMail,
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
        adminVerified: reservationData.adminVerified,
        accessRead: reservationData.accessRead
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
