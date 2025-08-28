import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  RotateCcw,
  Move,
  Scaling,
  ArrowLeftRight
} from 'lucide-react';
import { DateUtils, GridUtils } from './CalendarUtils';
import { Switch } from '../ui/switch';


export default function CalendarHeader({ 
  dates = [], 
  startDate, 
  onNavigate, 
  onRefresh,
  loading = false,
  selectedPropertyId = null,
  isResizeMode = false,
  onModeToggle,
  isHorizontalMode = false,
  onHorizontalModeToggle,
  showStagingRow = false,
  onStagingToggle = () => {},
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
    <div className={`bg-gray-100 border-b border-gray-200 ${className}`}>
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
          {/* Mode Toggle Switches */}
          {onModeToggle && onHorizontalModeToggle && (
            <div className="flex items-center space-x-4">
              {/* Move/Resize Toggle */}
              <div className="flex items-center space-x-3">
                
                <Switch
                  checked={isResizeMode}
                  onCheckedChange={onModeToggle}
                  disabled={loading}
                  className="data-[state=checked]:bg-gray-600"
                  aria-label="Toggle between move and resize mode"
                />
                
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <Scaling className="w-4 h-4" />
                  <span className="font-medium">Resize</span>
                </div>
              </div>

              {/* Horizontal Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={isHorizontalMode}
                  onCheckedChange={onHorizontalModeToggle}
                  disabled={loading}
                  className="data-[state=checked]:bg-gray-600"
                  aria-label="Toggle horizontal movement mode"
                />
                <div className="flex items-center space-x-2 text-sm text-gray-700">
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="font-medium">Horizontal</span>
                </div>
              </div>

              {/* Allocate Mode Toggle */}
              <div className="flex items-center space-x-2">
                <Switch checked={showStagingRow} onCheckedChange={onStagingToggle} className="data-[state=checked]:bg-gray-600"/>
                <span className="text-sm text-slate-600">Allocate</span>
              </div>
            </div>
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

      {/* Month Headers Row - Thin row showing month names */}
      <div className="flex bg-gray-100 border-t border-gray-200">
        {/* Sidebar spacer */}
        <div 
          className="flex-shrink-0 border-r border-gray-200 bg-gray-300"
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="px-2 md:px-3 lg:px-4 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
            {/* Empty spacer */}
          </div>
        </div>

        {/* Month Columns */}
        <div className="flex-1 relative">
          <div 
            className="flex" 
            style={{ width: `${dates.length * gridConstants.CELL_WIDTH}px` }}
          >
            {/* Month labels positioned absolutely for centering */}
            {(() => {
              const monthLabels = [];
              let currentMonthStart = 0;
              let currentMonth = null;
              
              dates.forEach((date, index) => {
                const dateObj = new Date(date);
                const monthKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}`;
                
                if (currentMonth !== monthKey) {
                  // End previous month if it exists
                  if (currentMonth !== null) {
                    const monthWidth = (index - currentMonthStart) * gridConstants.CELL_WIDTH;
                    const monthPosition = currentMonthStart * gridConstants.CELL_WIDTH;
                    const prevDateObj = new Date(dates[currentMonthStart]);
                    const monthText = gridConstants.BREAKPOINT === 'mobile' 
                      ? prevDateObj.toLocaleDateString('en-US', { month: 'short' })
                      : prevDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    
                    monthLabels.push(
                      <div
                        key={`month-label-${currentMonth}`}
                        className="absolute py-1 text-xs font-medium text-gray-600 flex items-center justify-center"
                        style={{
                          left: `${monthPosition}px`,
                          width: `${monthWidth}px`,
                          height: '100%'
                        }}
                      >
                        {monthText}
                      </div>
                    );
                  }
                  
                  // Start new month
                  currentMonth = monthKey;
                  currentMonthStart = index;
                }
              });
              
              // Handle the last month
              if (currentMonth !== null) {
                const monthWidth = (dates.length - currentMonthStart) * gridConstants.CELL_WIDTH;
                const monthPosition = currentMonthStart * gridConstants.CELL_WIDTH;
                const lastDateObj = new Date(dates[currentMonthStart]);
                const monthText = gridConstants.BREAKPOINT === 'mobile' 
                  ? lastDateObj.toLocaleDateString('en-US', { month: 'short' })
                  : lastDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                
                monthLabels.push(
                  <div
                    key={`month-label-${currentMonth}`}
                    className="absolute py-1 text-xs font-medium text-gray-600 flex items-center justify-center"
                    style={{
                      left: `${monthPosition}px`,
                      width: `${monthWidth}px`,
                      height: '100%'
                    }}
                  >
                    {monthText}
                  </div>
                );
              }
              
              return monthLabels;
            })()}
            
            {/* Month boundary lines - only at month transitions */}
            {dates.map((date, index) => {
              const currentDate = new Date(date);
              const nextDate = index < dates.length - 1 ? new Date(dates[index + 1]) : null;
              const isMonthBoundary = nextDate && currentDate.getMonth() !== nextDate.getMonth();
              
              return (
                <div
                  key={`month-cell-${date}`}
                  className={`flex-shrink-0 bg-gray-300 ${isMonthBoundary ? 'border-r border-white' : ''}`}
                  style={{ width: `${gridConstants.CELL_WIDTH}px`, height: '28px' }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Date Headers Row - Sticky when scrolling + Responsive with matching grid constants */}
      <div className="sticky top-0 z-30 flex bg-gray-50 border-t border-b border-white shadow-sm">
        {/* Sidebar spacer - matches TimelineGrid sidebar width */}
        <div 
          className="flex-shrink-0 border-r border-white bg-gray-200"
          style={{ width: `${gridConstants.SIDEBAR_WIDTH}px` }}
        >
          <div className="px-2 md:px-3 lg:px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
            Rooms
          </div>
        </div>

        {/* Date Columns - Responsive width matching TimelineGrid cells */}
        <div className="flex-1">
          <div 
            className="flex" 
            style={{ 
              width: '100%',
              minWidth: `${dates.length * gridConstants.CELL_WIDTH}px` 
            }}
          >
            {dates.map((date, index) => {
              const isToday = DateUtils.isToday(date);
              const isPast = DateUtils.isPast(date);
              const isWeekend = DateUtils.isWeekend(date);

              return (
                <div
                  key={date}
                  className={`
                    flex-shrink-0 border-r border-white text-center transition-colors duration-150 bg-gray-200
                    ${isToday && !isWeekend ? 'bg-orange-50 border-blue-300' : ''}
                    ${isToday && isWeekend ? 'bg-blue-50 border-blue-300' : ''}
                    ${isWeekend && !isToday ? 'bg-gray-300' : ''}
                    ${!isWeekend && !isToday ? 'bg-gray-200' : ''}
                    ${isPast ? 'opacity-60' : ''}
                  `}
                  style={{ 
                    width: `${gridConstants.CELL_WIDTH}px`,
                    padding: gridConstants.BREAKPOINT === 'mobile' ? '6px 4px' : '8px 6px'
                  }}
                >
                  <div className={`
                    font-medium transition-colors duration-150 
                    ${isToday ? 'text-gray-700' : 'text-gray-600'}
                    ${gridConstants.BREAKPOINT === 'mobile' ? 'text-xs' : 'text-xs'}
                  `}>
                    {gridConstants.BREAKPOINT === 'mobile' 
                      ? DateUtils.formatDate(date, 'weekday').substring(0, 2) // Abbreviated for mobile
                      : DateUtils.formatDate(date, 'weekday')
                    }
                  </div>
                  <div className={`
                    text-xs transition-colors duration-150
                    ${isToday ? 'text-gray-900' : 'text-gray-900'}
                    ${gridConstants.BREAKPOINT === 'mobile' ? 'text-xs' : 'text-sm'}
                  `}>
                    {new Date(date).getDate()}
                  </div>
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
