import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'

export function useAdminData() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [checkins, setCheckins] = useState([])

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load dashboard stats and recent check-ins
      const [statsResponse, checkinsResponse] = await Promise.all([
        adminAPI.getDashboardStats(),
        adminAPI.getCheckins({ limit: 10 })
      ])
      
      setStats(statsResponse.data)
      setCheckins(checkinsResponse.data.checkins)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const createTestReservation = useCallback(async () => {
    try {
      const testData = {
        guestName: 'Test Guest',
        guestEmail: 'test@example.com',
        checkInDate: new Date().toISOString().split('T')[0],
        checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        roomNumber: '101'
      }
      
      const response = await fetch('/api/reservations/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
      })
      
      if (response.ok) {
        const result = await response.json()
        console.log('Check-in URL:', result.reservation.checkinUrl)
        await loadDashboardData()
        return result
      }
    } catch (error) {
      console.error('Error creating test reservation:', error)
      throw error
    }
  }, [loadDashboardData])

  const syncBeds24 = useCallback(async () => {
    try {
      await adminAPI.syncBeds24(7)
      await loadDashboardData()
    } catch (error) {
      console.error('Sync error:', error)
      throw error
    }
  }, [loadDashboardData])

  return {
    loading,
    stats,
    checkins,
    loadDashboardData,
    createTestReservation,
    syncBeds24
  }
}




