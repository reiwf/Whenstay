import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'

export function useAdminData() {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [todayStats, setTodayStats] = useState(null)
  const [todayArrivals, setTodayArrivals] = useState([])
  const [todayDepartures, setTodayDepartures] = useState([])
  const [inHouseGuests, setInHouseGuests] = useState([])

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

  const loadTodayDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load today's dashboard data
      const [todayStatsResponse, arrivalsResponse, departuresResponse, inHouseResponse] = await Promise.all([
        adminAPI.getTodayStats(),
        adminAPI.getTodayArrivals(),
        adminAPI.getTodayDepartures(),
        adminAPI.getInHouseGuests()
      ])
      
      setTodayStats(todayStatsResponse.data)
      setTodayArrivals(arrivalsResponse.data.arrivals || [])
      setTodayDepartures(departuresResponse.data.departures || [])
      setInHouseGuests(inHouseResponse.data.inHouseGuests || [])
    } catch (error) {
      console.error('Error loading today dashboard data:', error)
      // Set empty data on error
      setTodayStats({
        todayArrivals: 0,
        todayDepartures: 0,
        inHouseGuests: 0,
        pendingTodayCheckins: 0
      })
      setTodayArrivals([])
      setTodayDepartures([])
      setInHouseGuests([])
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
    todayStats,
    todayArrivals,
    todayDepartures,
    inHouseGuests,
    loadDashboardData,
    loadTodayDashboardData,
    syncBeds24
  }
}
