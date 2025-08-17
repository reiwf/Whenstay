import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import PropertySelector from '../components/pricing/PropertySelector';
import RoomTypeList from '../components/pricing/RoomTypeList';
import CalendarGrid from '../components/pricing/CalendarGrid';
import PriceDrawer from '../components/pricing/PriceDrawer';
import usePricingApi from '../hooks/usePricingApi';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import PageHeader from '../components/ui/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';
import { adminAPI } from '../services/api';

const formatDate = (date) => date.toISOString().slice(0, 10);

export default function PricingPage() {
  const { roomTypeId: urlRoomTypeId } = useParams();
  const navigate = useNavigate();

  // Core state
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [roomTypes, setRoomTypes] = useState([]);
  const [selectedRoomType, setSelectedRoomType] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [drawer, setDrawer] = useState(null);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  const [runningPricing, setRunningPricing] = useState(false);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Date range state (default to 2 months)
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { 
      from: formatDate(from), 
      to: formatDate(to) 
    };
  });

  // Initialize pricing API hook only when room type is selected
  const api = usePricingApi(selectedRoomType?.id);

  // Load room type from URL parameter if provided
  useEffect(() => {
    if (urlRoomTypeId && !selectedRoomType) {
      loadRoomTypeFromUrl(urlRoomTypeId);
    }
  }, [urlRoomTypeId]);

  // Load room types when property changes
  useEffect(() => {
    if (selectedProperty) {
      loadRoomTypes();
    }
  }, [selectedProperty]);

  // Load calendar when room type or range changes (with debouncing)
  useEffect(() => {
    if (selectedRoomType && api && selectedRoomType.id) {
      const timeoutId = setTimeout(() => {
        loadCalendar();
      }, 300); // 300ms debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedRoomType?.id, range.from, range.to]);

  const loadRoomTypeFromUrl = async (roomTypeId) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/room-types/${roomTypeId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        const roomType = data.room_type || data;
        
        // Load the property for this room type
        const propertyResponse = await adminAPI.getProperty(roomType.property_id);
        if (propertyResponse.data.property) {
          setSelectedProperty(propertyResponse.data.property);
          setSelectedRoomType(roomType);
        }
      }
    } catch (error) {
      console.error('Error loading room type from URL:', error);
    }
  };

  const loadRoomTypes = async () => {
    if (!selectedProperty?.id) return;
    
    try {
      setLoadingRoomTypes(true);
      const response = await adminAPI.getRoomTypes(selectedProperty.id);
      const roomTypesList = response.data?.roomTypes || [];
      setRoomTypes(roomTypesList);
      
      // Auto-select first room type if none selected
      if (!selectedRoomType && roomTypesList.length > 0) {
        setSelectedRoomType(roomTypesList[0]);
      }
    } catch (error) {
      console.error('Error loading room types:', error);
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  const loadCalendar = async () => {
    if (!selectedRoomType || !api || !selectedRoomType.id) return;
    
    setLoadingCalendar(true);
    try {
      console.log('Loading calendar for room type:', selectedRoomType.id, 'from:', range.from, 'to:', range.to);
      const calendarData = await api.getCalendar(range.from, range.to);
      console.log('Calendar data received:', calendarData);
      
      if (calendarData && calendarData.days) {
        setCalendar(calendarData.days);
        console.log('Calendar set with', calendarData.days.length, 'days');
      } else {
        console.warn('No calendar days found in response');
        setCalendar([]);
      }
    } catch (error) {
      console.error('Error loading calendar:', error);
      setCalendar([]);
      
      // Stop trying to reload on auth errors
      if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
        console.warn('Authentication issue - please login again');
      }
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Handle property selection
  const handlePropertySelect = (property) => {
    setSelectedProperty(property);
    setSelectedRoomType(null);
    setRoomTypes([]);
    setCalendar([]);
    
    // Update URL to remove room type ID if navigated from specific room type
    if (urlRoomTypeId) {
      navigate('/pricing', { replace: true });
    }
  };

  // Handle room type selection
  const handleRoomTypeSelect = (roomType) => {
    setSelectedRoomType(roomType);
    setCalendar([]);
  };

  // Recalculate pricing
  const handleRecalculate = async () => {
    if (!selectedRoomType || !api) return;
    
    setRunningPricing(true);
    try {
      console.log('Starting pricing calculation for room type:', selectedRoomType.id, 'from:', range.from, 'to:', range.to);
      const result = await api.runPricing(range.from, range.to);
      
      if (result) {
        console.log('Pricing calculation completed:', result);
        await loadCalendar();
      } else {
        console.warn('Pricing calculation returned null - check API logs');
      }
    } catch (error) {
      console.error('Error running pricing:', error);
    } finally {
      setRunningPricing(false);
    }
  };

  // Handle day click
  const handleCellClick = async (day) => {
    if (!api) return;
    
    try {
      const breakdown = await api.getBreakdown(day.date);
      setDrawer({ ...breakdown, date: day.date });
    } catch (error) {
      console.error('Error fetching breakdown:', error);
      setDrawer({ 
        date: day.date, 
        price: day.price,
        breakdown: null,
        error: 'No pricing data available for this date'
      });
    }
  };

  // Save price override
  const handleSaveOverride = async (price, locked) => {
    if (!api) return;
    
    try {
      const result = await api.setOverride(drawer.date, price, locked);
      await loadCalendar();
      
      if (!result?.price_adjusted) {
        setDrawer(null);
      }
      
      return result;
    } catch (error) {
      console.error('Error saving override:', error);
      throw error;
    }
  };

  // Update room type pricing fields
  const handleUpdatePricing = async (field, value) => {
    if (!selectedRoomType || !api) return;
    
    try {
      if (field === 'base_price' || field === 'min_price' || field === 'max_price') {
        // Update room type table for price fields
        const response = await adminAPI.updateRoomType(selectedRoomType.id, { [field]: value });
        if (response.data.success) {
          // Update local state
          setSelectedRoomType(prev => ({ ...prev, [field]: value }));
          
          // Auto-recalculate after changes if base price is now set
          if (field === 'base_price' && value > 0) {
            await handleRecalculate();
          }
        }
      } else {
        // Update pricing rules for other fields
        await api.updateRules({ [field]: value });
        setSelectedRoomType(prev => ({ ...prev, [field]: value }));
        await handleRecalculate();
      }
    } catch (error) {
      console.error('Error updating pricing:', error);
    }
  };

  const currency = selectedRoomType?.currency || 'JPY';
  const formatPrice = (price) => {
    if (!price) return '-';
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0
    }).format(price);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <PageHeader 
          title="Pricing Management"
          subtitle="Manage dynamic pricing for all properties and room types"
        />

        {/* Property Selector */}
        <div className="mb-6">
          <PropertySelector 
            selectedProperty={selectedProperty}
            onPropertySelect={handlePropertySelect}
            className="max-w-md"
          />
        </div>

        {!selectedProperty ? (
          <div className="flex items-center justify-center flex-1">
            <div className="text-center text-gray-500">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Property</h3>
              <p className="text-sm">Choose a property above to start managing room pricing</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* Left Panel - Room Types */}
            <div className="w-full lg:w-80 lg:flex-shrink-0 bg-white rounded-lg border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">Room Types</h3>
                <p className="text-sm text-gray-500">
                  {roomTypes.length} room types in {selectedProperty.name}
                </p>
              </div>
              
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                <div className="p-4">
                  <RoomTypeList 
                    roomTypes={roomTypes}
                    selectedRoomType={selectedRoomType}
                    onRoomTypeSelect={handleRoomTypeSelect}
                    loading={loadingRoomTypes}
                  />
                </div>
              </div>
            </div>

            {/* Right Panel - Pricing Details */}
            <div className="flex-1 min-w-0">
              {!selectedRoomType ? (
                <div className="bg-white rounded-lg border shadow-sm h-full flex items-center justify-center">
                  <div className="text-center text-gray-500">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Room Type</h3>
                    <p className="text-sm">Choose a room type from the left panel to manage its pricing</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Room Type Header & Controls */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                          {selectedRoomType.name}
                        </h2>
                        <p className="text-sm text-gray-500">
                          Dynamic pricing • Base: {selectedRoomType.base_price ? formatPrice(selectedRoomType.base_price) : 'Not set'}
                        </p>
                        {!selectedRoomType.base_price && (
                          <p className="text-sm text-red-500 mt-1">
                            ⚠️ Base price must be set before pricing can be calculated
                          </p>
                        )}
                      </div>
                      
                      <Button 
                        onClick={handleRecalculate} 
                        disabled={runningPricing || api?.loading}
                        className="bg-black text-white hover:bg-gray-800"
                      >
                        {runningPricing ? 'Calculating...' : 'Recalculate Prices'}
                      </Button>
                    </div>

                    {/* Price Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="md:col-span-2">
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Date Range:</span> {range.from} → {range.to}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Base Price:</label>
                        <Input
                          type="number"
                          value={selectedRoomType.base_price || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setSelectedRoomType(prev => ({ ...prev, base_price: value }));
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            handleUpdatePricing('base_price', value);
                          }}
                          className={`flex-1 ${!selectedRoomType.base_price ? 'border-red-300 focus:border-red-500' : ''}`}
                          min="0"
                          placeholder="Required"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Min Price:</label>
                        <Input
                          type="number"
                          value={selectedRoomType.min_price || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setSelectedRoomType(prev => ({ ...prev, min_price: value }));
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            handleUpdatePricing('min_price', value);
                          }}
                          className="flex-1"
                          min="0"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-700 whitespace-nowrap">Max Price:</label>
                        <Input
                          type="number"
                          value={selectedRoomType.max_price || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            setSelectedRoomType(prev => ({ ...prev, max_price: value }));
                          }}
                          onBlur={(e) => {
                            const value = parseFloat(e.target.value) || 0;
                            handleUpdatePricing('max_price', value);
                          }}
                          className="flex-1"
                          min="0"
                        />
                      </div>
                    </div>

                    {api?.error && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                        {api.error}
                        <button 
                          onClick={api.clearError}
                          className="ml-2 underline hover:no-underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Calendar */}
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Pricing Calendar</h3>
                      {loadingCalendar && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <LoadingSpinner size="sm" />
                          <span>Loading calendar...</span>
                        </div>
                      )}
                    </div>
                    
                    {loadingCalendar ? (
                      <div className="text-center py-12">
                        <LoadingSpinner />
                        <p className="text-gray-500 mt-4">Loading pricing data...</p>
                      </div>
                    ) : calendar.length > 0 ? (
                      <CalendarGrid 
                        days={calendar} 
                        onCellClick={handleCellClick}
                        formatPrice={formatPrice}
                      />
                    ) : api?.error ? (
                      <div className="text-center py-12 text-red-500">
                        <p className="mb-2">Failed to load pricing data</p>
                        <p className="text-sm text-gray-500">{api.error}</p>
                        <Button 
                          onClick={handleRecalculate} 
                          className="mt-4"
                          variant="outline"
                        >
                          Retry
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>No pricing data available.</p>
                        <p className="text-sm">Click "Recalculate Prices" to generate pricing for this date range.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Price Drawer */}
        {drawer && (
          <PriceDrawer 
            data={drawer}
            onClose={() => setDrawer(null)}
            onSave={handleSaveOverride}
            formatPrice={formatPrice}
            currency={currency}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
