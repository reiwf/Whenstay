import React from 'react';
import { DateTime } from 'luxon';

export default function TimezoneDisplay({ 
  datetime, 
  timezone = 'Asia/Tokyo', 
  propertyTimezone = null, 
  format = 'short',
  showBoth = false 
}) {
  if (!datetime) return null;

  const dt = DateTime.fromISO(datetime);
  const localTime = dt.setZone(timezone);
  const propertyTime = propertyTimezone && propertyTimezone !== timezone 
    ? dt.setZone(propertyTimezone) 
    : null;

  const formatOptions = {
    short: DateTime.DATETIME_SHORT,
    med: DateTime.DATETIME_MED,
    full: DateTime.DATETIME_FULL
  };

  const formatStyle = formatOptions[format] || DateTime.DATETIME_SHORT;

  return (
    <div className="text-sm">
      <div className="font-medium text-gray-900">
        {localTime.toLocaleString(formatStyle)}
        <span className="ml-1 text-xs text-gray-500 font-normal">
          {localTime.offsetNameShort}
        </span>
      </div>
      
      {showBoth && propertyTime && (
        <div className="text-xs text-gray-500 mt-0.5">
          {propertyTime.toLocaleString(formatStyle)} {propertyTime.offsetNameShort}
          <span className="text-gray-400"> (Property)</span>
        </div>
      )}
    </div>
  );
}
