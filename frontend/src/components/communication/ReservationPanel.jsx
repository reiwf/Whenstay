import React from 'react';
import { Calendar, MapPin, Phone, Mail, User, Home } from 'lucide-react';
import UnlinkedThreadManager from './UnlinkedThreadManager';

export default function ReservationPanel({ thread, reservation, onThreadUpdate }) {
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
    <div className="h-full p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Reservation Details</h3>
      <div className="text-center text-primary-500 py-6 sm:py-8">
        <Home className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-primary-300" />
        <p className="text-sm sm:text-base">Select a conversation to view reservation details</p>
      </div>
    </div>
    );
  }

  // Show unlinked thread manager if thread needs linking
  if (thread.needs_linking) {
    return (
      <div className="h-full overflow-y-auto">
        <UnlinkedThreadManager 
          thread={thread}
          onThreadLinked={onThreadUpdate}
        />
      </div>
    );
  }

  if (!thread.reservation_id) {
    return (
    <div className="h-full p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Reservation Details</h3>
      <div className="text-center text-primary-500 py-6 sm:py-8">
        <Home className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-primary-300" />
        <p className="text-sm sm:text-base">No reservation linked to this conversation</p>
      </div>
    </div>
    );
  }

  return (
    <div className="h-full p-3 sm:p-4 overflow-y-auto">
      <h3 className="text-base sm:text-lg font-semibold text-primary-900 mb-3 sm:mb-4">Reservation Details</h3>
      
      {!reservation ? (
        <div className="space-y-3 sm:space-y-4">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-3 sm:h-4 bg-primary-200 rounded w-3/4"></div>
            <div className="h-3 sm:h-4 bg-primary-200 rounded w-1/2"></div>
            <div className="h-3 sm:h-4 bg-primary-200 rounded w-2/3"></div>
          </div>
          <div className="text-center text-primary-500 py-3 sm:py-4">
            <p className="text-xs sm:text-sm">Loading reservation details...</p>
            <p className="text-xs mt-1">Reservation ID: {thread.reservation_id}</p>
          </div>
        </div>
      ) : reservation.error ? (
        <div className="text-center text-red-500 py-6 sm:py-8">
          <Home className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-red-300" />
          <p className="text-xs sm:text-sm font-medium">Failed to load reservation details</p>
          <p className="text-xs mt-1">{reservation.message}</p>
          <p className="text-xs mt-1 text-primary-500">Reservation ID: {thread.reservation_id}</p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Guest Information */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-primary-900 mb-2 sm:mb-3 flex items-center">
              <User className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Guest Information
            </h4>
            <div className="space-y-1 sm:space-y-2">
              <div className="text-xs sm:text-sm">
                <span className="font-medium">
                  {reservation.booking_name || reservation.guest_name || 'Guest Name'}
                </span>
              </div>
              
              {(reservation.booking_phone || reservation.phone) && (
                <div className="flex items-center text-xs sm:text-sm text-primary-600">
                  <Phone className="w-3 h-3 mr-1 sm:mr-2 flex-shrink-0" />
                  <a 
                    href={`tel:${reservation.booking_phone || reservation.phone}`}
                    className="hover:text-primary-600 break-all"
                  >
                    {reservation.booking_phone || reservation.phone}
                  </a>
                </div>
              )}
              
              {(reservation.booking_email || reservation.email) && (
                <div className="flex items-center text-xs sm:text-sm text-primary-600">
                  <Mail className="w-3 h-3 mr-1 sm:mr-2 flex-shrink-0" />
                  <a 
                    href={`mailto:${reservation.booking_email || reservation.email}`}
                    className="hover:text-primary-600 break-all"
                  >
                    {reservation.booking_email || reservation.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Stay Details */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-primary-900 mb-2 sm:mb-3 flex items-center">
              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Stay Details
            </h4>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-primary-600">Check-in:</span>
                <span className="font-medium">{formatDate(reservation.check_in_date || reservation.check_in)}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-primary-600">Check-out:</span>
                <span className="font-medium">{formatDate(reservation.check_out_date || reservation.check_out)}</span>
              </div>
              {(reservation.check_in_date || reservation.check_in) && (reservation.check_out_date || reservation.check_out) && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-primary-600">Duration:</span>
                  <span className="font-medium">
                    {Math.ceil((new Date(reservation.check_out_date || reservation.check_out) - new Date(reservation.check_in_date || reservation.check_in)) / (1000 * 60 * 60 * 24))} nights
                  </span>
                </div>
              )}
              {reservation.num_guests && (
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-primary-600">Guests:</span>
                  <span className="font-medium">{reservation.num_guests}</span>
                </div>
              )}
            </div>
          </div>

          {/* Property Information */}
          {(reservation.property_name || reservation.room_type_name || reservation.unit_number) && (
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-primary-900 mb-2 sm:mb-3 flex items-center">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                Property & Room
              </h4>
              <div className="space-y-1">
                {reservation.property_name && (
                  <div className="text-xs sm:text-sm">
                    <span className="font-medium">{reservation.property_name}</span>
                  </div>
                )}
                {reservation.room_type_name && (
                  <div className="text-xs sm:text-sm text-primary-600">
                    Room Type: {reservation.room_type_name}
                  </div>
                )}
                {reservation.unit_number && (
                  <div className="text-xs sm:text-sm text-primary-600">
                    Unit: {reservation.unit_number}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Reservation Status */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-primary-900 mb-2 sm:mb-3">Status</h4>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-primary-600">Reservation:</span>
                <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  reservation.status === 'confirmed' 
                    ? 'bg-green-100 text-green-800'
                    : reservation.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-primary-100 text-primary-800'
                }`}>
                  {reservation.status || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-primary-600">Conversation:</span>
                <span className={`inline-flex items-center px-1.5 sm:px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  thread.status === 'open' 
                    ? 'bg-green-100 text-green-800'
                    : thread.status === 'closed'
                    ? 'bg-primary-100 text-primary-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {thread.status}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h4 className="text-xs sm:text-sm font-medium text-primary-900 mb-2 sm:mb-3">Quick Actions</h4>
            <div className="space-y-1 sm:space-y-2">
              <button className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-primary-700 hover:bg-primary-100 rounded-md transition-colors">
                View Full Reservation
              </button>
              <button className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-primary-700 hover:bg-primary-100 rounded-md transition-colors">
                Edit Reservation
              </button>
              <button className="w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-primary-700 hover:bg-primary-100 rounded-md transition-colors">
                Send Check-in Link
              </button>
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-3 sm:pt-4 border-t border-primary-200">
            <div className="text-xs text-primary-500 space-y-0.5 sm:space-y-1">
              <div className="break-all">Reservation ID: {reservation.id?.slice(0, 8)}</div>
              <div className="break-all">Thread ID: {thread.id.slice(0, 8)}</div>
              {reservation.beds24_booking_id && (
                <div className="break-all">Beds24 ID: {reservation.beds24_booking_id}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
