import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Move, Scaling } from 'lucide-react';
import ReservationBar from './ReservationBar';
import ReservationDrawer from './ReservationDrawer';
import { DateUtils, GridUtils, ConflictUtils, SnapUtils, ResizeUtils, SwapUtils } from './CalendarUtils';

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
  onReservationSwap,
  onConflictCheck,
  loading = false,
  isResizeMode = false,
  isHorizontalMode = false,
  showStagingRow = false,
  isNavigating = false,
  cachedTimelineData = null,
  className = ""
}) {
  const [expandedRoomTypes, setExpandedRoomTypes] = useState(new Set());
  const [dragState, setDragState] = useState(null);
  const [previewReservation, setPreviewReservation] = useState(null);
  const [swapState, setSwapState] = useState(null);
  const [gridConstants, setGridConstants] = useState(GridUtils.getCurrentConstants());
  const [lockedGridConstants, setLockedGridConstants] = useState(null); // Locked constants during drag
  const [windowWidth, setWindowWidth] = useState(window?.innerWidth || 1200);
  const [roomPositionMap, setRoomPositionMap] = useState(new Map()); // Cached room positions
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const gridRef = useRef(null);
  const lastStableTargetRef = React.useRef(null); 
  const lastSwitchYRef = React.useRef(0);
  
   useEffect(() => {
    setDragState(null);
    setPreviewReservation(null);
    setSwapState(null);
  }, [startDate, dates]);

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setWindowWidth(newWidth);
      setGridConstants(GridUtils.getCurrentConstants(newWidth));
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial values
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // CSS custom properties for responsive design
  useEffect(() => {
    if (gridRef.current) {
      const root = gridRef.current;
      root.style.setProperty('--cell-width', `${gridConstants.CELL_WIDTH}px`);
      root.style.setProperty('--row-height', `${gridConstants.ROW_HEIGHT}px`);
      root.style.setProperty('--header-height', `${gridConstants.HEADER_HEIGHT}px`);
      root.style.setProperty('--sidebar-width', `${gridConstants.SIDEBAR_WIDTH}px`);
      root.style.setProperty('--breakpoint', gridConstants.BREAKPOINT);
    }
  }, [gridConstants]);

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

  const unassignedReservations = React.useMemo(() => {
    const all = [...reservations, ...segments];
    return all
      .filter(r => r && r.roomUnitId == null)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate)); // ascending check-in
  }, [reservations, segments]);

  const hasUnassignedForType = React.useCallback((roomTypeId) => {
    const anyRes = reservations.some(r => r?.roomUnitId == null && r?.roomTypeId === roomTypeId);
    const anySeg = segments.some(s => s?.roomUnitId == null && s?.roomTypeId === roomTypeId);
    return anyRes || anySeg;
  }, [reservations, segments]);


  const renderTypeStagingRow = (roomType) => {
    if (!showStagingRow) return null;

    const roomReservations = getReservationsForRoom(null, roomType.id); // unassigned of this type

    return (
      <div
        key={`staging-${roomType.id}`}
        className="relative border-b border-amber-200 bg-amber-50/30"
        style={{ height: `${gridConstants.ROW_HEIGHT}px` }}
        data-staging-row={roomType.id}
      >
        {/* left label */}
        <div
          className="absolute left-0 top-0 h-full flex items-center z-10 px-2 md:px-3 lg:px-4 bg-amber-50 border-r border-amber-200"
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="pl-2 md:pl-4 lg:pl-6 min-w-0">
            <div className="text-xs md:text-sm font-semibold text-amber-800 truncate">
              Allocation ( {roomType.name} )
            </div>
            <div className="text-xs text-amber-700 truncate">
              Drag here, then drop to a room
            </div>
          </div>
        </div>

        {/* timeline area */}
        <div
          className="relative bg-gray-100 border-b border-white"
          style={{
            marginLeft: `${gridConstants.SIDEBAR_WIDTH}px`,
            minWidth: `${dates.length * gridConstants.CELL_WIDTH}px`,
            height: `${gridConstants.ROW_HEIGHT}px`,
          }}
        >
          {/* vertical grid lines */}
          {dates.map((date, index) => (
            <div
              key={`staging-gridline-${roomType.id}-${date}`}
              className="absolute top-0 bottom-0"
              style={{ left: `${index * gridConstants.CELL_WIDTH}px`, width: '1px' }}
            />
          ))}

          {/* reservations */}
          {roomReservations.map((reservation) => (
            <ReservationBar
              key={`staging-${roomType.id}-${reservation.id}-${reservation.segmentId || 'main'}`}
              reservation={reservation}
              startDate={startDate}
              dates={dates}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onReservationClick={handleReservationClick}
              showHandles={!loading}
              enableSplit={!reservation.isSegment}
              isResizeMode={isResizeMode}
            />
          ))}

          {/* preview while hovering staging (unassigned) */}
          {previewReservation && previewReservation.roomUnitId == null && (
            <ReservationBar
              key={`staging-preview-${roomType.id}`}
              reservation={previewReservation}
              startDate={startDate}
              dates={dates}
              isPreview
              hasConflict={previewReservation.hasConflict}
              showHandles={false}
            />
          )}
        </div>
      </div>
    );
  };


  /**
   * Get effective data source for reservations/segments during navigation transitions
   * Uses cached data during navigation to prevent position miscalculation
   */
  const getEffectiveDataSource = () => {
    if (isNavigating && cachedTimelineData) {
      console.log('Using cached timeline data during navigation');
      return {
        reservations: cachedTimelineData.reservations || [],
        segments: cachedTimelineData.segments || []
      };
    }
    return {
      reservations: reservations || [],
      segments: segments || []
    };
  };

  /**
   * Get all reservations for a specific room unit
   * Handles both assigned rooms (with roomUnitId) and unassigned reservations (roomUnitId = null)
   * Uses cached data during navigation transitions to prevent position miscalculation
   */
  const getReservationsForRoom = (roomUnitId, roomTypeId = null) => {
    const { reservations: effectiveReservations, segments: effectiveSegments } = getEffectiveDataSource();
    
    if (roomUnitId === null && roomTypeId) {
      const regularReservations = effectiveReservations.filter(r =>
        r.roomUnitId == null && r.roomTypeId === roomTypeId
      );
      const segmentReservations = effectiveSegments.filter(s =>
        s.roomUnitId == null && s.roomTypeId === roomTypeId
      );
      return [...regularReservations, ...segmentReservations]
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }
    
    // For assigned rooms, get reservations with matching roomUnitId
    const regularReservations = effectiveReservations.filter(r => r.roomUnitId === roomUnitId);
    const segmentReservations = effectiveSegments.filter(s => s.roomUnitId === roomUnitId);
    return [...regularReservations, ...segmentReservations];
  };

  /**
   * Calculate availability for a room type on a specific date
   */
  const calculateAvailabilityForDate = (roomType, date) => {
      // Real, sellable units only
      const realUnits = (roomType.units || []).filter(
        u => !(u.isUnassigned || u.number === 'UNASSIGNED')
      );
      const totalUnits = realUnits.length;

      // Active reservations/segments
      const allActive = [
        ...reservations.filter(r => r.status && !['cancelled', 'no_show'].includes(r.status)),
        ...segments.filter(s => s.status && !['cancelled', 'no_show'].includes(s.status)),
      ];

      // Assigned occupancy: any unit occupied on this date
      const occupiedUnits = realUnits.reduce((count, unit) => {
        const has = allActive.some(r =>
          r.roomUnitId === unit.id &&
          date >= r.startDate && date < r.endDate
        );
        return count + (has ? 1 : 0);
      }, 0);

      // Unassigned/allocate occupancy: reservations for THIS room type with no room yet
      const unassignedCount = allActive.filter(r =>
        (r.roomUnitId == null) &&
        (r.roomTypeId === roomType.id) &&
        (date >= r.startDate && date < r.endDate)
      ).length;

      // Availability = total - (assigned + unassigned), clamped to [0, total]
      const available = Math.max(0, Math.min(totalUnits, totalUnits - occupiedUnits - unassignedCount));
      return available;
    };

    const findHitTarget = (yPosition) => {
      const active = lockedGridConstants || gridConstants;
      let acc = 0;
      const types = [...roomHierarchy].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));

      for (const rt of types) {
        // Header (non-droppable)
        const headerEl = document.querySelector(`[data-room-type-header="${rt.id}"]`);
        const headerH  = headerEl?.offsetHeight || active.ROW_HEIGHT;
        const headerStart = acc, headerEnd = acc + headerH;
        if (yPosition >= headerStart && yPosition < headerEnd) {
          return { rowType: 'header', roomTypeId: rt.id, roomUnitId: undefined };
        }
        acc = headerEnd;

        // Allocate row (only when Allocate Mode ON)
        if (showStagingRow) {
          const stagingStart = acc, stagingEnd = acc + active.ROW_HEIGHT;
          if (yPosition >= stagingStart && yPosition < stagingEnd) {
            return { rowType: 'allocate', roomTypeId: rt.id, roomUnitId: null };
          }
          acc = stagingEnd;
        }

        // Real unit rows (filter same as render)
        const units = (rt.units || [])
          .filter(u => !(showStagingRow && (u.isUnassigned || u.number === 'UNASSIGNED')))
          .slice()
          .sort((a,b) => {
            if (a.isUnassigned && !b.isUnassigned) return 1;
            if (!a.isUnassigned && b.isUnassigned) return -1;
            if (a.isUnassigned && b.isUnassigned) return 0;
            return a.number?.localeCompare?.(b.number, undefined, { numeric: true }) ?? 0;
          });

        for (const unit of units) {
          const rowStart = acc, rowEnd = acc + active.ROW_HEIGHT;
          if (yPosition >= rowStart && yPosition < rowEnd) {
            return {
              rowType: unit.isUnassigned ? 'allocate' : 'unit', // safety
              roomTypeId: rt.id,
              roomUnitId: unit.isUnassigned ? null : unit.id
            };
          }
          acc = rowEnd;
        }
      }
      return { rowType: 'none', roomTypeId: undefined, roomUnitId: undefined };
    };


  /**
   * Handle HTML5 drag start from ReservationBar
   */
  const handleDragStart = (dragData) => {
    // Lock grid constants during drag to prevent misalignment from responsive changes
    const currentConstants = GridUtils.getCurrentConstants(windowWidth);
    setLockedGridConstants(currentConstants);
    
    console.log('Drag started - locking grid constants:', currentConstants);
    
    setDragState({
      reservation: dragData.reservation,
      dragType: dragData.dragType,
      startX: dragData.startX,
      startY: dragData.startY,
      originalReservation: { ...dragData.reservation },
      lockedConstants: currentConstants 
      // Store with drag state for reference
    });
    lastStableTargetRef.current = dragData.reservation.roomUnitId ?? '__UNASSIGNED__';
    lastSwitchYRef.current = dragData.startY;
  };

  /**
   * Handle HTML5 drag over for drop zones with separated drag type handling
   * Enhanced with comprehensive error handling and fallback mechanisms
   */
  const handleDragOver = (event) => {
    event.preventDefault(); // Allow drop
    
    if (!dragState) return;

     // add scroll offsets so coordinates are relative to the scrolled content
      const scrollY = gridRef.current?.scrollTop  || 0;
      const scrollX = gridRef.current?.scrollLeft || 0;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      console.warn('Grid ref not available during drag over');
      return;
    }

    try {
      // Use locked grid constants during drag to prevent misalignment
      const activeConstants = lockedGridConstants || gridConstants;
      
      // Calculate position relative to grid using locked sidebar width
       const relativeX = event.clientX - rect.left - activeConstants.SIDEBAR_WIDTH + scrollX;
       const relativeY = event.clientY - rect.top + scrollY;

       let candidateTarget = findTargetRoomUnitFromPosition(relativeY);

        // Treat null as a stable key as well
        const candidateKey = candidateTarget ?? '__UNASSIGNED__';

        // Initialize sticky memory if needed
        if (lastStableTargetRef.current == null) {
          lastStableTargetRef.current = candidateKey;
          lastSwitchYRef.current = event.clientY;
        }

        const STICKY_PX = activeConstants.ROW_HEIGHT * 0.35; // 35% of row height
        if (candidateKey !== lastStableTargetRef.current) {
          const dy = Math.abs(event.clientY - lastSwitchYRef.current);
          if (dy < STICKY_PX) {
            // stay on the previous row to avoid bouncing
            candidateTarget = (lastStableTargetRef.current === '__UNASSIGNED__') ? null : lastStableTargetRef.current;
          } else {
            // ok, switch to the new row and remember where the switch happened
            lastStableTargetRef.current = candidateKey;
            lastSwitchYRef.current = event.clientY;
          }
        }

      // Debug logging for resize operations
      if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
        console.log(`Resize drag over: relativeX=${relativeX}, dragType=${dragState.dragType}`);
      }

      // Handle different drag types with strict separation
      let updatedReservation = { ...dragState.originalReservation };
      const allReservations = [...reservations, ...segments];
      let previewCreated = false;
      
      switch (dragState.dragType) {
        case 'move-vertical':
          // PURE VERTICAL DRAG: Only change room unit, preserve dates exactly
          const targetRoomUnitId = findTargetRoomUnitFromPosition(relativeY);
          if (targetRoomUnitId !== undefined) {  
            let targetReservation = null;
            if (targetRoomUnitId !== null && !isHorizontalMode) { // Disable swap in horizontal mode
              const candidate = SwapUtils.findReservationAtPosition(
                relativeX, relativeY, allReservations, startDate, gridConstants, roomHierarchy, expandedRoomTypes
              );
              // Guard: swap only if the found reservation is in THIS exact row
              if (candidate && candidate.roomUnitId === targetRoomUnitId) {
                targetReservation = candidate;
              }                
            }
                      
            // Pure vertical swap: trigger if dragging to a room with any reservation (disabled in horizontal mode)
            if (targetReservation && 
                targetReservation.id !== dragState.originalReservation.id &&
                dragState.originalReservation.roomUnitId !== targetRoomUnitId &&
                !isHorizontalMode) { // Disable swap in horizontal mode
              // SWAP OPERATION: Check if swap is possible
              console.log('Swap detection:', {
                dragged: dragState.originalReservation.booking_name || dragState.originalReservation.id,
                target: targetReservation.booking_name || targetReservation.id,
                draggedId: dragState.originalReservation.id,
                targetId: targetReservation.id
              });
              
              const swapPreview = SwapUtils.getSwapPreview(
                dragState.originalReservation, 
                targetReservation, 
                allReservations
              );
              
              if (swapPreview.canSwap) {
                // Set swap state for visual feedback
                setSwapState({
                  draggedReservation: dragState.originalReservation,
                  targetReservation: targetReservation,
                  swapPreview: swapPreview.previewReservations
                });
                
                // Create preview for the dragged reservation in its new position
                updatedReservation = {
                  ...swapPreview.previewReservations.draggedPreview,
                  isSwapPreview: true,
                  swapType: 'dragged'
                };
                previewCreated = true;
                console.log('Valid swap preview created');
              } else {
                // Invalid swap - show with special handling to distinguish from regular conflicts
                console.log('Invalid swap:', swapPreview.reason);
                updatedReservation = {
                  ...dragState.originalReservation,
                  roomUnitId: targetRoomUnitId,
                  isInvalidSwap: true, // Use different flag than hasSwapConflict
                  invalidSwapReason: swapPreview.reason,
                  // Mark this as a swap attempt so conflict logic handles it differently
                  isSwapAttempt: true
                };
                previewCreated = true;
                
                // Set swap state to show both reservations during invalid swap
                setSwapState({
                  draggedReservation: dragState.originalReservation,
                  targetReservation: targetReservation,
                  swapPreview: null, // No preview for invalid swap
                  isInvalidSwap: true,
                  invalidSwapReason: swapPreview.reason
                });
              }
            } else {
              // NORMAL MOVE: No target reservation, just move to new room
              updatedReservation = {
                ...dragState.originalReservation,
                // Preserve original dates exactly - no horizontal movement
                startDate: dragState.originalReservation.startDate,
                endDate: dragState.originalReservation.endDate,
                // Only change room unit
                roomUnitId: targetRoomUnitId
              };
              previewCreated = true;
              
              // Clear any existing swap state
              setSwapState(null);
            }
          }
          break;

        case 'move-horizontal':
          // PURE HORIZONTAL DRAG: Only change dates, preserve room unit exactly
          try {
            const dayOffset = Math.round(relativeX / activeConstants.CELL_WIDTH);
            const targetDate = DateUtils.addDays(startDate, dayOffset);
            
            console.log(`Horizontal move: dayOffset=${dayOffset}, targetDate=${targetDate}`);
            
            // Calculate how many days to shift the entire reservation
            const originalStartOffset = DateUtils.daysBetween(startDate, dragState.originalReservation.startDate);
            const dateDelta = dayOffset - originalStartOffset;
            
            // Shift both start and end dates by the same amount
            const newStartDate = DateUtils.addDays(dragState.originalReservation.startDate, dateDelta);
            const newEndDate = DateUtils.addDays(dragState.originalReservation.endDate, dateDelta);
            
            updatedReservation = {
              ...dragState.originalReservation,
              // Only change dates
              startDate: newStartDate,
              endDate: newEndDate,
              // Preserve original room unit exactly - no vertical movement
              roomUnitId: dragState.originalReservation.roomUnitId
            };
            
            // Add horizontal move preview data
            updatedReservation.horizontalMovePreviewData = {
              dateDelta: dateDelta,
              originalStartDate: dragState.originalReservation.startDate,
              originalEndDate: dragState.originalReservation.endDate,
              newStartDate: newStartDate,
              newEndDate: newEndDate
            };
            
            previewCreated = true;
            console.log('Horizontal move preview created:', updatedReservation);
          } catch (horizontalMoveError) {
            console.error('Horizontal move failed:', horizontalMoveError);
            updatedReservation = { ...dragState.originalReservation };
            previewCreated = true;
          }
          break;
            
        case 'resize-horizontal':
          // MODE-BASED RESIZE: Full reservation bar drag for date adjustment
          try {
            const dayOffset = Math.round(relativeX / activeConstants.CELL_WIDTH);
            const targetDate = DateUtils.addDays(startDate, dayOffset);
            
            console.log(`Mode-based resize: dayOffset=${dayOffset}, targetDate=${targetDate}`);
            
            // Calculate reservation position to determine drag direction
            const reservationDayOffset = DateUtils.daysBetween(startDate, dragState.originalReservation.startDate);
            const reservationDuration = DateUtils.daysBetween(dragState.originalReservation.startDate, dragState.originalReservation.endDate);
            const reservationLeftPosition = reservationDayOffset * activeConstants.CELL_WIDTH;
            const reservationWidth = reservationDuration * activeConstants.CELL_WIDTH;
            
            // For full bar resize, determine which edge to move based on drag direction
            // Use wider detection zones: left 40%, center 20%, right 40% 
            const leftZoneEnd = reservationLeftPosition + (reservationWidth * 0.4);
            const rightZoneStart = reservationLeftPosition + (reservationWidth * 0.6);
            
            let dragDirection;
            if (relativeX < leftZoneEnd) {
              dragDirection = 'resize-left';
            } else if (relativeX > rightZoneStart) {
              dragDirection = 'resize-right';
            } else {
              // In the center zone (20%), prefer the direction based on which side is closer
              const centerPoint = reservationLeftPosition + (reservationWidth / 2);
              dragDirection = relativeX < centerPoint ? 'resize-left' : 'resize-right';
            }
            
            let resizePreview;
            try {
              resizePreview = ResizeUtils.getResizePreview(
                dragState.originalReservation,
                targetDate,
                dragDirection,
                allReservations
              );
            } catch (resizeError) {
              console.warn('Mode-based resize failed, creating fallback:', resizeError);
              // Fallback: simple date adjustment
              resizePreview = {
                startDate: dragDirection === 'resize-left' ? targetDate : dragState.originalReservation.startDate,
                endDate: dragDirection === 'resize-right' ? targetDate : dragState.originalReservation.endDate,
                duration: Math.max(1, DateUtils.daysBetween(
                  dragDirection === 'resize-left' ? targetDate : dragState.originalReservation.startDate,
                  dragDirection === 'resize-right' ? targetDate : dragState.originalReservation.endDate
                )),
                isValid: true,
                hasConflicts: false,
                validationReason: null,
                wasConstrained: false
              };
            }
            
            updatedReservation = {
              ...dragState.originalReservation,
              startDate: resizePreview.startDate,
              endDate: resizePreview.endDate,
              roomUnitId: dragState.originalReservation.roomUnitId // Preserve room
            };
            
            updatedReservation.resizePreviewData = {
              duration: resizePreview.duration,
              originalDuration: DateUtils.daysBetween(dragState.originalReservation.startDate, dragState.originalReservation.endDate),
              isValid: resizePreview.isValid,
              hasConflicts: resizePreview.hasConflicts,
              validationReason: resizePreview.validationReason,
              wasConstrained: resizePreview.wasConstrained,
              dragDirection: dragDirection
            };
            
            // Store original dates for comparison
            updatedReservation.originalStartDate = dragState.originalReservation.startDate;
            updatedReservation.originalEndDate = dragState.originalReservation.endDate;
            
            previewCreated = true;
            console.log('Mode-based resize preview created:', updatedReservation);
          } catch (resizeError) {
            console.error('Mode-based resize failed:', resizeError);
            updatedReservation = { ...dragState.originalReservation };
            previewCreated = true;
          }
          break;

        case 'resize-left':
        case 'resize-right':
          try {
            // PURE HORIZONTAL DRAG: Only change dates, preserve room unit exactly
            // Use fractional positioning for more responsive drag detection
            const exactDayOffset = relativeX / activeConstants.CELL_WIDTH;
            const dayOffset = Math.round(exactDayOffset);
            const targetDate = DateUtils.addDays(startDate, dayOffset);
            
            console.log(`Resize calculation: exactDayOffset=${exactDayOffset}, dayOffset=${dayOffset}, targetDate=${targetDate}`);
            
            // Always create a preview for resize operations, even if validation fails
            let resizePreview;
            try {
              resizePreview = ResizeUtils.getResizePreview(
                dragState.originalReservation,
                targetDate,
                dragState.dragType,
                allReservations
              );
            } catch (resizeError) {
              console.warn('ResizeUtils failed, creating fallback preview:', resizeError);
              // Fallback: create basic resize preview without validation
              resizePreview = {
                startDate: dragState.dragType === 'resize-left' ? targetDate : dragState.originalReservation.startDate,
                endDate: dragState.dragType === 'resize-right' ? targetDate : dragState.originalReservation.endDate,
                duration: Math.max(1, DateUtils.daysBetween(
                  dragState.dragType === 'resize-left' ? targetDate : dragState.originalReservation.startDate,
                  dragState.dragType === 'resize-right' ? targetDate : dragState.originalReservation.endDate
                )),
                isValid: true, // Allow the operation to proceed
                hasConflicts: false,
                validationReason: null,
                wasConstrained: false
              };
            }
            
            updatedReservation = {
              ...dragState.originalReservation,
              // Only change dates
              startDate: resizePreview.startDate,
              endDate: resizePreview.endDate,
              // Preserve original room unit exactly - no vertical movement
              roomUnitId: dragState.originalReservation.roomUnitId
            };
            
            // Add additional preview data for better UX
            updatedReservation.resizePreviewData = {
              duration: resizePreview.duration,
              originalDuration: DateUtils.daysBetween(dragState.originalReservation.startDate, dragState.originalReservation.endDate),
              isValid: resizePreview.isValid,
              hasConflicts: resizePreview.hasConflicts,
              validationReason: resizePreview.validationReason,
              wasConstrained: resizePreview.wasConstrained
            };
            
            // Store original dates for comparison
            updatedReservation.originalStartDate = dragState.originalReservation.startDate;
            updatedReservation.originalEndDate = dragState.originalReservation.endDate;
            
            previewCreated = true;
            console.log('Resize preview created successfully:', updatedReservation);
          } catch (resizeError) {
            console.error('Resize operation failed completely:', resizeError);
            // Create minimal fallback preview to avoid complete failure
            updatedReservation = {
              ...dragState.originalReservation,
              resizePreviewData: {
                duration: DateUtils.daysBetween(dragState.originalReservation.startDate, dragState.originalReservation.endDate),
                isValid: false,
                hasConflicts: true,
                validationReason: 'Resize calculation error',
                wasConstrained: false
              }
            };
            previewCreated = true; // Still create preview to show error state
          }
          break;
            
        case 'split':
          // Split operation: calculate both room and date
          const splitTargetRoomUnitId = findTargetRoomUnitFromPosition(relativeY);
          const splitDayOffset = Math.round(relativeX / activeConstants.CELL_WIDTH);
          const splitTargetDate = DateUtils.addDays(startDate, splitDayOffset);
          
          if (splitTargetDate > dragState.originalReservation.startDate && 
              splitTargetDate < dragState.originalReservation.endDate) {
            updatedReservation.splitDate = splitTargetDate;
            updatedReservation.splitRoomUnitId = splitTargetRoomUnitId;
            previewCreated = true;
          }
          break;
          
        default:
          // Fallback - should not happen with new system
          console.warn(`Unknown drag type: ${dragState.dragType}`);
          return;
      }

      // Always try to create a preview if we got this far
      if (previewCreated) {
        // Apply appropriate conflict checking based on drag type
        let hasConflict = false;
        
        try {
          if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right' || dragState.dragType === 'resize-horizontal') {
            // For resize operations, use the preview data (more lenient)
            hasConflict = updatedReservation.resizePreviewData?.hasConflicts || false;
          } else if (dragState.dragType === 'move-vertical') {
            // For vertical moves, distinguish between swap attempts and regular conflicts
            if (updatedReservation.isSwapAttempt && updatedReservation.isInvalidSwap) {
              // Invalid swap - treat differently from regular conflicts
              // Show as orange/warning zone instead of red conflict zone
              hasConflict = false; // Don't treat as regular conflict
            } else if (updatedReservation.isSwapPreview) {
              // Valid swap preview - no conflict checking needed
              hasConflict = false;
            } else {
              // Regular move - check for conflicts
              hasConflict = checkForConflicts(updatedReservation);
            }
          }
        } catch (conflictError) {
          console.warn('Conflict checking failed, assuming no conflicts:', conflictError);
          hasConflict = false; // Be lenient on conflict checking failures
        }
        
        // Set preview with enhanced data and operation-specific flags
        const preview = {
          ...updatedReservation,
          hasConflict,
          isResizePreview: dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right' || dragState.dragType === 'resize-horizontal',
          isModeBasedResize: dragState.dragType === 'resize-horizontal',
          isMovePreview: dragState.dragType === 'move-vertical',
          resizeValid: updatedReservation.resizePreviewData?.isValid !== false,
          dragType: dragState.dragType // Add for visual feedback
        };
        
        setPreviewReservation(preview);
        // console.log('Preview reservation set:', preview);
      } else {
        console.warn('Failed to create preview reservation');
      }
    } catch (error) {
      console.error('Error during drag over:', error);
      // Create emergency fallback preview to prevent complete failure
      try {
        setPreviewReservation({
          ...dragState.originalReservation,
          hasConflict: true,
          isResizePreview: dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right',
          isMovePreview: dragState.dragType === 'move-vertical',
          resizeValid: false,
          dragType: dragState.dragType,
          resizePreviewData: {
            duration: DateUtils.daysBetween(dragState.originalReservation.startDate, dragState.originalReservation.endDate),
            isValid: false,
            hasConflicts: true,
            validationReason: 'Drag calculation error',
            wasConstrained: false
          }
        });
      } catch (fallbackError) {
        console.error('Even fallback preview creation failed:', fallbackError);
      }
    }
  };

  /**
   * Handle HTML5 drop event with enhanced reliability
   */
  const handleDrop = (event) => {
    event.preventDefault();
    
    console.log('Drop event triggered:', { 
      hasDragState: !!dragState, 
      hasPreviewReservation: !!previewReservation,
      dragType: dragState?.dragType 
    });
    
    if (!dragState) {
      console.warn('Drop event without drag state');
      return;
    }
    
    if (!previewReservation) {
      console.warn('Drop event without preview reservation - this indicates a problem in handleDragOver');
      // Try to create a basic preview for resize operations as fallback
      if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
        console.log('Attempting fallback drop for resize operation');
        try {
          if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
            onReservationResize && onReservationResize(dragState.originalReservation, dragState.dragType);
            console.log('Fallback resize executed successfully');
          }
        } catch (fallbackError) {
          console.error('Fallback resize failed:', fallbackError);
        }
      }
      return;
    }

    try {
      console.log('Processing drop with preview:', previewReservation);
      
      // For resize operations, be more lenient with conflicts
      if ((dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') && previewReservation.hasConflict) {
        // Check if it's a minor conflict that can be ignored
        const isMinorConflict = previewReservation.resizePreviewData?.validationReason?.includes('Resize calculation error');
        if (!isMinorConflict) {
          console.warn('Cannot complete drop: conflicts detected', previewReservation.hasConflict);
          return;
        } else {
          console.log('Ignoring minor conflict for resize operation');
        }
      } else if (previewReservation.hasConflict && !previewReservation.isSwapPreview) {
        // Don't block swap operations due to conflicts - swap validation handles this separately
        console.warn('Cannot complete drop: conflicts detected');
        return;
      }

      // Execute the appropriate action based on drag type
      console.log(`Executing ${dragState.dragType} operation`);
      let operationSuccessful = false;
      
      switch (dragState.dragType) {
        case 'move-vertical':
          // Check if this is a swap operation
          if (swapState && swapState.swapPreview && previewReservation.isSwapPreview) {
            console.log('Attempting swap operation:', {
              hasCallback: !!onReservationSwap,
              draggedRes: swapState.draggedReservation?.id,
              targetRes: swapState.targetReservation?.id
            });
            
            if (onReservationSwap) {
              try {
                // Execute swap operation
                const swapResult = SwapUtils.performSwap(
                  swapState.draggedReservation, 
                  swapState.targetReservation
                );
                console.log('Calling onReservationSwap with:', swapResult);
                onReservationSwap(swapResult.swappedReservationA, swapResult.swappedReservationB);
                operationSuccessful = true;
                console.log('Swap operation completed successfully');
              } catch (swapError) {
                console.error('Error during swap execution:', swapError);
              }
            } else {
              console.error('onReservationSwap handler not available! Parent component must provide this callback.');
              // Fallback: show an alert to indicate the missing callback
              alert('Swap functionality requires the onReservationSwap callback to be implemented in the parent component.');
            }
          } else {
            // Normal move operation
            if (onReservationMove) {
              onReservationMove(previewReservation);
              operationSuccessful = true;
              console.log('Move operation completed');
            } else {
              console.warn('onReservationMove handler not available');
            }
          }
          break;
        case 'move-horizontal':
          // Horizontal move operation - only dates change, room stays the same
          if (onReservationMove) {
            onReservationMove(previewReservation);
            operationSuccessful = true;
            console.log('Horizontal move operation completed');
          } else {
            console.warn('onReservationMove handler not available');
          }
          break;
        case 'resize-horizontal':
          // Mode-based resize operation
          if (onReservationResize) {
            const dragDirection = previewReservation.resizePreviewData?.dragDirection || 'resize-right';
            onReservationResize(previewReservation, dragDirection);
            operationSuccessful = true;
            console.log(`Mode-based resize (${dragDirection}) operation completed`);
          } else {
            console.warn('onReservationResize handler not available');
          }
          break;
        case 'resize-left':
        case 'resize-right':
          if (onReservationResize) {
            onReservationResize(previewReservation, dragState.dragType);
            operationSuccessful = true;
            console.log(`Resize ${dragState.dragType} operation completed`);
          } else {
            console.warn('onReservationResize handler not available');
          }
          break;
        case 'split':
          if (onReservationSplit) {
            onReservationSplit(previewReservation);
            operationSuccessful = true;
            console.log('Split operation completed');
          } else {
            console.warn('onReservationSplit handler not available');
          }
          break;
        default:
          console.error('Unknown drag type in drop:', dragState.dragType);
      }
      
      if (!operationSuccessful) {
        console.error('Operation failed to execute');
      }
    } catch (error) {
      console.error('Error completing drop operation:', error);
      
      // Try one more fallback for resize operations
      if (dragState.dragType === 'resize-left' || dragState.dragType === 'resize-right') {
        try {
          console.log('Attempting emergency fallback for resize');
          onReservationResize && onReservationResize(dragState.originalReservation, dragState.dragType);
        } catch (emergencyError) {
          console.error('Emergency fallback also failed:', emergencyError);
        }
      }
    } finally {
      // Clean up drag state
      console.log('Cleaning up drag state');
      setDragState(null);
      setPreviewReservation(null);
      setSwapState(null); // Clear swap state
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
      // Unlock grid constants when drag completes
      console.log('Drag ended - unlocking grid constants');
      setLockedGridConstants(null);
      
      // Clean up drag state when drag operation completes
      setDragState(null);
      setPreviewReservation(null);
      setSwapState(null);
      lastStableTargetRef.current = null;
      lastSwitchYRef.current = 0; // Also clear swap state
    }
  };

  /**
   * Find target room unit based on Y position in grid - stabilized with locked constants
   * Enhanced to handle both assigned rooms and unassigned transitions, including placeholder rows
   */
  const findTargetRoomUnitFromPosition = (yPosition) => {
  const activeConstants = lockedGridConstants || gridConstants;
  let accumulatedHeight = 0;

   // Ignore the top/bottom edges of a row to avoid bleeding into neighbors
  const ROW_INSET = Math.round(activeConstants.ROW_HEIGHT * 0.15); // ~15%

  // room types ordered by sort_order
  const sortedRoomHierarchy = [...roomHierarchy].sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0));

  for (const roomType of sortedRoomHierarchy) {
    // 1) header height
    const headerEl = document.querySelector(`[data-room-type-header="${roomType.id}"]`);
    const headerHeight = headerEl?.offsetHeight || activeConstants.ROW_HEIGHT;
    const headerStart = accumulatedHeight;
    const headerEnd = accumulatedHeight + headerHeight;

       // If pointer is inside header → NOT droppable
      if (yPosition >= headerStart && yPosition < headerEnd) {
        return undefined;   // <-- header does nothing
      }
    accumulatedHeight = headerEnd;

    // 2) staging row (if enabled) — treat drop here as UNASSIGNED => return null
    if (showStagingRow) {
      const stagingStart = accumulatedHeight;
      const stagingEnd = accumulatedHeight + activeConstants.ROW_HEIGHT;
      if (yPosition >= stagingStart && yPosition < stagingEnd) {
        return null; // unassigned
      }
      accumulatedHeight = stagingEnd;
    }

    // 3) units of this type
      const units = (roomType.units || [])
        .filter(u => {
          if (showStagingRow) return !(u.isUnassigned || u.number === 'UNASSIGNED');
          if (u.isUnassigned || u.number === 'UNASSIGNED') {
            return hasUnassignedForType(roomType.id);
          }
          return true;
        })
        .slice()
        .sort((a, b) => {
          if (a.isUnassigned && !b.isUnassigned) return 1;
          if (!a.isUnassigned && b.isUnassigned) return -1;
          if (a.isUnassigned && b.isUnassigned) return 0;
          return a.number?.localeCompare?.(b.number, undefined, { numeric: true }) ?? 0;
        });

    for (const unit of units) {
      const rowStart = accumulatedHeight;
      const rowEnd = accumulatedHeight + activeConstants.ROW_HEIGHT;
      const edgeMargin = (unit.isUnassigned || unit.isPlaceholder)
          ? activeConstants.ROW_HEIGHT * 0.20   // 20% inner margin for allocation/unassigned
          : 0;

        const inside =
          yPosition >= (rowStart + edgeMargin) &&
          yPosition <  (rowEnd   - edgeMargin);

        if (inside) {
          // return null for allocation/unassigned so upstream logic knows it’s the allocate row
          return unit.isUnassigned ? null : unit.id;
        }

      // if (yPosition >= rowStart + ROW_INSET && yPosition < rowEnd - ROW_INSET) {
      //   return unit.isUnassigned ? null : unit.id; // unassigned rows still map to null
      // }
      accumulatedHeight = rowEnd;
    }
  }

  return undefined; // default to unassigned if somehow outside
};


  /**
   * Find target room unit based on vertical drag delta
   */
  const findTargetRoomUnit = (currentRoomUnitId, rowsDelta) => {
    if (!rowsDelta || rowsDelta === 0) return currentRoomUnitId;

    // Sort room types by sort_order to match rendering order
    const sortedRoomHierarchy = [...roomHierarchy].sort((a, b) => {
      const sortOrderA = a.sort_order || 0;
      const sortOrderB = b.sort_order || 0;
      return sortOrderA - sortOrderB;
    });

    // Flatten all room units with their indices
    const allUnits = [];
    let currentIndex = -1;
    
    sortedRoomHierarchy.forEach((roomType, typeIndex) => {
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
   * Handle reservation click to open drawer
   */
  const handleReservationClick = (reservation) => {
    console.log('TimelineGrid: Reservation clicked:', {
      reservation: reservation,
      hasId: !!reservation?.id,
      keys: reservation ? Object.keys(reservation) : [],
      reservationType: typeof reservation
    });
    
    if (!reservation) {
      console.error('TimelineGrid: No reservation data provided to handleReservationClick');
      return;
    }
    
    setSelectedReservation(reservation);
    setIsDrawerOpen(true);
    console.log('TimelineGrid: Drawer opened with reservation ID:', reservation.id || 'NO_ID');
  };

  /**
   * Handle drawer close
   */
  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    setSelectedReservation(null);
  };


  /**
   * Render room type header with accessibility improvements and availability timeline
   */
  const renderRoomTypeHeader = (roomType) => {
    const isExpanded = expandedRoomTypes.has(roomType.id);
    
    // Calculate unit count - include all units
    const unitCount = roomType.units?.length || 0;

    return (
      <div
        key={`roomtype-${roomType.id}`}
        className="bg-gray-200 border-b border-white sticky left-0 z-10 shadow-sm relative"
        style={{ height: `${gridConstants.ROW_HEIGHT}px` }}
        data-room-type-header={roomType.id}
      >
        {/* Left Side - Room Type Info Button */}
        <button
          type="button"
          onClick={() => toggleRoomType(roomType.id)}
          className="absolute left-0 top-0 h-full flex items-center justify-between px-3 md:px-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors duration-150 border-r border-white"
          style={{ 
            width: `${gridConstants.SIDEBAR_WIDTH}px`,
            height: `${gridConstants.ROW_HEIGHT}px` 
          }}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${roomType.name} room type with ${unitCount} unit${unitCount !== 1 ? 's' : ''}`}
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            )}
            
            <div className="min-w-0 flex-1">
              <div className="text-xs md:text-sm text-gray-900 truncate">
                {roomType.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {unitCount} unit{unitCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </button>

        {/* Right Side - Availability Timeline Grid */}
        <div 
          className="absolute top-0 h-full bg-gradient-to-r from-gray-100 to-gray-50 grid"
          style={{ 
            left: `${gridConstants.SIDEBAR_WIDTH}px`,
            right: 0,
            height: `${gridConstants.ROW_HEIGHT}px`,
            minWidth: `${dates.length * gridConstants.CELL_WIDTH}px`,
            gridTemplateColumns: `repeat(${dates.length}, ${gridConstants.CELL_WIDTH}px)`
          }}
        >
          {/* Day Header Cells with weekend styling */}
          {dates.map((date, index) => {
            const dateObj = new Date(date);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            const isWeekend = isSaturday || isSunday;
            const isToday = DateUtils.isToday(date);
            const availableUnits = calculateAvailabilityForDate(roomType, date);
            
            return (
              <div
                key={`header-cell-${roomType.id}-${date}`}
                className={`
                  relative ${isToday ? 'bg-orange-50' : 'bg-gray-200'} ${isSaturday || isSunday ? 'bg-gray-300' : 'bg-gray-200'} border-r border-b border-white flex items-center justify-center text-xs transition-all duration-200

                `}
                style={{
                  height: `${gridConstants.ROW_HEIGHT}px`,
                  minHeight: `${gridConstants.ROW_HEIGHT}px`
                }}
                data-date={date}
                data-is-weekend={isWeekend}
                data-is-saturday={isSaturday}
                data-is-sunday={isSunday}
              >
                {/* Day number and availability */}
                <div className="text-center">
                  <div className="text-xs text-gray-400">
                    {availableUnits}
                  </div>
                </div>
                
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  
  /**
   * Render room unit row with proper grid columns
   */
  const renderRoomUnitRow = (roomUnit, roomType) => {
    const roomReservations = getReservationsForRoom(roomUnit.id, roomType.id);
    const isUnassigned = roomUnit.isUnassigned || roomUnit.number === 'UNASSIGNED';
    
    return (
      <div
        key={`unit-${roomUnit.id || `unassigned-${roomType.id}`}`}
        className={`relative border-b border-white transition-colors duration-150 ${
          isUnassigned 
            ? 'border-orange-200 bg-orange-50/20 hover:bg-orange-50/40' 
            : 'border-gray-200 hover:bg-gray-50/30'
        }`}
        style={{ height: `${gridConstants.ROW_HEIGHT}px` }}
      >
        {/* Room Unit Label with special styling for unassigned */}
        <div 
          className={`absolute left-0 top-0 h-full flex items-center z-10 px-2 md:px-3 lg:px-4 ${
            isUnassigned 
              ? 'bg-orange-50 border-r border-orange-200' 
              : 'bg-gray-200 border-r border-white'
          }`}
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="pl-2 md:pl-4 lg:pl-6 min-w-0 flex-1">
            <div className={`text-xs md:text-sm font-medium truncate ${
              isUnassigned ? 'text-orange-700' : 'text-gray-900'
            }`}>
              {isUnassigned ? 'Unassigned' : roomUnit.number}
            </div>
            {isUnassigned ? (
              <div className="text-xs text-orange-600 truncate">
                Drag to assign
              </div>
            ) : roomUnit.floor_number && (
              <div className="text-xs text-gray-500 truncate">
                Floor {roomUnit.floor_number}
              </div>
            )}
          </div>
        </div>

        {/* Grid Timeline Area with proper column structure */}
        <div 
          className="relative grid"
          style={{ 
            marginLeft: `${gridConstants.SIDEBAR_WIDTH}px`,
            minWidth: `${dates.length * gridConstants.CELL_WIDTH}px`,
            gridTemplateColumns: `repeat(${dates.length}, ${gridConstants.CELL_WIDTH}px)`
          }}
        >
          {/* Day Column Cells with enhanced weekend styling */}
          {dates.map((date, index) => {
            const isToday = DateUtils.isToday(date);
            const isWeekend = DateUtils.isWeekend(date);
            const isPast = DateUtils.isPast(date);
            const isDragHover = dragState && 
              previewReservation && 
              previewReservation.roomUnitId === roomUnit.id;
            const isValidDropZone = isDragHover && !previewReservation.hasConflict && !previewReservation.isInvalidSwap;
            const isInvalidDropZone = isDragHover && previewReservation.hasConflict && !previewReservation.isInvalidSwap;
            const isInvalidSwapZone = isDragHover && previewReservation.isInvalidSwap;
            
            // Get the day of week for the date
            const dateObj = new Date(date);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
            const isSaturday = dayOfWeek === 6;
            const isSunday = dayOfWeek === 0;
            
            return (
              <div
                key={`cell-${date}`}
                className={`
                  relative border-r border-b border-white transition-all duration-200 ease-in-out
                  ${isUnassigned ? 'bg-gray-100' : 'bg-gray-200'}
                  ${isValidDropZone ? '!bg-emerald-50 border border-emerald-300 shadow-sm' : ''}
                  ${isInvalidDropZone ? '!bg-red-50 border border-red-300 shadow-sm' : ''}
                  ${isInvalidSwapZone ? '!bg-orange-50 border border-orange-300 shadow-sm' : ''}
                  ${isToday && !isValidDropZone && !isInvalidDropZone && !isInvalidSwapZone ? '!bg-orange-50' : ''}
                  ${!isUnassigned && !isWeekend && !isToday && !isValidDropZone && !isInvalidDropZone && !isInvalidSwapZone ? 'bg-gray-200' : !isUnassigned && isWeekend && !isToday && !isValidDropZone && !isInvalidDropZone && !isInvalidSwapZone ? 'bg-gray-300' : ''}
                  ${!dragState && !isPast && !isValidDropZone && !isInvalidDropZone && !isInvalidSwapZone ? 'hover:bg-gray-50 hover:shadow-sm' : ''}
                  ${isPast ? 'opacity-90' : ''}
                `}
                style={{
                  height: `${gridConstants.ROW_HEIGHT}px`,
                  minHeight: `${gridConstants.ROW_HEIGHT}px`
                }}
                data-date={date}
                data-room-unit-id={roomUnit.id}
                data-is-weekend={isWeekend}
                data-is-saturday={isSaturday}
                data-is-sunday={isSunday}
              >
                {/* Day number in cell - centered */}
                <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-100 pointer-events-none">
                  {new Date(date).getDate()}
                </div>
              </div>
            );
          })}

          {/* Overlay container for reservations to span across grid columns */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              gridColumn: '1 / -1',
              gridRow: '1'
            }}
          >
            {/* Reservations */}
            {roomReservations
              .filter(reservation => {
                // Filter out null, undefined, or invalid reservations
                return reservation && 
                       reservation.id && 
                       reservation.startDate && 
                       reservation.endDate &&
                       reservation.startDate !== reservation.endDate; // Ensure valid duration
              })
              .map((reservation) => {
                // Only hide original reservation during resize operations if we have a valid preview
                const isBeingResized = dragState?.reservation?.id === reservation.id && 
                                     (dragState?.dragType === 'resize-left' || 
                                      dragState?.dragType === 'resize-right' || 
                                      dragState?.dragType === 'resize-horizontal'); // Include mode-based resize
                const hasValidPreview = previewReservation && previewReservation.roomUnitId === roomUnit.id;
                
                // Check if this is the target reservation in a swap operation
                const isSwapTarget = swapState && 
                                  swapState.targetReservation && 
                                  swapState.targetReservation.id === reservation.id;
                
                // Conservative hiding: only hide if being resized AND we have a valid preview
                if (isBeingResized && hasValidPreview) {
                  return null; // Don't render original during resize - preview will show instead
                }
                
                // Hide the original dragged reservation during swap (its preview will show in new position)
                if (dragState?.reservation?.id === reservation.id && dragState?.dragType === 'move-vertical' && swapState) {
                  return null;
                }
                
                return (
                  <div
                    key={`res-${reservation.id}-${reservation.segmentId || 'main'}`}
                    className="pointer-events-auto"
                    style={{
                      position: 'absolute',
                      top: 0,
                      height: '100%'
                    }}
                  >
                    <ReservationBar
                      reservation={reservation}
                      startDate={startDate}
                      dates={dates}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onReservationClick={handleReservationClick}
                      isDragging={dragState?.reservation?.id === reservation.id}
                      showHandles={!loading}
                      enableSplit={!reservation.isSegment} // Only allow splitting on main reservations
                      isResizeMode={isResizeMode} // Pass mode state to reservation bars
                      isHorizontalMode={isHorizontalMode} // Pass horizontal mode state to reservation bars
                      isSwapTarget={isSwapTarget} // Add swap target indicator
                    />
                  </div>
                );
              })}

            {/* Preview Reservation (during drag) */}
            {previewReservation && previewReservation.roomUnitId === roomUnit.id && (
              <div
                key="preview"
                className="pointer-events-auto"
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '100%'
                }}
              >
                <ReservationBar
                  reservation={previewReservation}
                  startDate={startDate}
                  dates={dates}
                  isPreview={true}
                  hasConflict={previewReservation.hasConflict}
                  showHandles={false}
                />
              </div>
            )}
            
            {/* Target Reservation Preview (during swap) */}
            {swapState && swapState.swapPreview && swapState.swapPreview.targetPreview && 
             swapState.swapPreview.targetPreview.roomUnitId === roomUnit.id && (
              <div
                key="swap-target-preview"
                className="pointer-events-auto"
                style={{
                  position: 'absolute',
                  top: 0,
                  height: '100%'
                }}
              >
                <ReservationBar
                  reservation={swapState.swapPreview.targetPreview}
                  startDate={startDate}
                  dates={dates}
                  isPreview={true}
                  isSwapPreview={true}
                  swapType="target"
                  showHandles={false}
                />
              </div>
            )}
          </div>
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
    <div className="">
    </div>
  );


  if (roomHierarchy.length === 0) {
    return renderEmptyState();
  }

  return (
    <div 
      className={`relative bg-white border-r border-gray-200 ${className}`} 
      ref={gridRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
      style={{
        width: '100%',
        minWidth: `${gridConstants.SIDEBAR_WIDTH + (dates.length * gridConstants.CELL_WIDTH)}px`
      }}
    >
      
      {/* Room Types and Units */}
      {roomHierarchy
        .sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((roomType) => {
          const isExpanded = expandedRoomTypes.has(roomType.id);

          return (
            <div key={roomType.id}>
              {/* Header */}
              {renderRoomTypeHeader(roomType)}

              {/* Staging row under this header */}
              {renderTypeStagingRow(roomType)}

              {/* Units (respect expanded) */}
              {isExpanded && roomType.units && (() => {
                  // Clone and (optionally) remove unassigned rows when Allocate Mode is ON
                 let unitsToRender = [...(roomType.units || [])].filter(u => {
                    // Hide unassigned rows entirely during Allocate Mode
                    if (showStagingRow) return !(u.isUnassigned || u.number === 'UNASSIGNED');
                    // When Allocate Mode is OFF: show Unassigned row only if there are items
                    if (u.isUnassigned || u.number === 'UNASSIGNED') {
                      return hasUnassignedForType(roomType.id);
                    }
                    return true;
                  });
                return unitsToRender
                  .sort((a,b) => {
                    if (a.isUnassigned && !b.isUnassigned) return 1;
                    if (!a.isUnassigned && b.isUnassigned) return -1;
                    if (a.isUnassigned && b.isUnassigned) return 0;
                    return a.number.localeCompare(b.number, undefined, { numeric: true });
                  })
                  .map((roomUnit) => renderRoomUnitRow(roomUnit, roomType));
              })()}
            </div>
          );
        })}

          
      {/* Drag Overlay with mode-specific cursor */}
      {dragState && (
        <div 
          className="absolute inset-0 z-40"
          style={{ 
            pointerEvents: 'none',
            cursor: isResizeMode ? 'ew-resize' : 'ns-resize'
          }}
        />
      )}

      {/* Reservation Drawer */}
      <ReservationDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        reservation={selectedReservation}
      />
    </div>
  );
}

/**
 * TimelineGrid component with room hierarchy and drag/drop
 */
TimelineGrid.displayName = 'TimelineGrid';
