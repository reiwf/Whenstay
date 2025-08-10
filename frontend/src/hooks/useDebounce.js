import { useState, useEffect } from 'react'

/**
 * Custom hook for debouncing values
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {any} - The debounced value
 */
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Custom hook for debounced API calls with loading state
 * @param {Function} apiCall - The API function to call
 * @param {any} filters - The filters object to watch
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Object} - { data, loading, error, refetch }
 */
export function useDebouncedApiCall(apiCall, filters, delay = 300) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const debouncedFilters = useDebounce(filters, delay)

  const fetchData = async (currentFilters = debouncedFilters) => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiCall(currentFilters)
      setData(response.data)
    } catch (err) {
      setError(err)
      console.error('API call failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (debouncedFilters) {
      fetchData(debouncedFilters)
    }
  }, [debouncedFilters])

  const refetch = () => fetchData()

  return { data, loading, error, refetch }
}

export default useDebounce
