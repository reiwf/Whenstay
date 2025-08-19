import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Move, Scaling } from 'lucide-react';
import ReservationBar from './ReservationBar';
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
  const gridRef = useRef(null);

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

  /**
   * Get all reservations for a specific room unit
   */
  const getReservationsForRoom = (roomUnitId) => {
    const regularReservations = reservations.filter(r => r.roomUnitId === roomUnitId);
    const segmentReservations = segments.filter(s => s.roomUnitId === roomUnitId);
    return [...regularReservations, ...segmentReservations];
  };

  /**
   * Calculate availability for a room type on a specific date
   */
  const calculateAvailabilityForDate = (roomType, date) => {
    if (!roomType.units || roomType.units.length === 0) return 0;
    
    const totalUnits = roomType.units.length;
    let occupiedUnits = 0;
    
    // Get all active reservations and segments
    const allActiveReservations = [
      ...reservations.filter(r => r.status && !['cancelled', 'no_show'].includes(r.status)),
      ...segments.filter(s => s.status && !['cancelled', 'no_show'].includes(s.status))
    ];
    
    // Count units that are occupied on this specific date
    roomType.units.forEach(unit => {
      const unitReservations = allActiveReservations.filter(r => r.roomUnitId === unit.id);
      const isOccupied = unitReservations.some(reservation => 
        date >= reservation.startDate && date < reservation.endDate
      );
      if (isOccupied) {
        occupiedUnits++;
      }
    });
    
    return totalUnits - occupiedUnits;
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
      lockedConstants: currentConstants // Store with drag state for reference
    });
  };

  /**
   * Handle HTML5 drag over for drop zones with separated drag type handling
   * Enhanced with comprehensive error handling and fallback mechanisms
   */
  const handleDragOver = (event) => {
    event.preventDefault(); // Allow drop
    
    if (!dragState) return;

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) {
      console.warn('Grid ref not available during drag over');
      return;
    }

    try {
      // Use locked grid constants during drag to prevent misalignment
      const activeConstants = lockedGridConstants || gridConstants;
      
      // Calculate position relative to grid using locked sidebar width
      const relativeX = event.clientX - rect.left - activeConstants.SIDEBAR_WIDTH;
      const relativeY = event.clientY - rect.top; // No mode toggle header anymore

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
          if (targetRoomUnitId) {
            // Check if dragging over another reservation for potential swap (VERTICAL DETECTION)
            const targetReservation = SwapUtils.findReservationAtPosition(
              relativeX, relativeY, allReservations, startDate, gridConstants, roomHierarchy, expandedRoomTypes
            );
            
            console.log('Vertical swap detection:', { 
              targetReservation: targetReservation?.id, 
              targetRoom: targetRoomUnitId,
              originalRoom: dragState.originalReservation.roomUnitId,
              differentRooms: dragState.originalReservation.roomUnitId !== targetRoomUnitId
            });
            
            // Pure vertical swap: trigger if dragging to a room with any reservation
            if (targetReservation && 
                targetReservation.id !== dragState.originalReservation.id &&
                dragState.originalReservation.roomUnitId !== targetRoomUnitId) {
              // SWAP OPERATION: Check if swap is possible
              console.log('Swap detection:', {
                dragged: dragState.originalReservation.bookingName || dragState.originalReservation.id,
                target: targetReservation.bookingName || targetReservation.id,
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
                // Invalid swap - show conflict
                console.log('Invalid swap:', swapPreview.reason);
                updatedReservation = {
                  ...dragState.originalReservation,
                  roomUnitId: targetRoomUnitId,
                  hasSwapConflict: true,
                  swapConflictReason: swapPreview.reason
                };
                previewCreated = true;
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
            const dragDirection = relativeX > (reservationLeftPosition + reservationWidth / 2) ? 'resize-right' : 'resize-left';
            
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
            const dayOffset = Math.round(relativeX / activeConstants.CELL_WIDTH);
            const targetDate = DateUtils.addDays(startDate, dayOffset);
            
            console.log(`Resize calculation: dayOffset=${dayOffset}, targetDate=${targetDate}`);
            
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
            // For vertical moves, check conflicts in the new room
            hasConflict = checkForConflicts(updatedReservation);
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
      setSwapState(null); // Also clear swap state
    }
  };

  /**
   * Find target room unit based on Y position in grid - stabilized with locked constants
   */
  const findTargetRoomUnitFromPosition = (yPosition) => {
    // Use locked grid constants during drag for consistency
    const activeConstants = lockedGridConstants || gridConstants;
    let accumulatedHeight = 0;
    
    console.log('Finding room from position:', yPosition, 'with constants:', activeConstants);
    
    for (const roomType of roomHierarchy) {
      // Add room type header height using stable constants
      // Use actual rendered header height for more accurate positioning
      const headerEl = document.querySelector(
        `[data-room-type-header="${roomType.id}"]`
      );
      const headerHeight = headerEl?.offsetHeight || gridConstants.ROW_HEIGHT;
      accumulatedHeight += headerHeight;
      
      if (expandedRoomTypes.has(roomType.id) && roomType.units) {
        for (const unit of roomType.units) {
          // More precise detection with locked constants
          const rowStart = accumulatedHeight;
          const rowEnd = accumulatedHeight + activeConstants.ROW_HEIGHT;
          const tolerance = activeConstants.ROW_HEIGHT * 0.1; // Reduced tolerance for more accuracy
          
          console.log(`Checking unit ${unit.number}: rowStart=${rowStart}, rowEnd=${rowEnd}, tolerance=${tolerance}`);
          
          if (yPosition >= (rowStart - tolerance) && yPosition < (rowEnd + tolerance)) {
            console.log(`Found target room: ${unit.id} (${unit.number})`);
            return unit.id;
          }
          accumulatedHeight += activeConstants.ROW_HEIGHT;
        }
      }
    }
    
    console.log('No target room found for position:', yPosition);
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
   * Render room type header with accessibility improvements and availability timeline
   */
  const renderRoomTypeHeader = (roomType) => {
    const isExpanded = expandedRoomTypes.has(roomType.id);
    const unitCount = roomType.units?.length || 0;

    return (
      <div
        key={`roomtype-${roomType.id}`}
        className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200 sticky left-0 z-10 shadow-sm relative"
        style={{ height: `${gridConstants.ROW_HEIGHT}px` }}
        data-room-type-header={roomType.id}
      >
        {/* Left Side - Room Type Info Button */}
        <button
          type="button"
          onClick={() => toggleRoomType(roomType.id)}
          className="absolute left-0 top-0 h-full flex items-center justify-between px-3 md:px-4 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors duration-150 border-r border-gray-200"
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
              <div className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                {roomType.name}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {unitCount} unit{unitCount !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </button>

        {/* Right Side - Availability Timeline */}
        <div 
          className="absolute top-0 h-full bg-gradient-to-r from-gray-100 to-gray-50"
          style={{ 
            left: `${gridConstants.SIDEBAR_WIDTH}px`,
            right: 0,
            height: `${gridConstants.ROW_HEIGHT}px`,
            minWidth: `${dates.length * gridConstants.CELL_WIDTH}px`
          }}
        >
          {/* Vertical Grid Lines */}
          {dates.map((date, index) => (
            <div
              key={`header-gridline-${roomType.id}-${date}`}
              className="absolute top-0 bottom-0 border-r border-gray-200"
              style={{
                left: `${index * gridConstants.CELL_WIDTH}px`,
                width: '1px'
              }}
            />
          ))}

          {/* Availability Numbers */}
          {dates.map((date, index) => {
            const availableUnits = calculateAvailabilityForDate(roomType, date);
            
            return (
              <div
                key={`header-availability-${roomType.id}-${date}`}
                className="absolute top-0 bottom-0 flex items-center justify-center text-xs text-gray-500"
                style={{
                  left: `${index * gridConstants.CELL_WIDTH}px`,
                  width: `${gridConstants.CELL_WIDTH}px`
                }}
              >
                {availableUnits}
              </div>
            );
          })}
        </div>
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
        className="relative border-b border-gray-200 hover:bg-gray-50/30 transition-colors duration-150"
        style={{ height: `${gridConstants.ROW_HEIGHT}px` }}
      >
        {/* Room Unit Label with responsive styling */}
        <div 
          className="absolute left-0 top-0 h-full bg-white border-r border-gray-200 flex items-center z-10 px-2 md:px-3 lg:px-4"
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="pl-2 md:pl-4 lg:pl-6 min-w-0 flex-1">
            <div className="text-xs md:text-sm font-medium text-gray-900 truncate">
              {roomUnit.number}
            </div>
            {roomUnit.floor_number && (
              <div className="text-xs text-gray-500 truncate">
                Floor {roomUnit.floor_number}
              </div>
            )}
          </div>
        </div>

        {/* Timeline Area with responsive width */}
        <div 
          className="relative"
          style={{ 
            marginLeft: `${gridConstants.SIDEBAR_WIDTH}px`,
            minWidth: `${dates.length * gridConstants.CELL_WIDTH}px` 
          }}
        >
          {/* Grid Lines with responsive spacing */}
          {dates.map((date, index) => (
            <div
              key={`gridline-${date}`}
              className="absolute top-0 bottom-0 border-r border-gray-100"
              style={{
                left: `${index * gridConstants.CELL_WIDTH}px`,
                width: '1px'
              }}
            />
          ))}

          {/* Date Cells with modern hover effects */}
          {dates.map((date, index) => {
            const isToday = DateUtils.isToday(date);
            const isWeekend = DateUtils.isWeekend(date);
            const isPast = DateUtils.isPast(date);
            const isDragHover = dragState && 
              previewReservation && 
              previewReservation.roomUnitId === roomUnit.id;
            const isValidDropZone = isDragHover && !previewReservation.hasConflict;
            const isInvalidDropZone = isDragHover && previewReservation.hasConflict;
            
            return (
              <div
                key={`cell-${date}`}
                className={`
                  absolute top-0 bottom-0 transition-all duration-200 ease-in-out
                  ${!dragState && !isPast ? 'hover:bg-blue-50/50 hover:shadow-sm' : ''}
                  ${isToday ? 'bg-blue-100/40 border-l-2 border-blue-400' : ''}
                  ${isWeekend && !isToday ? 'bg-gray-50/60' : ''}
                  ${isPast ? 'bg-gray-50/30' : ''}
                  ${isValidDropZone ? 'bg-emerald-50 border border-emerald-300 shadow-sm' : ''}
                  ${isInvalidDropZone ? 'bg-red-50 border border-red-300 shadow-sm' : ''}
                `}
                style={{
                  left: `${index * gridConstants.CELL_WIDTH}px`,
                  width: `${gridConstants.CELL_WIDTH}px`
                }}
                data-date={date}
                data-room-unit-id={roomUnit.id}
              />
            );
          })}

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
                <ReservationBar
                  key={`res-${reservation.id}-${reservation.segmentId || 'main'}`}
                  reservation={reservation}
                  startDate={startDate}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  isDragging={dragState?.reservation?.id === reservation.id}
                  showHandles={!loading}
                  enableSplit={!reservation.isSegment} // Only allow splitting on main reservations
                  isResizeMode={isResizeMode} // Pass mode state to reservation bars
                  isSwapTarget={isSwapTarget} // Add swap target indicator
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
          
          {/* Target Reservation Preview (during swap) */}
          {swapState && swapState.swapPreview && swapState.swapPreview.targetPreview && 
           swapState.swapPreview.targetPreview.roomUnitId === roomUnit.id && (
            <ReservationBar
              key="swap-target-preview"
              reservation={swapState.swapPreview.targetPreview}
              startDate={startDate}
              isPreview={true}
              isSwapPreview={true}
              swapType="target"
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
            {isExpanded && roomType.units && roomType.units
              .sort((a, b) => {
                // Sort by unit number in ascending order
                const numA = parseInt(a.number) || 0;
                const numB = parseInt(b.number) || 0;
                return numA - numB;
              })
              .map((roomUnit) => 
                renderRoomUnitRow(roomUnit, roomType)
              )}
          </div>
        );
      })}
      
      {/* Global Vertical Grid Lines - spans entire timeline with responsive positioning */}
      <div 
        className="absolute top-0 bottom-0 pointer-events-none z-5"
        style={{ left: `${gridConstants.SIDEBAR_WIDTH}px` }}
      >
        {dates.map((date, index) => (
          <div
            key={`global-gridline-${date}`}
            className="absolute top-0 bottom-0 border-r border-gray-200/80"
            style={{
              left: `${index * gridConstants.CELL_WIDTH}px`,
              width: '1px'
            }}
          />
        ))}
      </div>
      
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
    </div>
  );
}

/**
 * TimelineGrid component with room hierarchy and drag/drop
 */
TimelineGrid.displayName = 'TimelineGrid';
