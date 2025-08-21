import React, { useState } from 'react';
import { Users, Crown, Calendar, MapPin, ChevronDown, ChevronUp } from 'lucide-react';

export default function GroupBookingPanel({ groupBookingInfo, reservation, className = '' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!groupBookingInfo?.is_group_booking) {
    return null;
  }

  const { group_info } = groupBookingInfo;
  const { is_master, master_id, room_count, reservations } = group_info;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`bg-purple-50 border border-purple-200 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {is_master && <Crown className="w-5 h-5 text-purple-600" />}
          <Users className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-purple-900">
            Group Booking {room_count > 1 && `- ${room_count} Rooms`}
          </h3>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-purple-600 hover:text-purple-800 transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Status Badge */}
      <div className="mb-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          is_master 
            ? 'bg-purple-100 text-purple-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {is_master ? 'Master Reservation' : 'Child Reservation'}
        </span>
      </div>

      {/* Basic Info */}
      <div className="space-y-2 text-sm">
        {reservation && (
          <div className="flex items-center space-x-2 text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              {formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}
            </span>
          </div>
        )}
        
        {reservation?.properties && (
          <div className="flex items-center space-x-2 text-gray-600">
            <MapPin className="w-4 h-4" />
            <span>{reservation.properties.name}</span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && reservations && reservations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-200">
          <h4 className="font-medium text-purple-900 mb-3">All Reservations in Group</h4>
          <div className="space-y-2">
            {reservations.map((res) => (
              <div
                key={res.id}
                className={`p-3 rounded-md border ${
                  res.is_group_master
                    ? 'bg-purple-100 border-purple-300'
                    : 'bg-white border-purple-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      {res.is_group_master && <Crown className="w-4 h-4 text-purple-600" />}
                      <span className="font-medium text-purple-900">
                        {res.booking_name || 'No name'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {res.id.slice(0, 8)}... • Check-in: {formatDate(res.check_in_date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      res.is_group_master
                        ? 'bg-purple-200 text-purple-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {res.is_group_master ? 'Master' : 'Room'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Communication Notice */}
      <div className="mt-4 p-3 bg-purple-100 rounded-md">
        <p className="text-sm text-purple-800">
          <strong>Note:</strong> Messages sent to this group booking will be visible across all rooms in the group.
          {is_master && ' As the master reservation, automation and notifications are managed here.'}
        </p>
      </div>
    </div>
  );
}
