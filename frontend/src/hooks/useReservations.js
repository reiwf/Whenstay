import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useReservations() {
  const [loading, setLoading] = useState(false)
  const [reservations, setReservations] = useState([])
  const [stats, setStats] = useState(null)
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

      const [reservationsResponse, statsResponse] = await Promise.all([
        adminAPI.getReservations(params),
        adminAPI.getReservationStats(filters)
      ])

      setReservations(reservationsResponse.data.reservations)
      setStats(statsResponse.data.stats)
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
      
      // Call the API to update the reservation
      await adminAPI.updateReservation(reservationId, reservationData)
      
      // Update the local state
      setReservations(prev => 
        prev.map(reservation => 
          reservation.id === reservationId 
            ? { ...reservation, ...reservationData }
            : reservation
        )
      )
      
      toast.success('Reservation updated successfully')
      return true
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
      
      const response = await adminAPI.createReservation(reservationData)
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
    stats,
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




