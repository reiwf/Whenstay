import React, { useState, useRef, useEffect } from 'react';
import { Scissors } from 'lucide-react';
import { DateUtils, StatusUtils, GridUtils } from './CalendarUtils';

/**
 * ReservationBar - Individual reservation segment with HTML5 drag/drop, resize, and split functionality
 * Uses native HTML5 Drag API for better browser compatibility and performance
 */
export default function ReservationBar({
  reservation,
  startDate,
  onDragStart,
  onDragEnd,
  isDragging = false,
  isPreview = false,
  hasConflict = false,
  showHandles = true,
  enableSplit = true,
  isResizeMode = false, // Mode toggle state
  isSwapTarget = false, // Indicates this reservation is a swap target
  isSwapPreview = false, // Indicates this is a swap preview
  swapType = null, // 'dragged' or 'target' for different swap preview types
  className = ""
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentDragType, setCurrentDragType] = useState(null);
  const barRef = useRef(null);
  const dragImageRef = useRef(null);

  // Get responsive grid constants
  const gridConstants = GridUtils.getCurrentConstants();
  
  // Calculate position and size with half-day checkout/checkin positioning
  const rawDayOffset = DateUtils.daysBetween(startDate, reservation.startDate);
  const totalDuration = DateUtils.daysBetween(reservation.startDate, reservation.endDate);
  
  // Apply half-day positioning for professional hotel calendar visualization
  // Check-in: start from right half (afternoon), Check-out: end at left half (morning)
  const checkinOffset = 0.4; // Start from afternoon of checkin day
  const checkoutAdjustment = -0.1; // End at morning of checkout day (reduce duration)
  
  // Calculate adjusted position and duration using responsive cell width
  // Position: always add checkin offset (start from afternoon)
  const adjustedDayOffset = rawDayOffset + checkinOffset;
  
  // Duration: apply checkout adjustment (end at morning instead of end of day)  
  const adjustedDuration = totalDuration + checkoutAdjustment;
  
  // Adjust for reservations that start before the visible grid
  const leftPosition = Math.max(0, adjustedDayOffset * gridConstants.CELL_WIDTH);
  const visibleStartOffset = Math.max(0, -adjustedDayOffset); // Days cut off from the left
  const visibleDuration = adjustedDuration - visibleStartOffset;
  const width = Math.max(gridConstants.CELL_WIDTH * 0.5, visibleDuration * gridConstants.CELL_WIDTH);
  
  // Flag for truncated reservations (start before visible area)
  const isTruncatedLeft = adjustedDayOffset < 0;

  // Get reservation color
  const reservationColor =  StatusUtils.getStatusColor(reservation.status);

  // Create custom drag image for better visual feedback
  useEffect(() => {
    if (!dragImageRef.current) {
      const dragImage = document.createElement('div');
      dragImage.style.cssText = `
        position: absolute;
        top: -1000px;
        left: -1000px;
        background: ${reservationColor};
        border: 2px solid ${reservationColor};
        color: white;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1000;
      `;
      dragImage.textContent = reservation.bookingName || 'Reservation';
      document.body.appendChild(dragImage);
      dragImageRef.current = dragImage;
    }

    return () => {
      if (dragImageRef.current) {
        document.body.removeChild(dragImageRef.current);
        dragImageRef.current = null;
      }
    };
  }, [reservationColor, reservation.bookingName]);

  /**
   * Handle HTML5 drag start event with direction detection
   */
  const handleDragStart = (event, dragType = 'move-vertical') => {
    if (!onDragStart || isPreview) {
      event.preventDefault();
      return;
    }

    // Store drag type for this operation
    setCurrentDragType(dragType);

    // Set drag effect based on operation type
    if (dragType === 'move-vertical') {
      event.dataTransfer.effectAllowed = 'move';
    } else if (dragType.startsWith('resize-')) {
      event.dataTransfer.effectAllowed = 'copy';
    } else if (dragType === 'split') {
      event.dataTransfer.effectAllowed = 'link';
    }
    
    // Set drag data with enhanced information
    const dragData = {
      reservationId: reservation.id,
      operation: dragType,
      originalData: reservation,
      startPosition: {
        x: event.clientX,
        y: event.clientY
      },
      dragConstraints: {
        // Define what this drag type can modify
        canChangeRoom: dragType === 'move-vertical',
        canChangeDates: dragType.startsWith('resize-'),
        canSplit: dragType === 'split'
      }
    };
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.setData('text/plain', reservation.id); // Fallback for compatibility

    // Set custom drag image for better UX
    if (dragImageRef.current) {
      // Update drag image text based on operation type
      const operationText = {
        'move-vertical': `Move ${reservation.bookingName || 'Reservation'} to different room`,
        'resize-left': `Adjust check-in date`,
        'resize-right': `Adjust check-out date`,
        'split': `Split ${reservation.bookingName || 'Reservation'}`
      };
      dragImageRef.current.textContent = operationText[dragType] || reservation.bookingName || 'Reservation';
      event.dataTransfer.setDragImage(dragImageRef.current, 10, 10);
    }

    // Notify parent component with enhanced drag information
    const rect = barRef.current?.getBoundingClientRect();
    onDragStart({
      reservation,
      dragType,
      startX: event.clientX,
      startY: event.clientY,
      relativeX: event.clientX - (rect?.left || 0),
      relativeY: event.clientY - (rect?.top || 0),
      originalBounds: rect,
      constraints: dragData.dragConstraints
    });
  };

  /**
   * Handle HTML5 drag end event
   */
  const handleDragEnd = (event) => {
    // Clean up drag state
    setCurrentDragType(null);
    
    // Notify parent component of drag completion
    if (onDragEnd) {
      onDragEnd(null, currentDragType, true); // true = final
    }
  };

  /**
   * Get bar style based on state with enhanced shrink/expand visual feedback
   */
  const getBarStyle = () => {
    // Enhanced visual feedback for different preview types
    const isResizePreview = isPreview && (reservation.isResizePreview || reservation.resizeValid !== undefined);
    const isMovePreview = isPreview && reservation.isMovePreview;
    const isModeBasedResize = isPreview && reservation.isModeBasedResize;
    const isValidResize = isResizePreview && reservation.resizeValid !== false;
    const isInvalidResize = isResizePreview && reservation.resizeValid === false;
    
    // Determine if this is a shrink or expand operation
    let isShrinkOperation = false;
    let isExpandOperation = false;
    
    if (isResizePreview && reservation.resizePreviewData) {
      const originalDuration = reservation.resizePreviewData.originalDuration || 
                             DateUtils.daysBetween(
                               reservation.originalStartDate || reservation.startDate,
                               reservation.originalEndDate || reservation.endDate
                             );
      const newDuration = reservation.resizePreviewData.duration;
      
      isShrinkOperation = newDuration < originalDuration;
      isExpandOperation = newDuration > originalDuration;
      
      console.log(`Duration comparison: original=${originalDuration}, new=${newDuration}, shrink=${isShrinkOperation}, expand=${isExpandOperation}`);
    }
    
    // Enhanced color logic for different drag states
    let backgroundColor, borderColor, textColor, borderStyle = 'solid';
    
    if (hasConflict || isInvalidResize) {
      // Conflict state - red theme
      backgroundColor = '#fee2e2';
      borderColor = '#dc2626';
      textColor = '#dc2626';
      borderStyle = 'dashed';
    } else if (isResizePreview && isValidResize) {
      if (isShrinkOperation) {
        // Shrink operation - orange theme
        backgroundColor = '#fff7ed';
        borderColor = '#ea580c';
        textColor = '#c2410c';
        borderStyle = 'dashed';
      } else if (isExpandOperation) {
        // Expand operation - blue theme  
        backgroundColor = '#f0f9ff';
        borderColor = '#3b82f6';
        textColor = '#1e40af';
        borderStyle = 'dashed';
      } else {
        // No change - neutral blue
        backgroundColor = '#f0f9ff';
        borderColor = '#3b82f6';
        textColor = '#1e40af';
        borderStyle = 'dashed';
      }
    } else if (isSwapPreview) {
      // Swap preview styling - purple theme for sophisticated swap operations
      if (swapType === 'dragged') {
        // Dragged reservation preview - bright purple
        backgroundColor = '#f3e8ff';
        borderColor = '#8b5cf6';
        textColor = '#7c3aed';
        borderStyle = 'dashed';
      } else if (swapType === 'target') {
        // Target reservation preview - complementary purple
        backgroundColor = '#faf5ff';
        borderColor = '#a855f7';
        textColor = '#9333ea';
        borderStyle = 'dotted';
      } else {
        // Generic swap preview
        backgroundColor = '#f3e8ff';
        borderColor = '#8b5cf6';
        textColor = '#7c3aed';
        borderStyle = 'dashed';
      }
    } else if (isMovePreview) {
      // Valid move preview - green theme
      backgroundColor = '#f0fdf4';
      borderColor = '#16a34a';
      textColor = '#15803d';
      borderStyle = 'dashed';
    } else if (isPreview) {
      // Generic preview
      backgroundColor = reservationColor + '20'; // Add transparency
      borderColor = reservationColor;
      textColor = reservationColor;
      borderStyle = 'dashed';
    } else if (isSwapTarget) {
      // Swap target styling - highlight the target reservation with purple glow
      backgroundColor = reservationColor;
      borderColor = '#8b5cf6';
      textColor = '#ffffff';
      borderStyle = 'solid';
    } else {
      // Normal state with mode-specific styling
      backgroundColor = reservationColor;
      borderColor = reservationColor;
      textColor = '#ffffff';
      
      // Add subtle border for resize mode indication
      if (isResizeMode && !isPreview) {
        borderStyle = 'solid';
        borderColor = isHovered ? '#3b82f6' : reservationColor;
      }
    }

    // Dynamic cursor based on drag state and operation type
    let cursor = 'grab';
    if (isDragging) {
      cursor = 'grabbing';
    } else if (isPreview) {
      cursor = 'default';
    } else if (isResizeMode) {
      cursor = 'ew-resize'; // Always show horizontal resize cursor in resize mode
    } else if (currentDragType) {
      // Set cursor based on active drag type
      switch (currentDragType) {
        case 'move-vertical':
          cursor = 'ns-resize';
          break;
        case 'resize-left':
        case 'resize-right':
        case 'resize-horizontal':
          cursor = 'ew-resize';
          break;
        case 'split':
          cursor = 'col-resize';
          break;
        default:
          cursor = 'grab';
      }
    }

    

    // Responsive styling with compact design
    const baseStyle = {
      position: 'absolute',
      left: `${leftPosition}px`,
      width: `${Math.max(gridConstants.CELL_WIDTH, width)}px`,
      top: `${Math.max(2, gridConstants.ROW_HEIGHT * 0.15)}px`, // Responsive top margin
      height: `${gridConstants.ROW_HEIGHT - Math.max(4, gridConstants.ROW_HEIGHT * 0.3)}px`, // Responsive height with padding      
      backgroundColor,
      borderWidth: gridConstants.BREAKPOINT === 'mobile' ? '1px' : '2px', // Thinner border on mobile
      borderColor: borderColor,
      borderStyle: borderStyle,
      color: textColor,
      borderRadius: gridConstants.BREAKPOINT === 'mobile' ? '12px' : '16px', // Smaller radius on mobile
      cursor,
      userSelect: 'none',
      zIndex: isDragging ? 50 : isPreview ? 30 : isHovered ? 20 : 10,
      opacity: isPreview ? (hasConflict || isInvalidResize ? 0.7 : 0.8) : 1,
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging ? 'none' : 'all 150ms ease-in-out',
      boxShadow: isDragging ? '0 6px 20px rgba(0, 0, 0, 0.15)' : 
                 isPreview ? '0 3px 12px rgba(0, 0, 0, 0.12)' :
                 isHovered ? '0 2px 8px rgba(0, 0, 0, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.05)', // Smaller shadows
      fontSize: gridConstants.BREAKPOINT === 'mobile' ? '10px' : '11px' // Smaller font on mobile
    };
          // Size of the cut (px)
      const CUT_SIZE = 0;

      if (isTruncatedLeft) {
        // Remove rounded left corners and cut the edge
        baseStyle.borderTopLeftRadius = 0;
        baseStyle.borderBottomLeftRadius = 0;

        // Slanted / notched edge
        baseStyle.clipPath = `polygon(${CUT_SIZE}px 0, 100% 0, 100% 100%, 0 100%, 0 ${CUT_SIZE}px)`;
        baseStyle.WebkitClipPath = baseStyle.clipPath; // Safari
      }
    return baseStyle;    
  };

  
  /**
   * Get split handle style
   */
  const getSplitHandleStyle = () => ({
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '20px',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'col-resize',
    opacity: isHovered || isDragging ? 1 : 0,
    transition: 'opacity 150ms ease-in-out',
    color: isPreview && hasConflict ? '#dc2626' : '#ffffff',
    fontSize: '12px',
    fontWeight: 'bold',
    textShadow: isPreview ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.25)'
  });

  /**
   * Render reservation label with truncation and resize feedback
   */
  const renderLabel = () => {
    const label = reservation.label || reservation.bookingName || 'Reservation';
    const maxLength = Math.floor(width / 8); // Rough character estimate based on width
    
    let displayLabel = label;
    if (label.length > maxLength && maxLength > 3) {
      displayLabel = label.substring(0, maxLength - 3) + '...';
    }
    
    // Add operation indicator for resize previews
    if (isPreview && reservation.resizePreviewData) {
      const originalDuration = DateUtils.daysBetween(
        reservation.originalStartDate || reservation.startDate,
        reservation.originalEndDate || reservation.endDate
      );
      const newDuration = reservation.resizePreviewData.duration;
      
      if (newDuration < originalDuration) {
        displayLabel = `📉 ${displayLabel} (Shrink)`;
      } else if (newDuration > originalDuration) {
        displayLabel = `📈 ${displayLabel} (Expand)`;
      }
    }
    
    return displayLabel;
  };

  /**
   * Generate enhanced tooltip for resize preview with shrink/expand indicators
   */
  const getTooltipText = () => {
    const baseName = reservation.bookingName || 'Reservation';
    const startFormatted = DateUtils.formatDate(reservation.startDate);
    const endFormatted = DateUtils.formatDate(reservation.endDate);
    const status = StatusUtils.getStatusDisplayName(reservation.status);
    
    let tooltip = `${baseName} • ${startFormatted} → ${endFormatted}`;
    
    if (isPreview && reservation.resizePreviewData) {
      const { duration, validationReason, wasConstrained } = reservation.resizePreviewData;
      tooltip += ` • ${duration} night${duration !== 1 ? 's' : ''}`;
      
      // Add operation type indicator
      const originalDuration = DateUtils.daysBetween(
        reservation.originalStartDate || reservation.startDate,
        reservation.originalEndDate || reservation.endDate
      );
      
      if (duration < originalDuration) {
        tooltip += ' • SHRINKING reservation';
      } else if (duration > originalDuration) {
        tooltip += ' • EXPANDING reservation';
      }
      
      if (validationReason) {
        tooltip += ` • ${validationReason}`;
      }
      
      if (wasConstrained) {
        tooltip += ' • Constrained by adjacent reservations';
      }
    } else {
      tooltip += ` • ${status}`;
    }
    
    return tooltip;
  };

  return (
    <div
      ref={barRef}
      draggable={!isPreview}
      style={getBarStyle()}
      className={`group select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={(e) => handleDragStart(e, isResizeMode ? 'resize-horizontal' : 'move-vertical')}
      onDragEnd={handleDragEnd}
      title={getTooltipText()}
    >
      {/* Mode-based visual feedback - show resize indicators in resize mode */}
      {isResizeMode && !isPreview && (
        <>
          {/* Left resize indicator */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 opacity-60"
            style={{ borderRadius: '6px 0 0 6px' }}
          />
          {/* Right resize indicator */}
          <div
            className="absolute right-0 top-0 bottom-0 w-1 bg-blue-400 opacity-60"
            style={{ borderRadius: '0 6px 6px 0' }}
          />
        </>
      )}

      {/* Split Handle */}
      {showHandles && enableSplit && !isPreview && totalDuration > 1 && (
        <div
          draggable
          style={getSplitHandleStyle()}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, 'split');
          }}
          onDragEnd={handleDragEnd}
          title="Split reservation here"
        >
          <Scissors className="w-3 h-3" />
        </div>
      )}

      {/* Reservation Label */}
      <div 
        className="flex items-center h-full px-2 pointer-events-none overflow-hidden"
        style={{ 
          color: isPreview && hasConflict ? '#dc2626' : '#ffffff',
          fontSize: '12px',
          fontWeight: '600',
          lineHeight: '1.2'
        }}
      >
        <span className="truncate">
          {renderLabel()}
        </span>
      </div>

      {/* Conflict Indicator */}
      {hasConflict && (
        <div className="absolute inset-0 border-2 border-red-500 bg-red-100 bg-opacity-20 rounded border-dashed pointer-events-none">
          <div className="absolute top-1 left-1 text-xs font-bold text-red-600">
            ⚠
          </div>
        </div>
      )}
    </div>
  );
}
