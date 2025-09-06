import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  RotateCcw,
  ArrowDownUp,
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
      // Get today's date in Japan/Osaka timezone (Asia/Tokyo)
      const now = new Date();
      const japanTime = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      
      const newStartDate = DateUtils.addDays(japanTime, -1); // yesterday
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
    <div className={`bg-gray-100  ${className}`}>
      {/* Mobile Layout (stack vertically) */}
      {gridConstants.BREAKPOINT === 'mobile' && (
        <div className="px-2 py-2 space-y-2">
          {/* Top Row - Navigation and Date */}
          <div className="flex items-center justify-between">
            {/* Navigation Controls */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={handlePrevious}
                disabled={loading}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
                title="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
                title="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleToday}
                disabled={loading}
                className="px-2 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50 ml-1"
              >
                Today
              </button>
            </div>

            {/* Center Info - Compact */}
            <div className="flex items-center space-x-1 text-xs text-gray-600 min-w-0 flex-1 justify-center">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">
                {dates.length > 0 && startDate ? (
                  <>
                    {DateUtils.formatDate(startDate, 'short')} - {DateUtils.formatDate(DateUtils.addDays(startDate, 27), 'short')}
                  </>
                ) : (
                  'Calendar'
                )}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || !selectedPropertyId}
              className={`
                p-1.5 rounded-md transition-colors duration-150 disabled:opacity-50
                ${loading ? 'animate-spin' : 'hover:bg-gray-100'}
                text-gray-500 hover:text-gray-700
              `}
              title="Refresh timeline data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Row - Mode Controls */}
          {onModeToggle && onHorizontalModeToggle && (
            <div className="flex items-center justify-center space-x-3">
              {/* Move/Resize Toggle */}
              <div className="flex items-center space-x-1">
                <Switch
                  checked={isResizeMode}
                  onCheckedChange={onModeToggle}
                  disabled={loading}
                  className="data-[state=checked]:bg-gray-600 scale-75"
                  aria-label="Toggle between move and resize mode"
                />
                <Scaling className="w-3 h-3 text-gray-600" />
              </div>

              {/* Horizontal Mode Toggle */}
              <div className="flex items-center space-x-1">
                <Switch
                  checked={isHorizontalMode}
                  onCheckedChange={onHorizontalModeToggle}
                  disabled={loading}
                  className="data-[state=checked]:bg-gray-600 scale-75"
                  aria-label="Toggle horizontal movement mode"
                />
                <ArrowLeftRight className="w-3 h-3 text-gray-600" />
              </div>

              {/* Allocate Mode Toggle */}
              <div className="flex items-center space-x-1">
                <Switch 
                  checked={showStagingRow} 
                  onCheckedChange={onStagingToggle} 
                  className="data-[state=checked]:bg-gray-600 scale-75"
                />
                <ArrowDownUp className="w-3 h-3 text-gray-600" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tablet Layout (compact horizontal) */}
      {gridConstants.BREAKPOINT === 'tablet' && (
        <div className="flex items-center justify-between px-3 py-2">
          {/* Navigation Controls */}
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            <button
              type="button"
              onClick={handleToday}
              disabled={loading}
              className="px-2 py-1 text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-150 disabled:opacity-50"
            >
              Today
            </button>
          </div>

          {/* Center Info */}
          <div className="flex items-center space-x-1 text-xs text-gray-600 min-w-0 flex-1 justify-center mx-2">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">
              {dates.length > 0 && startDate ? (
                <>
                  {DateUtils.formatDate(startDate, 'short')} - {DateUtils.formatDate(DateUtils.addDays(startDate, 27), 'short')}
                  <span className="text-gray-400 ml-1">({dates.length}d)</span>
                </>
              ) : (
                'Calendar Timeline'
              )}
            </span>
          </div>

          {/* Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Mode Toggle Switches */}
            {onModeToggle && onHorizontalModeToggle && (
              <div className="flex items-center space-x-2">
                {/* Move/Resize Toggle */}
                <div className="flex items-center space-x-1">
                  <Switch
                    checked={isResizeMode}
                    onCheckedChange={onModeToggle}
                    disabled={loading}
                    className="data-[state=checked]:bg-gray-600 scale-90"
                    aria-label="Toggle between move and resize mode"
                  />
                  <Scaling className="w-3 h-3 text-gray-600" />
                </div>

                {/* Horizontal Mode Toggle */}
                <div className="flex items-center space-x-1">
                  <Switch
                    checked={isHorizontalMode}
                    onCheckedChange={onHorizontalModeToggle}
                    disabled={loading}
                    className="data-[state=checked]:bg-gray-600 scale-90"
                    aria-label="Toggle horizontal movement mode"
                  />
                  <ArrowLeftRight className="w-3 h-3 text-gray-600" />
                </div>

                {/* Allocate Mode Toggle */}
                <div className="flex items-center space-x-1">
                  <Switch 
                    checked={showStagingRow} 
                    onCheckedChange={onStagingToggle} 
                    className="data-[state=checked]:bg-gray-600 scale-90"
                  />
                  <ArrowDownUp className="w-3 h-3 text-gray-600" />
                </div>
              </div>
            )}

            <div className="w-px h-5 bg-gray-300" />

            {/* Refresh Button */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || !selectedPropertyId}
              className={`
                p-1.5 rounded-md transition-colors duration-150 disabled:opacity-50
                ${loading ? 'animate-spin' : 'hover:bg-gray-100'}
                text-gray-500 hover:text-gray-700
              `}
              title="Refresh timeline data"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop Layout (full size) */}
      {gridConstants.BREAKPOINT === 'desktop' && (
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
                  {DateUtils.formatDate(startDate, 'long')} - {DateUtils.formatDate(DateUtils.addDays(startDate, 27), 'long')}
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

                <div className="w-px h-6 bg-gray-300" />

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

                <div className="w-px h-6 bg-gray-300" />

                {/* Allocate Mode Toggle */}
                <div className="flex items-center space-x-2 text-gray-700">
                  <Switch checked={showStagingRow} onCheckedChange={onStagingToggle} className="data-[state=checked]:bg-gray-600"/>
                  <ArrowDownUp className="w-4 h-4" />
                  <span className="text-sm text-slate-600">Allocate</span>
                </div>
              </div>
            )}

            <div className="w-px h-6 bg-gray-300" />

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
      )}
    </div>
  );
}

/**
 * CalendarHeader component for timeline navigation
 */
CalendarHeader.displayName = 'CalendarHeader';
