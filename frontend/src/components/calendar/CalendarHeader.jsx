import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  RotateCcw,
  Move,
  Scaling
} from 'lucide-react';
import { DateUtils, GridUtils } from './CalendarUtils';
import { Switch } from '../ui/switch';

/**
 * CalendarHeader - Date navigation and controls for calendar timeline
 * Displays 31 days (yesterday + 29 future days) with navigation controls
 */
export default function CalendarHeader({ 
  dates = [], 
  startDate, 
  onNavigate, 
  onRefresh,
  loading = false,
  selectedPropertyId = null,
  isResizeMode = false,
  onModeToggle,
  className = ""
}) {
  const [gridConstants, setGridConstants] = useState(GridUtils.getCurrentConstants());

  // Handle window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const newWidth = window.innerWidth;
      setGridConstants(GridUtils.getCurrentConstants(newWidth));
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial values
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Navigate to previous period (shift by 7 days)
   */
  const handlePrevious = () => {
    if (onNavigate && startDate) {
      const newStartDate = DateUtils.addDays(startDate, -7);
      onNavigate(newStartDate);
    }
  };

  /**
   * Navigate to next period (shift by 7 days)
   */
  const handleNext = () => {
    if (onNavigate && startDate) {
      const newStartDate = DateUtils.addDays(startDate, 7);
      onNavigate(newStartDate);
    }
  };

  /**
   * Navigate to today (reset to default range)
   */
  const handleToday = () => {
    if (onNavigate) {
      const today = new Date().toISOString().split('T')[0];
      const newStartDate = DateUtils.addDays(today, -1); // yesterday
      onNavigate(newStartDate);
    }
  };

  /**
   * Handle refresh
   */
  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  return (
    <div className={`bg-white border-b border-gray-200 ${className}`}>
      {/* Top Controls Row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Navigation Controls */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
            title="Previous week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
            title="Next week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-2" />

          <button
            type="button"
            onClick={handleToday}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
          >
            Today
          </button>
        </div>

        {/* Center Info */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {dates.length > 0 && startDate ? (
              <>
                {DateUtils.formatDate(startDate, 'long')} - {DateUtils.formatDate(DateUtils.addDays(startDate, 30), 'long')}
                <span className="text-gray-400 ml-2">({dates.length} days)</span>
              </>
            ) : (
              'Calendar Timeline'
            )}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-4">
          {/* Mode Toggle Switch */}
          {onModeToggle && (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Move className="w-4 h-4" />
                <span className="font-medium">Move</span>
              </div>
              
              <Switch
                checked={isResizeMode}
                onCheckedChange={onModeToggle}
                disabled={loading}
                className="data-[state=checked]:bg-blue-600"
                aria-label="Toggle between move and resize mode"
              />
              
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <Scaling className="w-4 h-4" />
                <span className="font-medium">Resize</span>
              </div>
            </div>
          )}

          {/* Separator */}
          {onModeToggle && (
            <div className="w-px h-6 bg-gray-300" />
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !selectedPropertyId}
            className={`
              p-2 rounded-md transition-colors duration-150 disabled:opacity-50
              ${loading ? 'animate-spin' : 'hover:bg-gray-100'}
              text-gray-500 hover:text-gray-700
            `}
            title="Refresh timeline data"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Date Headers Row - Responsive with matching grid constants */}
      <div className="flex bg-gray-50 border-t border-gray-200">
        {/* Sidebar spacer - matches TimelineGrid sidebar width */}
        <div 
          className="flex-shrink-0 border-r border-gray-200 bg-gradient-to-r from-gray-100 to-gray-50"
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="px-2 md:px-3 lg:px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Rooms
          </div>
        </div>

        {/* Date Columns - Fixed width matching TimelineGrid cells (no independent scroll) */}
        <div className="flex-1">
          <div 
            className="flex" 
            style={{ width: `${dates.length * gridConstants.CELL_WIDTH}px` }}
          >
            {dates.map((date, index) => {
              const isToday = DateUtils.isToday(date);
              const isPast = DateUtils.isPast(date);
              const isWeekend = DateUtils.isWeekend(date);

              return (
                <div
                  key={date}
                  className={`
                    flex-shrink-0 border-r border-gray-200 text-center transition-colors duration-150
                    ${isToday ? 'bg-blue-100/60 border-blue-300' : 'bg-gray-50'}
                    ${isPast ? 'opacity-60' : ''}
                    ${isWeekend && !isToday ? 'bg-gray-100' : ''}
                  `}
                  style={{ 
                    width: `${gridConstants.CELL_WIDTH}px`,
                    padding: gridConstants.BREAKPOINT === 'mobile' ? '6px 4px' : '8px 6px'
                  }}
                >
                  <div className={`
                    font-medium transition-colors duration-150
                    ${isToday ? 'text-blue-700' : 'text-gray-600'}
                    ${gridConstants.BREAKPOINT === 'mobile' ? 'text-xs' : 'text-xs'}
                  `}>
                    {gridConstants.BREAKPOINT === 'mobile' 
                      ? DateUtils.formatDate(date, 'weekday').substring(0, 2) // Abbreviated for mobile
                      : DateUtils.formatDate(date, 'weekday')
                    }
                  </div>
                  <div className={`
                    font-semibold transition-colors duration-150
                    ${isToday ? 'text-blue-900' : 'text-gray-900'}
                    ${gridConstants.BREAKPOINT === 'mobile' ? 'text-xs' : 'text-sm'}
                  `}>
                    {DateUtils.formatDate(date, 'short')}
                  </div>
                  {isToday && (
                    <div className="w-1 h-1 bg-blue-500 rounded-full mx-auto mt-1"></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CalendarHeader component for timeline navigation
 */
CalendarHeader.displayName = 'CalendarHeader';
