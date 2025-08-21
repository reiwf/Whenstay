import React from 'react';
import { Users, Crown } from 'lucide-react';

export default function GroupBookingBadge({ groupBookingInfo, className = '' }) {
  if (!groupBookingInfo?.is_group_booking) {
    return null;
  }

  const { group_info } = groupBookingInfo;
  const roomCount = group_info?.room_count || 1;
  const isMaster = group_info?.is_master || false;

  return (
    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ${className}`}>
      {isMaster && <Crown className="w-3 h-3" />}
      <Users className="w-3 h-3" />
      <span>
        Group Booking {roomCount > 1 && `(${roomCount} rooms)`}
        {isMaster && ' - Master'}
      </span>
    </div>
  );
}
