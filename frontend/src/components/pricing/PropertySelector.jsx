import React, { useState, useEffect } from 'react';
import { ChevronDown, Building } from 'lucide-react';
import { adminAPI } from '../../services/api';

export default function PropertySelector({ selectedProperty, onPropertySelect, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getProperties();
      setProperties(response.data.properties || []);
      
      // Auto-select first property if none selected
      if (!selectedProperty && response.data.properties?.length > 0) {
        onPropertySelect(response.data.properties[0]);
      }
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySelect = (property) => {
    onPropertySelect(property);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        disabled={loading}
      >
        <div className="flex items-center gap-3">
          <Building className="w-5 h-5 text-gray-500" />
          <div className="text-left">
            {selectedProperty ? (
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {selectedProperty.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {selectedProperty.address}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                {loading ? 'Loading properties...' : 'Select a property'}
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Loading properties...
              </div>
            ) : properties.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No properties found
              </div>
            ) : (
              properties.map((property) => (
                <button
                  key={property.id}
                  onClick={() => handlePropertySelect(property)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                    selectedProperty?.id === property.id ? 'bg-primary-50 text-primary-700' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Building className="w-4 h-4 text-gray-500" />
                    <div>
                      <div className="text-sm font-medium">
                        {property.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {property.address}
                      </div>
                      {property.stats && (
                        <div className="text-xs text-gray-400 mt-1">
                          {property.stats.totalRoomTypes} room types, {property.stats.totalRoomUnits} units
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
