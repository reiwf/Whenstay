import { useState, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function usePricingApi(roomTypeId) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  const handleRequest = useCallback(async (requestFn) => {
    // Prevent multiple concurrent requests
    if (loading) {
      console.warn('Request already in progress, skipping...');
      return null;
    }
    
    setLoading(true);
    setError(null);
    try {
      const result = await requestFn();
      console.log('API request successful:', result);
      return result;
    } catch (err) {
      const errorMsg = err.message || 'An error occurred';
      console.error('API request failed:', err);
      setError(errorMsg);
      
      // Don't throw for auth errors to prevent crashes
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        console.error('Authentication error:', errorMsg);
        return null;
      }
      
      // Return null for other errors instead of throwing to prevent infinite loading
      return null;
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const apiCall = useCallback(async (endpoint, options = {}) => {
    const token = localStorage.getItem('authToken');
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, []);

  // Get pricing rules for room type
  const getRules = useCallback(async () => {
    return handleRequest(async () => {
      return await apiCall(`/pricing/rules/${roomTypeId}`);
    });
  }, [roomTypeId, apiCall, handleRequest]);

  // Update pricing rules
  const updateRules = useCallback(async (rulesData) => {
    return handleRequest(async () => {
      return await apiCall(`/pricing/rules/${roomTypeId}`, {
        method: 'PUT',
        body: JSON.stringify(rulesData)
      });
    });
  }, [roomTypeId, apiCall, handleRequest]);

  // Run pricing calculation for date range
  const runPricing = useCallback(async (from, to) => {
    return handleRequest(async () => {
      return await apiCall('/pricing/run', {
        method: 'POST',
        body: JSON.stringify({ roomTypeId, from, to })
      });
    });
  }, [roomTypeId, apiCall, handleRequest]);

  // Get calendar data
  const getCalendar = useCallback(async (from, to) => {
    return handleRequest(async () => {
      const params = new URLSearchParams({ roomTypeId, from, to });
      return await apiCall(`/pricing/calendar?${params}`);
    });
  }, [roomTypeId, apiCall, handleRequest]);

  // Set price override
  const setOverride = useCallback(async (date, price, locked = false) => {
    return handleRequest(async () => {
      return await apiCall('/pricing/override', {
        method: 'POST',
        body: JSON.stringify({ roomTypeId, date, price, locked })
      });
    });
  }, [roomTypeId, apiCall, handleRequest]);

  // Get price breakdown for specific date
  const getBreakdown = useCallback(async (date) => {
    return handleRequest(async () => {
      const params = new URLSearchParams({ roomTypeId, date });
      return await apiCall(`/pricing/breakdown?${params}`);
    });
  }, [roomTypeId, apiCall, handleRequest]);

  return {
    loading,
    error,
    clearError,
    getRules,
    updateRules,
    runPricing,
    getCalendar,
    setOverride,
    getBreakdown
  };
}

export default usePricingApi;
