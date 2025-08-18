import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ReservationBar from './ReservationBar';
import { DateUtils, GridUtils, ConflictUtils, SnapUtils, ResizeUtils } from './CalendarUtils';

/**
 * TimelineGrid - Main grid component with 2-level room hierarchy
 * Property → Room Type → Room Units
 * Handles drag/drop interactions and reservation rendering
 */
export default function TimelineGrid({
  roomHierarchy = [],
  reservations = [],
  segments = [],
  dates = [],
  startDate,
  onReservationMove,
  onReservationResize,
  onReservationSplit,
  onConflictCheck,
  loading = false,
  className = ""
}) {
  const [expandedRoomTypes, setExpandedRoomTypes] = useState(new Set());
  const [dragState, setDragState] = useState(null);
  const [previewReservation, setPreviewReservation] = useState(null);
  const gridRef = useRef(null);

  // Initialize expanded state - expand all room types by default
  useEffect(() => {
    if (roomHierarchy.length > 0 && expandedRoomTypes.size === 0) {
      const allRoomTypeIds = roomHierarchy.map(rt => rt.id);
      setExpandedRoomTypes(new Set(allRoomTypeIds));
    }
  }, [roomHierarchy]);

  /**
   * Toggle room type expansion
   */
  const toggleRoomType = (roomTypeId) => {
    const newExpanded = new Set(expandedRoomTypes);
    if (newExpanded.has(roomTypeId)) {
      newExpanded.delete(roomTypeId);
    } else {
      newExpanded.add(roomTypeId);
    }
    setExpandedRoomTypes(newExpanded);
  };

  /**
   * Get all reservations for a specific room unit
   */
  const getReservationsForRoom = (roomUnitId) => {
    const regularReservations = reservations.filter(r => r.roomUnitId === roomUnitId);
    const segmentReservations = segments.filter(s => s.roomUnitId === roomUnitId);
    return [...regularReservations, ...segmentReservations];
  };

  /**
   * Handle HTML5 drag start from ReservationBar
   */
  const handleDragStart = (dragData) => {
    setDragState({
      reservation: dragData.reservation,
      dragType: dragData.dragType,
      startX: dragData.startX,
      startY: dragData.startY,
      originalReservation: { ...dragData.reservation }
    });
  };

  /**
   * Handle HTML5 drag over for drop zones
   */
  const handleDragOver = (event) => {
    event.preventDefault(); // Allow drop
    
    if (!dragState) return;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    try {
      // Calculate position relative to grid
      const relativeX = event.clientX - rect.left - 192; // Subtract sidebar width
      const relativeY = event.clientY - rect.top;

      // Calculate target date based on drag type
      let targetDate;
      if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
        // For resize operations, calculate target date from mouse position
        const dayOffset = Math.round(relativeX / GridUtils.CONSTANTS.CELL_WIDTH);
        targetDate = DateUtils.addDays(startDate, dayOffset);
      } else {
        // For move operations, calculate based on original position
        const daysDelta = Math.round(relativeX / GridUtils.CONSTANTS.CELL_WIDTH);
        targetDate = DateUtils.addDays(dragState.originalReservation.startDate, daysDelta);
      }
      
      // Find target room unit based on Y position
      const targetRoomUnitId = findTargetRoomUnitFromPosition(relativeY);
      
      if (targetRoomUnitId || dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
        let updatedReservation = { ...dragState.originalReservation };
        const allReservations = [...reservations, ...segments];
        
        switch (dragState.dragType) {
          case 'move':
            // Vertical-only movement - preserve original dates, only change room unit
            updatedReservation.startDate = dragState.originalReservation.startDate;
            updatedReservation.endDate = dragState.originalReservation.endDate;
            updatedReservation.roomUnitId = targetRoomUnitId;
            break;
            
          case 'resize-left':
          case 'resize-right':
            // Enhanced resize logic using ResizeUtils
            const resizePreview = ResizeUtils.getResizePreview(
              dragState.originalReservation,
              targetDate,
              dragState.dragType,
              allReservations
            );
            
            updatedReservation = {
              ...dragState.originalReservation,
              startDate: resizePreview.startDate,
              endDate: resizePreview.endDate
            };
            
            // Add additional preview data for better UX
            updatedReservation.resizePreviewData = {
              duration: resizePreview.duration,
              isValid: resizePreview.isValid,
              hasConflicts: resizePreview.hasConflicts,
              validationReason: resizePreview.validationReason,
              wasConstrained: resizePreview.wasConstrained
            };
            break;
            
          case 'split':
            if (targetDate > dragState.originalReservation.startDate && 
                targetDate < dragState.originalReservation.endDate) {
              updatedReservation.splitDate = targetDate;
              updatedReservation.splitRoomUnitId = targetRoomUnitId;
            }
            break;
        }

        // Apply snapping for non-resize operations
        let finalReservation = updatedReservation;
        if (dragState.dragType !== 'resize-left' && dragState.dragType !== 'resize-right') {
          finalReservation = applySnapping(updatedReservation, dragState.dragType);
        }
        
        // Check for conflicts
        const hasConflict = dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right' 
          ? updatedReservation.resizePreviewData?.hasConflicts || false
          : checkForConflicts(finalReservation);
        
        // Set preview with enhanced data
        setPreviewReservation({
          ...finalReservation,
          hasConflict,
          isResizePreview: dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right',
          resizeValid: updatedReservation.resizePreviewData?.isValid !== false
        });
      }
    } catch (error) {
      console.error('Error during drag over:', error);
    }
  };

  /**
   * Handle HTML5 drop event
   */
  const handleDrop = (event) => {
    event.preventDefault();
    
    if (!dragState || !previewReservation) return;

    try {
      // Check for conflicts
      if (previewReservation.hasConflict) {
        console.warn('Cannot complete drop: conflicts detected');
        return;
      }

      // Execute the appropriate action based on drag type
      switch (dragState.dragType) {
        case 'move':
          onReservationMove && onReservationMove(previewReservation);
          break;
        case 'resize-left':
        case 'resize-right':
          onReservationResize && onReservationResize(previewReservation, dragState.dragType);
          break;
        case 'split':
          onReservationSplit && onReservationSplit(previewReservation);
          break;
      }
    } catch (error) {
      console.error('Error completing drop operation:', error);
    } finally {
      // Clean up drag state
      setDragState(null);
      setPreviewReservation(null);
    }
  };

  /**
   * Handle drag leave to clean up preview when leaving drop zone
   */
  const handleDragLeave = (event) => {
    // Only clear preview if truly leaving the grid area
    const rect = gridRef.current?.getBoundingClientRect();
    if (rect && (
      event.clientX < rect.left || 
      event.clientX > rect.right || 
      event.clientY < rect.top || 
      event.clientY > rect.bottom
    )) {
      setPreviewReservation(null);
    }
  };

  /**
   * Handle HTML5 drag end cleanup
   */
  const handleDragEnd = (updatedReservation, dragType, isFinal) => {
    if (isFinal) {
      // Clean up drag state when drag operation completes
      setDragState(null);
      setPreviewReservation(null);
    }
  };

  /**
   * Find target room unit based on Y position in grid
   */
  const findTargetRoomUnitFromPosition = (yPosition) => {
    let accumulatedHeight = 0;
    
    for (const roomType of roomHierarchy) {
      // Add room type header height
      accumulatedHeight += GridUtils.CONSTANTS.ROW_HEIGHT;
      
      if (expandedRoomTypes.has(roomType.id) && roomType.units) {
        for (const unit of roomType.units) {
          if (yPosition >= accumulatedHeight && yPosition < accumulatedHeight + GridUtils.CONSTANTS.ROW_HEIGHT) {
            return unit.id;
          }
          accumulatedHeight += GridUtils.CONSTANTS.ROW_HEIGHT;
        }
      }
    }
    
    return null;
  };

  /**
   * Find target room unit based on vertical drag delta
   */
  const findTargetRoomUnit = (currentRoomUnitId, rowsDelta) => {
    if (!rowsDelta || rowsDelta === 0) return currentRoomUnitId;

    // Flatten all room units with their indices
    const allUnits = [];
    let currentIndex = -1;
    
    roomHierarchy.forEach((roomType, typeIndex) => {
      if (expandedRoomTypes.has(roomType.id)) {
        roomType.units?.forEach((unit, unitIndex) => {
          allUnits.push({
            id: unit.id,
            roomTypeId: roomType.id,
            globalIndex: allUnits.length
          });
          
          if (unit.id === currentRoomUnitId) {
            currentIndex = allUnits.length - 1;
          }
        });
      }
    });

    if (currentIndex === -1) return currentRoomUnitId;

    // Calculate target index
    const targetIndex = currentIndex + rowsDelta;
    
    // Ensure target is within bounds
    if (targetIndex >= 0 && targetIndex < allUnits.length) {
      return allUnits[targetIndex].id;
    }
    
    return currentRoomUnitId;
  };

  /**
   * Apply snapping to reservation edges
   */
  const applySnapping = (reservation, dragType) => {
    const allReservations = [...reservations, ...segments].filter(r => 
      r.id !== reservation.id && r.roomUnitId === reservation.roomUnitId
    );

    let snappedReservation = { ...reservation };

    if (dragType === 'move') {
      // No snapping for move operations - dates are preserved, only room changes
      return snappedReservation;
    } else if (dragType === 'resize-left') {
      snappedReservation.startDate = SnapUtils.snapToNearestEdge(
        reservation.startDate,
        reservation.roomUnitId,
        allReservations
      );
    } else if (dragType === 'resize-right') {
      snappedReservation.endDate = SnapUtils.snapToNearestEdge(
        reservation.endDate,
        reservation.roomUnitId,
        allReservations
      );
    }

    return snappedReservation;
  };

  /**
   * Check for conflicts with existing reservations
   */
  const checkForConflicts = (reservation) => {
    const allReservations = [...reservations, ...segments];
    return ConflictUtils.hasConflicts(reservation, allReservations, reservation.id);
  };

  /**
   * Render room type header
   */
  const renderRoomTypeHeader = (roomType) => {
    const isExpanded = expandedRoomTypes.has(roomType.id);
    const unitCount = roomType.units?.length || 0;

    return (
      <div
        key={`roomtype-${roomType.id}`}
        className="bg-gray-100 border-b border-gray-200 sticky left-0 z-10"
      >
        <button
          type="button"
          onClick={() => toggleRoomType(roomType.id)}
          className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors duration-150"
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )}
            
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-gray-900 truncate">
                {roomType.name}
              </div>
              <div className="text-xs text-gray-500">
                {unitCount} unit{unitCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </button>
      </div>
    );
  };

  /**
   * Render room unit row
   */
  const renderRoomUnitRow = (roomUnit, roomType) => {
    const roomReservations = getReservationsForRoom(roomUnit.id);
    
    return (
      <div
        key={`unit-${roomUnit.id}`}
        className="relative border-b border-gray-200"
        style={{ height: `${GridUtils.CONSTANTS.ROW_HEIGHT}px` }}
      >
        {/* Room Unit Label */}
        <div className="absolute left-0 top-0 w-48 h-full bg-white border-r border-gray-200 px-4 py-2 flex items-center z-10">
          <div className="pl-6 min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 truncate">
              {roomUnit.number}
            </div>
            {roomUnit.floor_number && (
              <div className="text-xs text-gray-500">
                Floor {roomUnit.floor_number}
              </div>
            )}
          </div>
        </div>

        {/* Timeline Area */}
        <div className="ml-48 relative" style={{ minWidth: `${dates.length * GridUtils.CONSTANTS.CELL_WIDTH}px` }}>
          {/* Grid Lines */}
          {dates.map((date, index) => (
            <div
              key={`gridline-${date}`}
              className="absolute top-0 bottom-0 border-r border-gray-100"
              style={{
                left: `${index * GridUtils.CONSTANTS.CELL_WIDTH}px`,
                width: '1px'
              }}
            />
          ))}

          {/* Date Cells (for drop targets) */}
          {dates.map((date, index) => {
            const isToday = DateUtils.isToday(date);
            const isWeekend = DateUtils.isWeekend(date);
            const isDragHover = dragState && 
              previewReservation && 
              previewReservation.roomUnitId === roomUnit.id;
            const isValidDropZone = isDragHover && !previewReservation.hasConflict;
            const isInvalidDropZone = isDragHover && previewReservation.hasConflict;
            
            return (
              <div
                key={`cell-${date}`}
                className={`
                  absolute top-0 bottom-0 transition-all duration-150
                  ${!dragState ? 'hover:bg-blue-50' : ''}
                  ${isToday ? 'bg-blue-25' : ''}
                  ${isWeekend ? 'bg-gray-25' : ''}
                  ${isValidDropZone ? 'bg-green-50 border border-green-200' : ''}
                  ${isInvalidDropZone ? 'bg-red-50 border border-red-200' : ''}
                `}
                style={{
                  left: `${index * GridUtils.CONSTANTS.CELL_WIDTH}px`,
                  width: `${GridUtils.CONSTANTS.CELL_WIDTH}px`
                }}
                data-date={date}
                data-room-unit-id={roomUnit.id}
              />
            );
          })}

          {/* Reservations */}
          {roomReservations.map((reservation) => {
            // Hide original reservation during resize operations to avoid double-bar effect
            const isBeingResized = dragState?.reservation?.id === reservation.id && 
                                 (dragState?.dragType === 'resize-left' || dragState?.dragType === 'resize-right');
            
            if (isBeingResized) {
              return null; // Don't render original during resize - preview will show instead
            }
            
            return (
              <ReservationBar
                key={`res-${reservation.id}-${reservation.segmentId || 'main'}`}
                reservation={reservation}
                startDate={startDate}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={dragState?.reservation?.id === reservation.id}
                showHandles={!loading}
                enableSplit={!reservation.isSegment} // Only allow splitting on main reservations
              />
            );
          })}

          {/* Preview Reservation (during drag) */}
          {previewReservation && previewReservation.roomUnitId === roomUnit.id && (
            <ReservationBar
              key="preview"
              reservation={previewReservation}
              startDate={startDate}
              isPreview={true}
              hasConflict={previewReservation.hasConflict}
              showHandles={false}
            />
          )}
        </div>
      </div>
    );
  };

  /**
   * Render empty state
   */
  const renderEmptyState = () => (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <div className="text-center">
        <div className="text-lg font-medium">No rooms available</div>
        <div className="text-sm">Select a property to view its calendar</div>
      </div>
    </div>
  );

  /**
   * Render loading state
   */
  const renderLoadingState = () => (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center space-x-2 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span>Loading calendar...</span>
      </div>
    </div>
  );

  if (loading) {
    return renderLoadingState();
  }

  if (roomHierarchy.length === 0) {
    return renderEmptyState();
  }

  return (
    <div 
      className={`relative bg-white ${className}`} 
      ref={gridRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
    >
      {/* Room Types and Units */}
      {roomHierarchy.map((roomType) => {
        const isExpanded = expandedRoomTypes.has(roomType.id);
        
        return (
          <div key={roomType.id}>
            {/* Room Type Header */}
            {renderRoomTypeHeader(roomType)}
            
            {/* Room Units (collapsed/expanded) */}
            {isExpanded && roomType.units && roomType.units.map((roomUnit) => 
              renderRoomUnitRow(roomUnit, roomType)
            )}
          </div>
        );
      })}
      
      {/* Drag Overlay */}
      {dragState && (
        <div 
          className="absolute inset-0 z-40 cursor-grabbing"
          style={{ pointerEvents: 'none' }}
        />
      )}
    </div>
  );
}

/**
 * TimelineGrid component with room hierarchy and drag/drop
 */
TimelineGrid.displayName = 'TimelineGrid';
