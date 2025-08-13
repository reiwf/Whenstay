import React from 'react';
import { Calendar, MapPin, Phone, Mail, User, Home } from 'lucide-react';

export default function ReservationPanel({ thread, reservation }) {
  // Debug logging (can be removed in production)
  if (process.env.NODE_ENV === 'development') {
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!thread) {
    return (
      <div className="h-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Details</h3>
        <div className="text-center text-gray-500 py-8">
          <Home className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Select a conversation to view reservation details</p>
        </div>
      </div>
    );
  }

  if (!thread.reservation_id) {
    return (
      <div className="h-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Details</h3>
        <div className="text-center text-gray-500 py-8">
          <Home className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No reservation linked to this conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4 overflow-y-auto">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Details</h3>
      
      {!reservation ? (
        <div className="space-y-4">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div className="text-center text-gray-500 py-4">
            <p className="text-sm">Loading reservation details...</p>
            <p className="text-xs mt-1">Reservation ID: {thread.reservation_id}</p>
          </div>
        </div>
      ) : reservation.error ? (
        <div className="text-center text-red-500 py-8">
          <Home className="w-12 h-12 mx-auto mb-3 text-red-300" />
          <p className="text-sm font-medium">Failed to load reservation details</p>
          <p className="text-xs mt-1">{reservation.message}</p>
          <p className="text-xs mt-1 text-gray-500">Reservation ID: {thread.reservation_id}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Guest Information */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Guest Information
            </h4>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">
                  {reservation.booking_name || reservation.guest_name || 'Guest Name'}
                </span>
              </div>
              
              {(reservation.booking_phone || reservation.phone) && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="w-3 h-3 mr-2" />
                  <a 
                    href={`tel:${reservation.booking_phone || reservation.phone}`}
                    className="hover:text-blue-600"
                  >
                    {reservation.booking_phone || reservation.phone}
                  </a>
                </div>
              )}
              
              {(reservation.booking_email || reservation.email) && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="w-3 h-3 mr-2" />
                  <a 
                    href={`mailto:${reservation.booking_email || reservation.email}`}
                    className="hover:text-blue-600"
                  >
                    {reservation.booking_email || reservation.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Stay Details */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Stay Details
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Check-in:</span>
                <span className="font-medium">{formatDate(reservation.check_in_date || reservation.check_in)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Check-out:</span>
                <span className="font-medium">{formatDate(reservation.check_out_date || reservation.check_out)}</span>
              </div>
              {(reservation.check_in_date || reservation.check_in) && (reservation.check_out_date || reservation.check_out) && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {Math.ceil((new Date(reservation.check_out_date || reservation.check_out) - new Date(reservation.check_in_date || reservation.check_in)) / (1000 * 60 * 60 * 24))} nights
                  </span>
                </div>
              )}
              {reservation.num_guests && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Guests:</span>
                  <span className="font-medium">{reservation.num_guests}</span>
                </div>
              )}
            </div>
          </div>

          {/* Property Information */}
          {(reservation.property_name || reservation.room_type_name || reservation.unit_number) && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Property & Room
              </h4>
              <div className="space-y-1">
                {reservation.property_name && (
                  <div className="text-sm">
                    <span className="font-medium">{reservation.property_name}</span>
                  </div>
                )}
                {reservation.room_type_name && (
                  <div className="text-sm text-gray-600">
                    Room Type: {reservation.room_type_name}
                  </div>
                )}
                {reservation.unit_number && (
                  <div className="text-sm text-gray-600">
                    Unit: {reservation.unit_number}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reservation Status */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Status</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Reservation:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  reservation.status === 'confirmed' 
                    ? 'bg-green-100 text-green-800'
                    : reservation.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {reservation.status || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Conversation:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  thread.status === 'open' 
                    ? 'bg-green-100 text-green-800'
                    : thread.status === 'closed'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {thread.status}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
            <div className="space-y-2">
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                View Full Reservation
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                Edit Reservation
              </button>
              <button className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md">
                Send Check-in Link
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              <div>Reservation ID: {reservation.id?.slice(0, 8)}</div>
              <div>Thread ID: {thread.id.slice(0, 8)}</div>
              {reservation.beds24_booking_id && (
                <div>Beds24 ID: {reservation.beds24_booking_id}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
