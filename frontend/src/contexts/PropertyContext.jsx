import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

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

  // Load properties on mount
  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
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
      } else {
        setError('Failed to load properties');
      }
    } catch (e) {
      console.error('PropertyContext: Failed to load properties', e);
      setError('Failed to load properties');
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
