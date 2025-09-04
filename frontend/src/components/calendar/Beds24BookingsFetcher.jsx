import React, { useState } from 'react';
import { Calendar, Search, Download, AlertCircle, CheckCircle } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import api from '../../services/api';

/**
 * Beds24BookingsFetcher - UI component to fetch bookings from Beds24 API
 * Reuses PropertySelector and provides date picker for arrival date
 */
export default function Beds24BookingsFetcher({ className = "" }) {
  const { selectedProperty, properties } = useProperty();
  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalToDate, setArrivalToDate] = useState('');
  const [processAndSave, setProcessAndSave] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const handleFetchBookings = async () => {
    if (!selectedProperty || !selectedProperty.beds24_property_id) {
      setError('Please select a property with Beds24 integration first');
      return;
    }

    if (!arrivalDate) {
      setError('Please select an arrival date');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const params = {
        propertyId: selectedProperty.beds24_property_id,
        arrival: arrivalDate
      };

      // Add arrivalTo if specified
      if (arrivalToDate) {
        params.arrivalTo = arrivalToDate;
      }

      const response = await api.get('/reservations/beds24-bookings', { params });
      
      if (response.data?.success) {
        setBookings(response.data.data || []);
        setLastFetch(new Date().toLocaleString());
        setError(null);
      } else {
        setError('Failed to fetch bookings: ' + (response.data?.error || 'Unknown error'));
        setBookings([]);
      }
    } catch (err) {
      console.error('Error fetching Beds24 bookings:', err);
      const errorMessage = err.response?.data?.error || err.message || 'Failed to fetch bookings';
      setError(errorMessage);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setBookings([]);
    setError(null);
    setLastFetch(null);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl
          bg-blue-100/80 ring-1 ring-blue-200/60
          dark:bg-blue-900/30 dark:ring-blue-800/40">
          <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Fetch Beds24 Bookings
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Retrieve bookings data from Beds24 API for a specific property and date
          </p>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="rounded-2xl p-6
        bg-white/70 backdrop-blur-xl ring-1 ring-white/60 shadow-lg
        dark:bg-slate-900/50 dark:ring-slate-700/60">
        
        <div className="space-y-4">
          {/* Property Selection Note */}
          <div className="rounded-xl p-3 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Selected Property:</strong> {selectedProperty?.name || 'No property selected'}
              {!selectedProperty && (
                <span className="block mt-1 text-blue-600 dark:text-blue-400">
                  Please select a property from the header dropdown above.
                </span>
              )}
            </p>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                Arrival Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  min={today}
                  disabled={loading}
                  className="w-full rounded-xl px-3 py-2 pl-10 text-sm
                    bg-white/55 backdrop-blur-xl ring-1 ring-white/50 shadow-sm
                    hover:bg-white/70 hover:ring-white/60
                    focus:ring-2 focus:ring-blue-400/50 focus:bg-white/80
                    disabled:opacity-50 disabled:cursor-not-allowed
                    dark:bg-slate-900/35 dark:ring-slate-700/60
                    dark:hover:bg-slate-900/55 dark:focus:ring-blue-400/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                Arrival To Date (optional)
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
                <input
                  type="date"
                  value={arrivalToDate}
                  onChange={(e) => setArrivalToDate(e.target.value)}
                  min={arrivalDate || today}
                  disabled={loading}
                  className="w-full rounded-xl px-3 py-2 pl-10 text-sm
                    bg-white/55 backdrop-blur-xl ring-1 ring-white/50 shadow-sm
                    hover:bg-white/70 hover:ring-white/60
                    focus:ring-2 focus:ring-blue-400/50 focus:bg-white/80
                    disabled:opacity-50 disabled:cursor-not-allowed
                    dark:bg-slate-900/35 dark:ring-slate-700/60
                    dark:hover:bg-slate-900/55 dark:focus:ring-blue-400/40"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Leave empty to fetch bookings for a single date
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleFetchBookings}
              disabled={loading || !selectedProperty?.beds24_property_id || !arrivalDate}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium
                bg-blue-600 text-white shadow-sm
                hover:bg-blue-700 hover:shadow-md
                active:bg-blue-800 active:shadow-none
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-200"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Fetch Bookings
                </>
              )}
            </button>

            {(bookings.length > 0 || error) && (
              <button
                onClick={clearResults}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium
                  bg-slate-100 text-slate-700 shadow-sm
                  hover:bg-slate-200 hover:shadow-md
                  active:bg-slate-300 active:shadow-none
                  disabled:opacity-50 disabled:cursor-not-allowed
                  dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700
                  transition-all duration-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {error && (
        <div className="rounded-xl p-4
          bg-red-50/80 ring-1 ring-red-200/70 shadow-sm
          dark:bg-red-900/20 dark:ring-red-800/40">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {bookings.length > 0 && (
        <div className="rounded-2xl p-6
          bg-white/70 backdrop-blur-xl ring-1 ring-white/60 shadow-lg
          dark:bg-slate-900/50 dark:ring-slate-700/60">
          
          {/* Results Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-medium text-slate-900 dark:text-slate-100">
                  Bookings Retrieved
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Found {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
                  {lastFetch && ` • Last updated: ${lastFetch}`}
                </p>
              </div>
            </div>
          </div>

          {/* Bookings List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {bookings.map((booking, index) => (
              <div
                key={booking.id || index}
                className="rounded-xl p-4
                  bg-white/60 ring-1 ring-white/50 shadow-sm
                  dark:bg-slate-800/40 dark:ring-slate-700/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">ID:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{booking.id}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Guest:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">
                      {booking.firstName} {booking.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Dates:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">
                      {booking.arrival} - {booking.departure}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Property:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{booking.propertyId}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Room:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{booking.roomId || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Status:</span>
                    <span className="ml-2 text-slate-900 dark:text-slate-100">{booking.status}</span>
                  </div>
                  {booking.price && (
                    <div>
                      <span className="font-medium text-slate-600 dark:text-slate-400">Price:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">
                        {booking.currency || 'JPY'} {booking.price}
                      </span>
                    </div>
                  )}
                  {booking.email && (
                    <div>
                      <span className="font-medium text-slate-600 dark:text-slate-400">Email:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">{booking.email}</span>
                    </div>
                  )}
                  {booking.numAdult && (
                    <div>
                      <span className="font-medium text-slate-600 dark:text-slate-400">Guests:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">
                        {booking.numAdult} adult{booking.numAdult !== 1 ? 's' : ''}
                        {booking.numChild > 0 && `, ${booking.numChild} child${booking.numChild !== 1 ? 'ren' : ''}`}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Show booking group info if available */}
                {booking.bookingGroup && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-400">Group Booking:</span>
                      <span className="ml-2 text-slate-900 dark:text-slate-100">
                        Master ID: {booking.bookingGroup.master} 
                        ({booking.bookingGroup.ids?.length || 0} rooms)
                      </span>
                    </div>
                  </div>
                )}

                {/* Show additional info if available */}
                {(booking.comments || booking.message || booking.notes) && (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="text-sm">
                      <span className="font-medium text-slate-600 dark:text-slate-400">Notes:</span>
                      <p className="mt-1 text-slate-900 dark:text-slate-100">
                        {booking.comments || booking.message || booking.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Info */}
      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/20 rounded-xl p-3">
        <p className="font-medium mb-1">API Configuration:</p>
        <p>• includeBookingGroup: true (includes group booking information)</p>
        <p>• includeInfoItems: true (includes booking notes and additional details)</p>
      </div>
    </div>
  );
}

Beds24BookingsFetcher.displayName = 'Beds24BookingsFetcher';
