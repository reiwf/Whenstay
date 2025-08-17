import React from 'react';

export default function CalendarGrid({ days, onCellClick, formatPrice }) {
  if (!days || days.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No pricing data available
      </div>
    );
  }

  // Group days by weeks for proper calendar layout
  const weeks = [];
  let currentWeek = [];
  
  days.forEach((day, index) => {
    const date = new Date(day.date);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // If it's the first day or we've reached Sunday, start a new week
    if (index === 0) {
      // Add empty cells for days before the first date
      for (let i = 0; i < dayOfWeek; i++) {
        currentWeek.push(null);
      }
    }
    
    currentWeek.push(day);
    
    // If it's Saturday or the last day, complete the week
    if (dayOfWeek === 6 || index === days.length - 1) {
      // Fill remaining days of the week with null if needed
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekdays.map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Weeks */}
      <div className="space-y-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 gap-2">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={`empty-${dayIndex}`} className="h-20" />;
              }

              const date = new Date(day.date);
              const isToday = date.toDateString() === new Date().toDateString();
              const isPast = date < new Date().setHours(0, 0, 0, 0);
              
              return (
                <button
                  key={day.date}
                  onClick={() => onCellClick(day)}
                  className={`
                    h-20 p-2 rounded-lg border text-left transition-all hover:shadow-md
                    ${day.hasOverride 
                      ? 'border-amber-400 bg-amber-50' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                    }
                    ${isToday ? 'ring-2 ring-blue-500' : ''}
                    ${isPast ? 'opacity-60' : ''}
                  `}
                >
                  <div className="text-xs text-gray-500 mb-1">
                    {date.getDate()}
                  </div>
                  <div className="text-sm font-semibold">
                    {day.price ? formatPrice(day.price) : '-'}
                  </div>
                  {day.hasOverride && (
                    <div className="text-xs text-amber-600 mt-1">
                      Override
                    </div>
                  )}
                  {day.locked && (
                    <div className="text-xs text-red-600 mt-1">
                      🔒
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500 mt-4 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-gray-200 bg-white rounded"></div>
          <span>Calculated Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 border border-amber-400 bg-amber-50 rounded"></div>
          <span>Price Override</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 ring-2 ring-blue-500 bg-white rounded"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🔒</span>
          <span>Locked</span>
        </div>
      </div>
    </div>
  );
}
