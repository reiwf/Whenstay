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
    syncBeds24
  }
}
