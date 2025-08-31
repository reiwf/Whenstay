import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useThreadManagement() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [searchResults, setSearchResults] = useState([])

  // Link a thread to a reservation
  const linkThread = useCallback(async (threadId, reservationId) => {
    try {
      setLoading(true)
      const response = await adminAPI.linkThread(threadId, reservationId)
      
      toast.success('Thread linked successfully')
      return response.data.thread
    } catch (error) {
      console.error('Error linking thread:', error)
      const message = error.response?.data?.error || 'Failed to link thread'
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Merge one thread into another
  const mergeThreads = useCallback(async (sourceThreadId, targetThreadId) => {
    try {
      setLoading(true)
      const response = await adminAPI.mergeThreads(sourceThreadId, targetThreadId)
      
      toast.success('Threads merged successfully')
      return response.data
    } catch (error) {
      console.error('Error merging threads:', error)
      const message = error.response?.data?.error || 'Failed to merge threads'
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Get linking suggestions for a thread
  const getThreadSuggestions = useCallback(async (threadId) => {
    try {
      setLoading(true)
      const response = await adminAPI.getThreadSuggestions(threadId)
      const suggestionsData = response.data.suggestions || []
      
      setSuggestions(suggestionsData)
      return suggestionsData
    } catch (error) {
      console.error('Error getting thread suggestions:', error)
      setSuggestions([])
      const message = error.response?.data?.error || 'Failed to get suggestions'
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Search reservations for manual linking
  const searchReservations = useCallback(async (query, filters = {}) => {
    try {
      setLoading(true)
      const params = {
        search: query,
        limit: 20,
        ...filters
      }
      
      const response = await adminAPI.getReservations(params)
      const results = response.data.reservations || []
      
      setSearchResults(results)
      return results
    } catch (error) {
      console.error('Error searching reservations:', error)
      setSearchResults([])
      const message = error.response?.data?.error || 'Failed to search reservations'
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Reject/mark thread as spam
  const rejectThread = useCallback(async (threadId, reason = 'spam') => {
    try {
      setLoading(true)
      const response = await adminAPI.rejectThread(threadId, reason)
      
      toast.success(`Thread marked as ${reason}`)
      return response.data.thread
    } catch (error) {
      console.error('Error rejecting thread:', error)
      const message = error.response?.data?.error || 'Failed to reject thread'
      toast.error(message)
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Clear suggestions and search results
  const clearResults = useCallback(() => {
    setSuggestions([])
    setSearchResults([])
  }, [])

  return {
    // State
    loading,
    suggestions,
    searchResults,

    // Actions
    linkThread,
    mergeThreads,
    getThreadSuggestions,
    searchReservations,
    rejectThread,
    clearResults,

    // State setters for manual control
    setSuggestions,
    setSearchResults
  }
}

export default useThreadManagement
