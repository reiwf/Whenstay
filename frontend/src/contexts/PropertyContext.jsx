import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const PropertyContext = createContext();

export const useProperty = () => {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
};

export const PropertyProvider = ({ children }) => {
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const { isLoggedIn, loading: authLoading, user } = useAuth();

  // Load properties when authentication is confirmed
  useEffect(() => {
    // Only load properties if user is authenticated and auth is not loading
    if (isLoggedIn && !authLoading && user) {
      loadProperties();
    } else if (!authLoading && !isLoggedIn) {
      // Clear properties if user is not authenticated
      setProperties([]);
      setSelectedPropertyId(null);
      setLoading(false);
      setError(null);
    }
  }, [isLoggedIn, authLoading, user]);

  // Reset retry count when auth state changes
  useEffect(() => {
    setRetryCount(0);
  }, [isLoggedIn]);

  const loadProperties = async (isRetry = false) => {
    try {
      // Don't proceed if not authenticated
      if (!isLoggedIn || authLoading) {
        return;
      }

      setLoading(true);
      setError(null);
      
      const res = await api.get('/calendar/properties');
      if (res.data?.success) {
        const list = res.data.data || [];
        setProperties(list);
        
        // Auto-select first property if none selected
        if (!selectedPropertyId && list.length > 0) {
          setSelectedPropertyId(list[0].id);
        }
        
        // Reset retry count on success
        setRetryCount(0);
      } else {
        setError('Failed to load properties');
      }
    } catch (e) {
      console.error('PropertyContext: Failed to load properties', e);
      
      // Handle 401 errors with retry logic
      if (e.response?.status === 401 && retryCount < 2 && !isRetry) {
        console.log(`Auth error, retrying... (attempt ${retryCount + 1})`);
        setRetryCount(prev => prev + 1);
        
        // Retry after a short delay
        setTimeout(() => {
          loadProperties(true);
        }, 1000);
        
        return;
      }
      
      // Set error for persistent failures
      if (e.response?.status === 401) {
        setError('Authentication required. Please log in again.');
      } else {
        setError('Failed to load properties');
      }
    } finally {
      setLoading(false);
    }
  };

  const selectProperty = (propertyId) => {
    setSelectedPropertyId(propertyId);
  };

  const getSelectedProperty = () => {
    return properties.find(p => p.id === selectedPropertyId) || null;
  };

  const refreshProperties = () => {
    loadProperties();
  };

  const value = {
    // State
    properties,
    selectedPropertyId,
    selectedProperty: getSelectedProperty(),
    loading,
    error,
    
    // Actions
    selectProperty,
    refreshProperties,
    loadProperties
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
};

PropertyProvider.displayName = 'PropertyProvider';
