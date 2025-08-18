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
  className = ""
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [currentDragType, setCurrentDragType] = useState(null);
  const barRef = useRef(null);
  const dragImageRef = useRef(null);

  // Calculate position and size
  const dayOffset = DateUtils.daysBetween(startDate, reservation.startDate);
  const duration = DateUtils.daysBetween(reservation.startDate, reservation.endDate);
  const leftPosition = dayOffset * GridUtils.CONSTANTS.CELL_WIDTH;
  const width = duration * GridUtils.CONSTANTS.CELL_WIDTH;

  // Get reservation color
  const reservationColor = reservation.color || StatusUtils.getStatusColor(reservation.status);

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
   * Handle HTML5 drag start event
   */
  const handleDragStart = (event, dragType = 'move') => {
    if (!onDragStart || isPreview) {
      event.preventDefault();
      return;
    }

    // Store drag type for this operation
    setCurrentDragType(dragType);

    // Set drag effect
    event.dataTransfer.effectAllowed = dragType === 'move' ? 'move' : 'copy';
    
    // Set drag data
    const dragData = {
      reservationId: reservation.id,
      operation: dragType,
      originalData: reservation,
      startPosition: {
        x: event.clientX,
        y: event.clientY
      }
    };
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.setData('text/plain', reservation.id); // Fallback for compatibility

    // Set custom drag image for better UX
    if (dragImageRef.current) {
      event.dataTransfer.setDragImage(dragImageRef.current, 10, 10);
    }

    // Notify parent component
    const rect = barRef.current?.getBoundingClientRect();
    onDragStart({
      reservation,
      dragType,
      startX: event.clientX,
      startY: event.clientY,
      relativeX: event.clientX - (rect?.left || 0),
      relativeY: event.clientY - (rect?.top || 0),
      originalBounds: rect
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
   * Handle mouse down on resize/split handles
   */
  const handleHandleMouseDown = (event, dragType) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Start drag operation for handle
    const dragEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY
    });
    
    // Simulate drag start for handle operation
    handleDragStart(dragEvent, dragType);
  };

  /**
   * Get bar style based on state
   */
  const getBarStyle = () => {
    // Enhanced visual feedback for resize previews
    const isResizePreview = isPreview && (reservation.isResizePreview || reservation.resizeValid !== undefined);
    const isValidResize = isResizePreview && reservation.resizeValid !== false;
    const isInvalidResize = isResizePreview && reservation.resizeValid === false;
    
    // Color logic for different states
    let backgroundColor, borderColor, textColor;
    
    if (hasConflict || isInvalidResize) {
      backgroundColor = '#fee2e2';
      borderColor = '#dc2626';
      textColor = '#dc2626';
    } else if (isResizePreview && isValidResize) {
      backgroundColor = '#f0f9ff';
      borderColor = '#3b82f6';
      textColor = '#1e40af';
    } else if (isPreview) {
      backgroundColor = reservationColor + '20'; // Add transparency
      borderColor = reservationColor;
      textColor = reservationColor;
    } else {
      backgroundColor = reservationColor;
      borderColor = reservationColor;
      textColor = '#ffffff';
    }

    const baseStyle = {
      position: 'absolute',
      left: `${leftPosition}px`,
      width: `${Math.max(GridUtils.CONSTANTS.CELL_WIDTH, width)}px`,
      top: '6px',
      height: `${GridUtils.CONSTANTS.ROW_HEIGHT - 12}px`,
      backgroundColor,
      border: `2px solid ${borderColor}`,
      borderStyle: isPreview ? 'dashed' : 'solid',
      color: textColor,
      borderRadius: '6px',
      cursor: isDragging ? 'grabbing' : (isPreview ? 'default' : 'grab'),
      userSelect: 'none',
      zIndex: isDragging ? 50 : isPreview ? 30 : isHovered ? 20 : 10,
      opacity: isPreview ? (hasConflict || isInvalidResize ? 0.7 : 0.8) : 1,
      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
      transition: isDragging ? 'none' : 'all 150ms ease-in-out',
      boxShadow: isDragging ? '0 8px 25px rgba(0, 0, 0, 0.15)' : 
                 isPreview ? '0 4px 16px rgba(0, 0, 0, 0.12)' :
                 isHovered ? '0 4px 12px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.05)'
    };

    return baseStyle;
  };

  /**
   * Get handle style
   */
  const getHandleStyle = (position) => ({
    position: 'absolute',
    top: 0,
    width: '2px',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    cursor: 'ew-resize',
    opacity: isHovered || isDragging ? 1 : 0.3,
    transition: 'all 150ms ease-in-out',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: isHovered || isDragging ? '0 2px 4px rgba(0, 0, 0, 0.2)' : 'none',
    transform: isHovered || isDragging ? 'scaleX(1.1)' : 'scaleX(1)',
    ...(position === 'left' ? {
      left: '-2px',
      borderTopLeftRadius: '6px',
      borderBottomLeftRadius: '6px'
    } : {
      right: '-2px',
      borderTopRightRadius: '6px',
      borderBottomRightRadius: '6px'
    })
  });

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
   * Render reservation label with truncation
   */
  const renderLabel = () => {
    const label = reservation.label || reservation.bookingName || 'Reservation';
    const maxLength = Math.floor(width / 8); // Rough character estimate based on width
    
    if (label.length > maxLength && maxLength > 3) {
      return label.substring(0, maxLength - 3) + '...';
    }
    
    return label;
  };

  /**
   * Generate enhanced tooltip for resize preview
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
      onDragStart={(e) => handleDragStart(e, 'move')}
      onDragEnd={handleDragEnd}
      title={getTooltipText()}
    >
      {/* Left Resize Handle */}
      {showHandles && !isPreview && (
        <div
          draggable
          style={getHandleStyle('left')}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, 'resize-left');
          }}
          onDragEnd={handleDragEnd}
          onMouseDown={(e) => e.preventDefault()}
          title="Resize check-in date"
        />
      )}

      {/* Right Resize Handle */}
      {showHandles && !isPreview && (
        <div
          draggable
          style={getHandleStyle('right')}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, 'resize-right');
          }}
          onDragEnd={handleDragEnd}
          onMouseDown={(e) => e.preventDefault()}
          title="Resize check-out date"
        />
      )}

      {/* Split Handle */}
      {showHandles && enableSplit && !isPreview && duration > 1 && (
        <div
          draggable
          style={getSplitHandleStyle()}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStart(e, 'split');
          }}
          onDragEnd={handleDragEnd}
          onMouseDown={(e) => e.preventDefault()}
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

      {/* Status Indicator */}
      {reservation.status && (
        <div 
          className="absolute top-1 right-1 w-2 h-2 rounded-full"
          style={{ 
            backgroundColor: hasConflict ? '#dc2626' : 'rgba(255, 255, 255, 0.7)'
          }}
          title={StatusUtils.getStatusDisplayName(reservation.status)}
        />
      )}

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
