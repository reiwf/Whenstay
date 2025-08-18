import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Building } from 'lucide-react';
import api from '../../services/api';

/**
 * PropertySelector - Dropdown component for selecting properties in calendar view
 * Shows list of available properties and handles property selection
 */
export default function PropertySelector({ 
  selectedPropertyId, 
  onPropertyChange, 
  className = "",
  disabled = false 
}) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Load available properties on component mount
  useEffect(() => {
    loadProperties();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * Load properties from API
   */
  const loadProperties = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/calendar/properties');
      
      if (response.data.success) {
        setProperties(response.data.data);
        
        // Auto-select first property if none selected
        if (!selectedPropertyId && response.data.data.length > 0) {
          onPropertyChange(response.data.data[0].id);
        }
      } else {
        setError('Failed to load properties');
      }
    } catch (err) {
      console.error('Error loading properties:', err);
      setError('Failed to load properties');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle property selection
   */
  const handlePropertySelect = (property) => {
    onPropertyChange(property.id);
    setIsOpen(false);
  };

  /**
   * Get selected property object
   */
  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  /**
   * Toggle dropdown open/closed
   */
  const toggleDropdown = () => {
    if (!disabled && !loading) {
      setIsOpen(!isOpen);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg animate-pulse ${className}`}>
        <div className="w-5 h-5 bg-gray-300 rounded"></div>
        <div className="w-32 h-4 bg-gray-300 rounded"></div>
        <div className="w-4 h-4 bg-gray-300 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg ${className}`}>
        <Building className="w-5 h-5" />
        <span className="text-sm font-medium">Error loading properties</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={toggleDropdown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-2 bg-white border border-gray-300 
          rounded-lg shadow-sm text-left hover:bg-gray-50 focus:outline-none focus:ring-2 
          focus:ring-blue-500 focus:border-blue-500 transition-colors duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <Building className="w-5 h-5 text-gray-400 flex-shrink-0" />
          
          <div className="min-w-0 flex-1">
            {selectedProperty ? (
              <div>
                <div className="text-sm font-medium text-gray-900 truncate">
                  {selectedProperty.name}
                </div>
                {selectedProperty.address && (
                  <div className="text-xs text-gray-500 truncate">
                    {selectedProperty.address}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Select a property
              </div>
            )}
          </div>
        </div>

        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform duration-150 flex-shrink-0 ml-2 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {properties.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              No properties available
            </div>
          ) : (
            <ul className="py-1">
              {properties.map((property) => (
                <li key={property.id}>
                  <button
                    type="button"
                    onClick={() => handlePropertySelect(property)}
                    className={`
                      w-full text-left px-4 py-3 hover:bg-gray-50 focus:outline-none 
                      focus:bg-gray-50 transition-colors duration-150
                      ${selectedPropertyId === property.id ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}
                    `}
                  >
                    <div className="flex items-center space-x-3">
                      <div 
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          selectedPropertyId === property.id ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      />
                      
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {property.name}
                        </div>
                        
                        {property.address && (
                          <div className="text-xs text-gray-500 truncate">
                            {property.address}
                          </div>
                        )}
                        
                        {property.property_type && (
                          <div className="text-xs text-gray-400 capitalize">
                            {property.property_type}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PropertySelector component with loading and error states
 */
PropertySelector.displayName = 'PropertySelector';
