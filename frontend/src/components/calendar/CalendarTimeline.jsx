import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, AlertTriangle, Calendar } from 'lucide-react';
import CalendarHeader from './CalendarHeader';
import TimelineGrid from './TimelineGrid';
import GapFillModal from './GapFillModal';
import ErrorModal from '../modals/ErrorModal';
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
  const [showStagingRow, setShowStagingRow] = useState(false);

  // UI state
  const [showGapFillModal, setShowGapFillModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isResizeMode, setIsResizeMode] = useState(false); // Resize mode state
  const [isHorizontalMode, setIsHorizontalMode] = useState(false); // Horizontal mode state

  // Error modal state
  const [errorModal, setErrorModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    details: null,
    type: 'error'
  });

  // Date range state
  const [dateRange, setDateRange] = useState(() => DateUtils.getDefaultDateRange());
  
  // Navigation transition state
  const [isNavigating, setIsNavigating] = useState(false);
  const [cachedTimelineData, setCachedTimelineData] = useState(null);

  /**
   * Show error modal with specified message and details
   */
  const showErrorModal = (title, message, details = null, type = 'error') => {
    setErrorModal({
      isOpen: true,
      title,
      message,
      details,
      type
    });
  };

  /**
   * Close error modal
   */
  const closeErrorModal = () => {
    setErrorModal({
      isOpen: false,
      title: '',
      message: '',
      details: null,
      type: 'error'
    });
  };

  /**
   * Show success modal
   */
  const showSuccessModal = (title, message) => {
    showErrorModal(title, message, null, 'success');
  };

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
      const targetEndDate = DateUtils.addDays(targetStartDate, 31);

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
   * Handle date navigation with transition state management
   */
  const handleDateNavigation = async (newStartDate) => {
    // Start navigation transition
    setIsNavigating(true);
    
    // Cache current timeline data to prevent position miscalculation during transition
    if (timelineData) {
      setCachedTimelineData(timelineData);
    }
    
    try {
      await loadTimelineData(newStartDate);
    } catch (error) {
      console.error('Navigation failed:', error);
    } finally {
      // Clear navigation state and cached data
      setIsNavigating(false);
      setCachedTimelineData(null);
    }
  };

  /**
   * Handle timeline refresh
   */
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  /**
   * Toggle between move and resize modes
   */
  const handleModeToggle = () => {
    setIsResizeMode(!isResizeMode);
  };

  /**
   * Toggle horizontal mode
   */
  const handleHorizontalModeToggle = () => {
    setIsHorizontalMode(!isHorizontalMode);
  };


  /**
   * Handle reservation move
   */
  const handleReservationMove = async (reservation) => {
    try {
         // Move as usual
   await api.put(`/calendar/reservation/${reservation.id}/move`, {
     newRoomUnitId: reservation.roomUnitId,
     newStartDate: reservation.startDate,
     newEndDate: reservation.endDate
   });

   // SPECIAL CASE: if we moved to the Allocate row (unassigned), nuke any lingering segments
   if (reservation.roomUnitId == null) {
     try {

     } catch (e) {
       console.warn('Could not clear segments after unassign; will hard refresh.', e);
     }
     // Ensure the UI/availability state is truly clean before the next move
     await loadTimelineData();
     return; // we already refreshed; skip optimistic update below
   }

      // Update the local state optimistically instead of full refresh
      setTimelineData(prevData => {
        if (!prevData) return prevData;
        
        const updatedReservations = prevData.reservations.map(res => 
          res.id === reservation.id 
            ? { ...res, roomUnitId: reservation.roomUnitId, startDate: reservation.startDate, endDate: reservation.endDate }
            : res
        );
        
        return { ...prevData, reservations: updatedReservations };
      });
      
    } catch (error) {
      console.error('Error moving reservation:', error);
      showErrorModal(
        'Failed to Move Reservation',
        'The reservation could not be moved to the selected location. The calendar has been refreshed to show the current state.',
        error.response?.data?.details || error.message
      );
      // Only refresh on error to restore correct state
      await loadTimelineData();
    }
  };

  /**
   * Handle reservation resize
   */
  const handleReservationResize = async (reservation, resizeType) => {
    try {
      const updateData = {};
      if (resizeType === 'resize-left') {
        updateData.newStartDate = reservation.startDate;
      } else if (resizeType === 'resize-right') {
        updateData.newEndDate = reservation.endDate;
      } else if (resizeType === 'resize-horizontal') {
        // Mode-based resize - update both dates
        updateData.newStartDate = reservation.startDate;
        updateData.newEndDate = reservation.endDate;
      }

      await api.put(`/calendar/reservation/${reservation.id}/move`, updateData);

      // Update the local state optimistically instead of full refresh
      setTimelineData(prevData => {
        if (!prevData) return prevData;
        
        const updatedReservations = prevData.reservations.map(res => 
          res.id === reservation.id 
            ? { ...res, startDate: reservation.startDate, endDate: reservation.endDate }
            : res
        );
        
        return { ...prevData, reservations: updatedReservations };
      });
      
    } catch (error) {
      console.error('Error resizing reservation:', error);
      showErrorModal(
        'Failed to Resize Reservation',
        'The reservation dates could not be adjusted. The calendar has been refreshed to show the current state.',
        error.response?.data?.details || error.message
      );
      // Only refresh on error to restore correct state
      await loadTimelineData();
    }
  };

  /**
   * Handle reservation split
   */
  const handleReservationSplit = async (reservation) => {
    try {
      await api.post(`/calendar/reservation/${reservation.id}/split`, {
        splitDate: reservation.splitDate,
        newRoomUnitId: reservation.roomUnitId // Room for second segment
      });

      // Refresh timeline data for split operations (complex operation that creates new reservations)
      await loadTimelineData();
      
    } catch (error) {
      console.error('Error splitting reservation:', error);
      showErrorModal(
        'Failed to Split Reservation',
        'The reservation could not be split at the selected date. Please try again.',
        error.response?.data?.details || error.message
      );
    }
  };

  /**
   * Handle reservation swap
   */
  const handleReservationSwap = async (swappedReservationA, swappedReservationB) => {
    try {
      console.log('Executing swap via API:', {
        reservationA: swappedReservationA.id,
        reservationB: swappedReservationB.id
      });

      // Call API to swap the reservations (ROOM-ONLY SWAP)
      await api.post('/calendar/reservations/swap', {
        reservationA: {
          id: swappedReservationA.id,
          newRoomUnitId: swappedReservationA.roomUnitId,
          // Include dates for validation but they should be preserved
          newStartDate: swappedReservationA.startDate,
          newEndDate: swappedReservationA.endDate
        },
        reservationB: {
          id: swappedReservationB.id,
          newRoomUnitId: swappedReservationB.roomUnitId,
          // Include dates for validation but they should be preserved
          newStartDate: swappedReservationB.startDate,
          newEndDate: swappedReservationB.endDate
        }
      });

      // Update local state optimistically for both swapped reservations
      setTimelineData(prevData => {
        if (!prevData) return prevData;
        
        const updatedReservations = prevData.reservations.map(res => {
          if (res.id === swappedReservationA.id) {
            return { ...res, roomUnitId: swappedReservationA.roomUnitId };
          } else if (res.id === swappedReservationB.id) {
            return { ...res, roomUnitId: swappedReservationB.roomUnitId };
          }
          return res;
        });
        
        return { ...prevData, reservations: updatedReservations };
      });
      
      console.log('Swap operation completed successfully');
      
    } catch (error) {
      console.error('Error swapping reservations:', error);
      showErrorModal(
        'Failed to Swap Reservations',
        'The reservations could not be swapped between rooms. The calendar has been refreshed to show the current state.',
        error.response?.data?.details || error.message
      );
      // Only refresh on error to restore correct state
      await loadTimelineData();
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
        showSuccessModal(
          'Allocation Successful',
          `Successfully allocated ${allocationData.guestName} to their room!`
        );
      } else {
        // Allocation failed or requires swaps
        const hasSwaps = response.data.data?.swaps?.length > 0;
        
        if (hasSwaps) {
          showErrorModal(
            'Room Swaps Required',
            `Allocation requires ${response.data.data.swaps.length} room swap(s). This feature needs additional implementation.`,
            'Room swap functionality is not yet fully implemented in the modal system.',
            'warning'
          );
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
    <div className={`px-6 py-2 bg-gray-100 rounded-lg shadow-lg overflow-hidden ${className}`}>

         
      {/* Calendar Header */}
  
      <CalendarHeader
        dates={dateRange.dates}
        startDate={dateRange.startDate}
        onNavigate={handleDateNavigation}
        onRefresh={handleRefresh}
        loading={loading}
        selectedPropertyId={propertyId}
        isResizeMode={isResizeMode}
        onModeToggle={handleModeToggle}
        isHorizontalMode={isHorizontalMode}
        onHorizontalModeToggle={handleHorizontalModeToggle}
        showStagingRow={showStagingRow}
        onStagingToggle={() => setShowStagingRow(v => !v)}
      />

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
          onReservationSwap={handleReservationSwap}
          loading={loading || isNavigating}
          isResizeMode={isResizeMode}
          isHorizontalMode={isHorizontalMode}
          showStagingRow={showStagingRow}
          isNavigating={isNavigating}
          cachedTimelineData={cachedTimelineData}
        />

      </div>
      {/* Gap Fill Modal */}
      <GapFillModal
        isOpen={showGapFillModal}
        onClose={handleCloseGapFill}
        onAllocate={handleGapFillAllocate}
        availableRooms={roomHierarchy}
        loading={loading}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={closeErrorModal}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
        type={errorModal.type}
      />
    </div>
  );
}

/**
 * CalendarTimeline component with complete timeline functionality
 */
CalendarTimeline.displayName = 'CalendarTimeline';
