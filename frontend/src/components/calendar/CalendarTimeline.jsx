import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, AlertTriangle, Calendar } from 'lucide-react';
import CalendarHeader from './CalendarHeader';
import TimelineGrid from './TimelineGrid';
import GapFillModal from './GapFillModal';
import { DateUtils, PerformanceUtils } from './CalendarUtils';
import api from '../../services/api';

/**
 * CalendarTimeline - Core calendar component that integrates all timeline functionality
 * Manages state, API calls, and coordinates between header, grid, and modals
 */
export default function CalendarTimeline({
  propertyId,
  onPropertyChange,
  className = ""
}) {
  // Timeline data state
  const [timelineData, setTimelineData] = useState(null);
  const [roomHierarchy, setRoomHierarchy] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // UI state
  const [showGapFillModal, setShowGapFillModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Date range state
  const [dateRange, setDateRange] = useState(() => DateUtils.getDefaultDateRange());

  /**
   * Load timeline data for the selected property
   */
  const loadTimelineData = useCallback(async (startDate = null) => {
    if (!propertyId) {
      setTimelineData(null);
      setRoomHierarchy([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use provided start date or current range
      const targetStartDate = startDate || dateRange.startDate;
      const targetEndDate = DateUtils.addDays(targetStartDate, 30);

      const response = await api.get(`/calendar/timeline/${propertyId}`, {
        params: {
          startDate: targetStartDate,
          endDate: targetEndDate
        }
      });

      if (response.data.success) {
        const data = response.data.data;
        setTimelineData(data);
        setRoomHierarchy(data.roomHierarchy || []);
        
        // Update date range if it changed
        if (startDate) {
          setDateRange({
            startDate: targetStartDate,
            endDate: targetEndDate,
            totalDays: 31,
            dates: DateUtils.generateDateRange(targetStartDate, targetEndDate)
          });
        }
      } else {
        throw new Error(response.data.error || 'Failed to load timeline data');
      }
    } catch (err) {
      console.error('Error loading timeline data:', err);
      setError(err.message || 'Failed to load calendar data');
      setTimelineData(null);
      setRoomHierarchy([]);
    } finally {
      setLoading(false);
    }
  }, [propertyId, dateRange.startDate]);

  // Debounced version of loadTimelineData for performance
  const debouncedLoadTimelineData = useCallback(
    PerformanceUtils.debounce(loadTimelineData, 300),
    [loadTimelineData]
  );

  // Load data when property changes
  useEffect(() => {
    if (propertyId) {
      debouncedLoadTimelineData();
    }
  }, [propertyId, refreshKey, debouncedLoadTimelineData]);

  /**
   * Handle date navigation
   */
  const handleDateNavigation = (newStartDate) => {
    loadTimelineData(newStartDate);
  };

  /**
   * Handle timeline refresh
   */
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  /**
   * Handle reservation move
   */
  const handleReservationMove = async (reservation) => {
    try {
      setLoading(true);

      await api.put(`/calendar/reservation/${reservation.id}/move`, {
        newRoomUnitId: reservation.roomUnitId,
        newStartDate: reservation.startDate,
        newEndDate: reservation.endDate
      });

      // Refresh timeline data
      await loadTimelineData();
      
    } catch (error) {
      console.error('Error moving reservation:', error);
      alert(`Failed to move reservation: ${error.response?.data?.details || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle reservation resize
   */
  const handleReservationResize = async (reservation, resizeType) => {
    try {
      setLoading(true);

      const updateData = {};
      if (resizeType === 'resize-left') {
        updateData.newStartDate = reservation.startDate;
      } else if (resizeType === 'resize-right') {
        updateData.newEndDate = reservation.endDate;
      }

      await api.put(`/calendar/reservation/${reservation.id}/move`, updateData);

      // Refresh timeline data
      await loadTimelineData();
      
    } catch (error) {
      console.error('Error resizing reservation:', error);
      alert(`Failed to resize reservation: ${error.response?.data?.details || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle reservation split
   */
  const handleReservationSplit = async (reservation) => {
    try {
      setLoading(true);

      await api.post(`/calendar/reservation/${reservation.id}/split`, {
        splitDate: reservation.splitDate,
        newRoomUnitId: reservation.roomUnitId // Room for second segment
      });

      // Refresh timeline data
      await loadTimelineData();
      
    } catch (error) {
      console.error('Error splitting reservation:', error);
      alert(`Failed to split reservation: ${error.response?.data?.details || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle gap-fill allocation
   */
  const handleGapFillAllocate = async (allocationData) => {
    try {
      const response = await api.post('/calendar/allocate', allocationData);

      if (response.data.success) {
        // Success - refresh timeline
        await loadTimelineData();
        alert(`Successfully allocated ${allocationData.guestName}!`);
      } else {
        // Allocation failed or requires swaps
        const hasSwaps = response.data.data?.swaps?.length > 0;
        
        if (hasSwaps) {
          const swapMessage = `Allocation requires ${response.data.data.swaps.length} room swap(s). Apply swaps?`;
          if (confirm(swapMessage)) {
            await api.post('/calendar/swaps/apply', {
              swaps: response.data.data.swaps
            });
            await loadTimelineData();
            alert('Allocation completed with room swaps!');
          }
        } else {
          throw new Error(response.data.error || 'Allocation failed');
        }
      }
    } catch (error) {
      console.error('Error in gap-fill allocation:', error);
      throw error; // Re-throw to let modal handle it
    }
  };

  /**
   * Open gap-fill modal
   */
  const handleOpenGapFill = () => {
    setShowGapFillModal(true);
  };

  /**
   * Close gap-fill modal
   */
  const handleCloseGapFill = () => {
    setShowGapFillModal(false);
  };

  /**
   * Render empty state when no property selected
   */
  const renderEmptyState = () => (
    <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
      <div className="text-center">
        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Calendar Timeline</h3>
        <p className="text-gray-500">Select a property to view its room availability and reservations</p>
      </div>
    </div>
  );

  /**
   * Render error state
   */
  const renderErrorState = () => (
    <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Calendar</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadTimelineData()}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-150"
        >
          Retry
        </button>
      </div>
    </div>
  );

  // Don't render anything if no property selected
  if (!propertyId) {
    return renderEmptyState();
  }

  // Render error state if error occurred
  if (error && !loading) {
    return renderErrorState();
  }

  return (
    <div className={`bg-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Calendar Header */}
      <CalendarHeader
        dates={dateRange.dates}
        startDate={dateRange.startDate}
        onNavigate={handleDateNavigation}
        onRefresh={handleRefresh}
        loading={loading}
        selectedPropertyId={propertyId}
      />

      {/* Action Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {timelineData ? (
              <>
                Showing {roomHierarchy.length} room type(s) with{' '}
                {roomHierarchy.reduce((total, rt) => total + (rt.units?.length || 0), 0)} units
              </>
            ) : (
              'Loading room data...'
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleOpenGapFill}
              disabled={loading || !propertyId}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Reservation
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="relative">
        <TimelineGrid
          roomHierarchy={roomHierarchy}
          reservations={timelineData?.reservations || []}
          segments={timelineData?.segments || []}
          dates={dateRange.dates}
          startDate={dateRange.startDate}
          onReservationMove={handleReservationMove}
          onReservationResize={handleReservationResize}
          onReservationSplit={handleReservationSplit}
          loading={loading}
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40">
            <div className="flex items-center space-x-2 text-gray-600">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="text-sm font-medium">Updating calendar...</span>
            </div>
          </div>
        )}
      </div>

      {/* Gap Fill Modal */}
      <GapFillModal
        isOpen={showGapFillModal}
        onClose={handleCloseGapFill}
        onAllocate={handleGapFillAllocate}
        availableRooms={roomHierarchy}
        loading={loading}
      />
    </div>
  );
}

/**
 * CalendarTimeline component with complete timeline functionality
 */
CalendarTimeline.displayName = 'CalendarTimeline';
