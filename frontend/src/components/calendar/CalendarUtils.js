/**
 * Calendar Utilities - Date manipulation and calendar-specific helpers
 */

/**
 * Date formatting and manipulation utilities
 */
export class DateUtils {
  /**
   * Get yesterday's date
   */
  static getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  /**
   * Add days to a date string
   */
  static addDays(dateString, days) {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  /**
   * Calculate days between two dates
   */
  static daysBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  /**
   * Format date for display
   */
  static formatDate(dateString, format = 'short') {
    const date = new Date(dateString);
    
    if (format === 'short') {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } else if (format === 'long') {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } else if (format === 'weekday') {
      return date.toLocaleDateString('en-US', {
        weekday: 'short'
      });
    } else if (format === 'iso') {
      return date.toISOString().split('T')[0];
    }
    
    return dateString;
  }

  /**
   * Check if date is today
   */
  static isToday(dateString) {
    const today = new Date().toISOString().split('T')[0];
    return dateString === today;
  }

  /**
   * Check if date is in the past
   */
  static isPast(dateString) {
    const today = new Date().toISOString().split('T')[0];
    return dateString < today;
  }

  /**
   * Check if date is weekend
   */
  static isWeekend(dateString) {
    const date = new Date(dateString);
    const day = date.getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Generate date range array
   */
  static generateDateRange(startDate, endDate) {
    const dates = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (currentDate < end) {
      dates.push(new Date(currentDate).toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get default calendar date range (yesterday + 29 days = 31 total)
   */
  static getDefaultDateRange() {
    const startDate = this.getYesterday();
    const endDate = this.addDays(startDate, 30); // +30 to get 31 total days
    
    return {
      startDate,
      endDate,
      totalDays: 31,
      dates: this.generateDateRange(startDate, endDate)
    };
  }
}

/**
 * HTML5 Drag and drop utilities
 */
export class DragDropUtils {
  /**
   * Calculate pixel position for a date
   */
  static getDatePosition(date, startDate, cellWidth) {
    const dayOffset = DateUtils.daysBetween(startDate, date);
    return dayOffset * cellWidth;
  }

  /**
   * Calculate date from pixel position
   */
  static getDateFromPosition(x, startDate, cellWidth) {
    const dayOffset = Math.floor(x / cellWidth);
    return DateUtils.addDays(startDate, dayOffset);
  }

  /**
   * Calculate room row from Y position
   */
  static getRoomFromPosition(y, rowHeight, headerHeight = 48) {
    const adjustedY = y - headerHeight;
    return Math.floor(adjustedY / rowHeight);
  }

  /**
   * Snap position to grid
   */
  static snapToGrid(position, gridSize) {
    return Math.round(position / gridSize) * gridSize;
  }

  /**
   * Check if two date ranges overlap
   */
  static dateRangesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Extract drag data from HTML5 dataTransfer
   */
  static extractDragData(dataTransfer) {
    try {
      const jsonData = dataTransfer.getData('application/json');
      if (jsonData) {
        return JSON.parse(jsonData);
      }
      
      // Fallback to plain text
      const textData = dataTransfer.getData('text/plain');
      if (textData) {
        return { reservationId: textData };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting drag data:', error);
      return null;
    }
  }

  /**
   * Create custom drag image element
   */
  static createDragImage(text, color = '#3b82f6') {
    const dragImage = document.createElement('div');
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      background: ${color};
      border: 2px solid ${color};
      color: white;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    dragImage.textContent = text;
    document.body.appendChild(dragImage);
    return dragImage;
  }

  /**
   * Remove drag image element
   */
  static removeDragImage(dragImage) {
    if (dragImage && dragImage.parentNode) {
      dragImage.parentNode.removeChild(dragImage);
    }
  }

  /**
   * Check if drag operation is supported
   */
  static isDragSupported() {
    return 'draggable' in document.createElement('div') && 
           'ondragstart' in document.createElement('div');
  }

  /**
   * Get effective drag operation based on allowed and target effects
   */
  static getEffectiveDropEffect(dataTransfer) {
    const allowed = dataTransfer.effectAllowed;
    const target = dataTransfer.dropEffect;
    
    // Return the target effect if it's allowed
    if (allowed === 'all' || allowed.includes(target)) {
      return target;
    }
    
    // Otherwise return the first allowed effect
    if (allowed.includes('move')) return 'move';
    if (allowed.includes('copy')) return 'copy';
    if (allowed.includes('link')) return 'link';
    
    return 'none';
  }
}

/**
 * Reservation status and color utilities
 */
export class StatusUtils {
  /**
   * Get color for reservation status
   */
  static getStatusColor(status) {
    const colors = {
      'confirmed': '#3b82f6',    // blue
      'checked_in': '#10b981',   // green
      'checked_out': '#6b7280',  // gray
      'cancelled': '#ef4444',    // red
      'pending': '#f59e0b',      // yellow
      'new': '#707cbfff',          // purple
      'no_show': '#f97316'       // orange
    };
    
    return colors[status] || '#6b7280';
  }

  /**
   * Get status display name
   */
  static getStatusDisplayName(status) {
    const names = {
      'confirmed': 'Confirmed',
      'checked_in': 'Checked In',
      'checked_out': 'Checked Out',
      'cancelled': 'Cancelled',
      'pending': 'Pending',
      'new': 'New',
      'no_show': 'No Show'
    };
    
    return names[status] || status;
  }

  /**
   * Check if status is active (not cancelled or no-show)
   */
  static isActiveStatus(status) {
    return !['cancelled', 'no_show'].includes(status);
  }
}

/**
 * Grid and layout utilities
 */
export class GridUtils {
  /**
   * Responsive grid constants - much more compact design
   */
  static CONSTANTS = {
    // Responsive cell widths (reduced significantly for compactness)
    CELL_WIDTH: {
      mobile: 60,    // Very compact for mobile
      tablet: 72,    // Slightly larger for tablet
      desktop: 84    // Still compact but readable on desktop
    },
    
    // Responsive row heights (much shorter)
    ROW_HEIGHT: {
      mobile: 32,    // Compact rows for mobile
      tablet: 36,    // Medium for tablet
      desktop: 40    // Larger for desktop but still compact
    },
    
    // Responsive header heights
    HEADER_HEIGHT: {
      mobile: 40,    // Compact header
      tablet: 44,    // Medium header
      desktop: 48    // Standard header
    },
    
    // Responsive sidebar widths
    SIDEBAR_WIDTH: {
      mobile: 140,   // Very narrow for mobile
      tablet: 160,   // Medium for tablet
      desktop: 180   // Wider but still compact
    },
    
    MIN_DRAG_DISTANCE: 5, // minimum pixels to start drag
    
    // Breakpoints for responsive behavior
    BREAKPOINTS: {
      mobile: 768,   // <= 768px
      tablet: 1024,  // <= 1024px
      desktop: 1025  // > 1024px
    }
  };

  /**
   * Get current responsive values based on window width
   */
  static getCurrentConstants(windowWidth = window?.innerWidth || 1200) {
    let breakpoint = 'desktop';
    if (windowWidth <= this.CONSTANTS.BREAKPOINTS.mobile) {
      breakpoint = 'mobile';
    } else if (windowWidth <= this.CONSTANTS.BREAKPOINTS.tablet) {
      breakpoint = 'tablet';
    }

    return {
      CELL_WIDTH: this.CONSTANTS.CELL_WIDTH[breakpoint],
      ROW_HEIGHT: this.CONSTANTS.ROW_HEIGHT[breakpoint],
      HEADER_HEIGHT: this.CONSTANTS.HEADER_HEIGHT[breakpoint],
      SIDEBAR_WIDTH: this.CONSTANTS.SIDEBAR_WIDTH[breakpoint],
      MIN_DRAG_DISTANCE: this.CONSTANTS.MIN_DRAG_DISTANCE,
      BREAKPOINT: breakpoint
    };
  }

  /**
   * Legacy support - returns desktop values by default
   */
  static get CELL_WIDTH() {
    return this.getCurrentConstants().CELL_WIDTH;
  }
  
  static get ROW_HEIGHT() {
    return this.getCurrentConstants().ROW_HEIGHT;
  }
  
  static get HEADER_HEIGHT() {
    return this.getCurrentConstants().HEADER_HEIGHT;
  }
  
  static get SIDEBAR_WIDTH() {
    return this.getCurrentConstants().SIDEBAR_WIDTH;
  }

  /**
   * Calculate grid dimensions
   */
  static calculateGridDimensions(roomCount, dateCount) {
    return {
      width: dateCount * this.CONSTANTS.CELL_WIDTH,
      height: roomCount * this.CONSTANTS.ROW_HEIGHT,
      totalWidth: this.CONSTANTS.SIDEBAR_WIDTH + (dateCount * this.CONSTANTS.CELL_WIDTH),
      totalHeight: this.CONSTANTS.HEADER_HEIGHT + (roomCount * this.CONSTANTS.ROW_HEIGHT)
    };
  }

  /**
   * Get visible date range for virtualization
   */
  static getVisibleDateRange(scrollLeft, viewportWidth, startDate, cellWidth) {
    const startIndex = Math.floor(scrollLeft / cellWidth);
    const endIndex = Math.ceil((scrollLeft + viewportWidth) / cellWidth);
    
    return {
      startIndex: Math.max(0, startIndex - 1), // buffer
      endIndex: endIndex + 1, // buffer
      startDate: DateUtils.addDays(startDate, startIndex),
      endDate: DateUtils.addDays(startDate, endIndex)
    };
  }

  /**
   * Get visible room range for virtualization
   */
  static getVisibleRoomRange(scrollTop, viewportHeight, rowHeight, headerHeight) {
    const adjustedScrollTop = Math.max(0, scrollTop - headerHeight);
    const startIndex = Math.floor(adjustedScrollTop / rowHeight);
    const endIndex = Math.ceil((adjustedScrollTop + viewportHeight) / rowHeight);
    
    return {
      startIndex: Math.max(0, startIndex - 1), // buffer
      endIndex: endIndex + 1 // buffer
    };
  }
}

/**
 * Conflict detection utilities
 */
export class ConflictUtils {
  /**
   * Check if reservation conflicts with existing ones
   */
  static hasConflicts(newReservation, existingReservations, excludeId = null) {
    return existingReservations.some(existing => {
      if (existing.id === excludeId) return false;
      if (existing.roomUnitId !== newReservation.roomUnitId) return false;
      
      return DragDropUtils.dateRangesOverlap(
        newReservation.startDate,
        newReservation.endDate,
        existing.startDate,
        existing.endDate
      );
    });
  }

  /**
   * Find conflicting reservations
   */
  static findConflicts(reservation, existingReservations, excludeId = null) {
    return existingReservations.filter(existing => {
      if (existing.id === excludeId) return false;
      if (existing.roomUnitId !== reservation.roomUnitId) return false;
      
      return DragDropUtils.dateRangesOverlap(
        reservation.startDate,
        reservation.endDate,
        existing.startDate,
        existing.endDate
      );
    });
  }
}

/**
 * Resize validation utilities
 */
export class ResizeUtils {
  /**
   * Validate minimum duration (1 night minimum)
   */
  static validateMinimumDuration(startDate, endDate) {
    const duration = DateUtils.daysBetween(startDate, endDate);
    return duration >= 1;
  }

  /**
   * Validate resize operation constraints (updated to allow bidirectional resizing)
   */
  static validateResize(originalReservation, newStartDate, newEndDate, resizeType) {
    // Check minimum duration (only constraint)
    if (!this.validateMinimumDuration(newStartDate, newEndDate)) {
      return {
        isValid: false,
        reason: 'Minimum 1 night duration required'
      };
    }

    // Validate that only the correct edge is being modified
    if (resizeType === 'resize-left') {
      // Left resize: only start date should change, end date must remain the same
      if (newEndDate !== originalReservation.endDate) {
        return {
          isValid: false,
          reason: 'Check-out date must remain unchanged when resizing check-in'
        };
      }
      // Allow moving start date in BOTH directions (earlier or later)
    } else if (resizeType === 'resize-right') {
      // Right resize: only end date should change, start date must remain the same
      if (newStartDate !== originalReservation.startDate) {
        return {
          isValid: false,
          reason: 'Check-in date must remain unchanged when resizing check-out'
        };
      }
      // Allow moving end date in BOTH directions (later or earlier)
    }

    return {
      isValid: true,
      reason: null
    };
  }

  /**
   * Calculate valid resize bounds (updated to allow bidirectional resizing)
   */
  static getValidResizeBounds(originalReservation, resizeType, existingReservations = []) {
    const bounds = {
      minDate: null,
      maxDate: null,
      blockedDates: []
    };

    if (resizeType === 'resize-left') {
      // For left resize (check-in date), allow movement in BOTH directions
      
      // Find earliest possible date (blocked by reservations that end before original start)
      const earlierConflicts = existingReservations.filter(res => 
        res.id !== originalReservation.id && 
        res.roomUnitId === originalReservation.roomUnitId &&
        res.endDate <= originalReservation.startDate
      );
      
      if (earlierConflicts.length > 0) {
        const latestConflictEnd = earlierConflicts.reduce((latest, res) => 
          res.endDate > latest ? res.endDate : latest, earlierConflicts[0].endDate
        );
        bounds.minDate = latestConflictEnd;
      }
      
      // Find latest possible date (constrained by original end date to maintain min duration)
      // Allow moving start date up to 1 day before end date (minimum 1 night)
      bounds.maxDate = DateUtils.addDays(originalReservation.endDate, -1);
      
    } else if (resizeType === 'resize-right') {
      // For right resize (check-out date), allow movement in BOTH directions
      
      // Find earliest possible date (constrained by original start date to maintain min duration)
      // Allow moving end date to 1 day after start date (minimum 1 night)
      bounds.minDate = DateUtils.addDays(originalReservation.startDate, 1);
      
      // Find latest possible date (blocked by reservations that start after original end)
      const laterConflicts = existingReservations.filter(res => 
        res.id !== originalReservation.id && 
        res.roomUnitId === originalReservation.roomUnitId &&
        res.startDate >= originalReservation.endDate
      );
      
      if (laterConflicts.length > 0) {
        const earliestConflictStart = laterConflicts.reduce((earliest, res) => 
          res.startDate < earliest ? res.startDate : earliest, laterConflicts[0].startDate
        );
        bounds.maxDate = earliestConflictStart;
      }
    }

    return bounds;
  }

  /**
   * Apply resize constraints to target date
   */
  static constrainResizeDate(targetDate, originalReservation, resizeType, existingReservations = []) {
    const bounds = this.getValidResizeBounds(originalReservation, resizeType, existingReservations);
    let constrainedDate = targetDate;

    // Apply minimum bound
    if (bounds.minDate && constrainedDate < bounds.minDate) {
      constrainedDate = bounds.minDate;
    }

    // Apply maximum bound
    if (bounds.maxDate && constrainedDate > bounds.maxDate) {
      constrainedDate = bounds.maxDate;
    }

    return constrainedDate;
  }

  /**
   * Get resize preview data
   */
  static getResizePreview(originalReservation, targetDate, resizeType, existingReservations = []) {
    let newStartDate = originalReservation.startDate;
    let newEndDate = originalReservation.endDate;

    // Apply resize constraints
    const constrainedDate = this.constrainResizeDate(
      targetDate, 
      originalReservation, 
      resizeType, 
      existingReservations
    );

    if (resizeType === 'resize-left') {
      newStartDate = constrainedDate;
    } else if (resizeType === 'resize-right') {
      newEndDate = constrainedDate;
    }

    // Validate the result
    const validation = this.validateResize(originalReservation, newStartDate, newEndDate, resizeType);
    
    // Check for conflicts
    const hasConflicts = ConflictUtils.hasConflicts(
      { ...originalReservation, startDate: newStartDate, endDate: newEndDate },
      existingReservations,
      originalReservation.id
    );

    return {
      startDate: newStartDate,
      endDate: newEndDate,
      duration: DateUtils.daysBetween(newStartDate, newEndDate),
      isValid: validation.isValid && !hasConflicts,
      hasConflicts,
      validationReason: validation.reason,
      wasConstrained: constrainedDate !== targetDate
    };
  }
}

/**
 * Snapping utilities for edge alignment
 */
export class SnapUtils {
  /**
   * Find nearby reservation edges for snapping
   */
  static findNearbyEdges(date, roomUnitId, reservations, snapThreshold = 1) {
    const nearbyEdges = [];
    
    reservations
      .filter(r => r.roomUnitId === roomUnitId)
      .forEach(reservation => {
        // Check start date proximity
        const startDiff = Math.abs(DateUtils.daysBetween(date, reservation.startDate));
        if (startDiff <= snapThreshold) {
          nearbyEdges.push({
            date: reservation.startDate,
            type: 'start',
            distance: startDiff,
            reservation
          });
        }
        
        // Check end date proximity
        const endDiff = Math.abs(DateUtils.daysBetween(date, reservation.endDate));
        if (endDiff <= snapThreshold) {
          nearbyEdges.push({
            date: reservation.endDate,
            type: 'end',
            distance: endDiff,
            reservation
          });
        }
      });
    
    // Sort by distance, closest first
    return nearbyEdges.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Snap to nearest edge if within threshold
   */
  static snapToNearestEdge(targetDate, roomUnitId, reservations, snapThreshold = 1) {
    const nearbyEdges = this.findNearbyEdges(targetDate, roomUnitId, reservations, snapThreshold);
    
    if (nearbyEdges.length > 0) {
      return nearbyEdges[0].date; // Return closest edge date
    }
    
    return targetDate; // No snapping needed
  }
}

/**
 * Keyboard shortcut utilities
 */
export class KeyboardUtils {
  /**
   * Handle calendar keyboard shortcuts
   */
  static handleKeyDown(event, handlers = {}) {
    const { ctrlKey, shiftKey, key } = event;
    
    // Prevent default browser shortcuts that might interfere
    if (ctrlKey && ['z', 'y', 'c', 'v', 'x'].includes(key.toLowerCase())) {
      if (handlers.preventDefault !== false) {
        event.preventDefault();
      }
    }
    
    // Navigation shortcuts
    if (key === 'ArrowLeft' && handlers.onMoveLeft) {
      event.preventDefault();
      handlers.onMoveLeft(shiftKey);
    } else if (key === 'ArrowRight' && handlers.onMoveRight) {
      event.preventDefault();
      handlers.onMoveRight(shiftKey);
    } else if (key === 'ArrowUp' && handlers.onMoveUp) {
      event.preventDefault();
      handlers.onMoveUp(shiftKey);
    } else if (key === 'ArrowDown' && handlers.onMoveDown) {
      event.preventDefault();
      handlers.onMoveDown(shiftKey);
    }
    
    // Action shortcuts
    if (key === 'Delete' && handlers.onDelete) {
      event.preventDefault();
      handlers.onDelete();
    } else if (key === 'Escape' && handlers.onEscape) {
      event.preventDefault();
      handlers.onEscape();
    } else if (key === 'Enter' && handlers.onEnter) {
      event.preventDefault();
      handlers.onEnter();
    }
    
    // Modifier + key combinations
    if (ctrlKey) {
      if (key === 'z' && handlers.onUndo) {
        handlers.onUndo();
      } else if (key === 'y' && handlers.onRedo) {
        handlers.onRedo();
      } else if (key === 'c' && handlers.onCopy) {
        handlers.onCopy();
      } else if (key === 'v' && handlers.onPaste) {
        handlers.onPaste();
      } else if (key === 'x' && handlers.onCut) {
        handlers.onCut();
      }
    }
  }
}

/**
 * Performance optimization utilities
 */
export class PerformanceUtils {
  /**
   * Debounce function calls
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func(...args);
    };
  }

  /**
   * Throttle function calls
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Request animation frame wrapper
   */
  static rafSchedule(callback) {
    let rafId;
    
    return (...args) => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => callback(...args));
    };
  }
}

// Export all utilities as default
export default {
  DateUtils,
  DragDropUtils,
  StatusUtils,
  GridUtils,
  ConflictUtils,
  ResizeUtils,
  SnapUtils,
  KeyboardUtils,
  PerformanceUtils
};
