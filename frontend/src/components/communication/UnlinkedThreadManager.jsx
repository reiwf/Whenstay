import React, { useState, useEffect } from 'react';
import { Link, Search, AlertTriangle, CheckCircle, XCircle, Users, Calendar, Mail } from 'lucide-react';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function UnlinkedThreadManager({ thread, onThreadLinked }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load suggestions on mount
  useEffect(() => {
    if (thread?.id) {
      loadSuggestions();
    }
  }, [thread?.id]);

  const loadSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const response = await adminAPI.getThreadSuggestions(thread.id);
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Search for reservations
  const searchReservations = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoadingSearch(true);
      const response = await adminAPI.getReservations({
        search: query,
        limit: 10
      });
      setSearchResults(response.data.reservations || []);
    } catch (error) {
      console.error('Error searching reservations:', error);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchReservations(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleLinkToReservation = async (reservationId) => {
    try {
      setActionLoading(true);
      await adminAPI.linkThread(thread.id, reservationId);
      toast.success('Thread linked successfully');
      onThreadLinked?.();
    } catch (error) {
      console.error('Error linking thread:', error);
      toast.error('Failed to link thread');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectThread = async (reason = 'spam') => {
    try {
      setActionLoading(true);
      await adminAPI.rejectThread(thread.id, reason);
      toast.success(`Thread marked as ${reason}`);
      onThreadLinked?.();
    } catch (error) {
      console.error('Error rejecting thread:', error);
      toast.error('Failed to reject thread');
    } finally {
      setActionLoading(false);
    }
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2 pb-3 border-b border-gray-200">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="text-lg font-semibold text-gray-900">Unlinked Thread</h3>
      </div>

      {/* Thread Info */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
        <p className="text-sm text-orange-800">
          This conversation couldn't be automatically linked to a reservation and needs manual attention.
        </p>
      </div>

      {/* Suggested Matches */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Suggested Matches</h4>
        
        {loadingSuggestions ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Finding matches...</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No matching reservations found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {suggestion.booking_name}
                      </p>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(suggestion.confidence)}`}>
                        {suggestion.confidence}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-2">
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>{suggestion.booking_email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(suggestion.check_in_date)} - {formatDate(suggestion.check_out_date)}</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-600">
                      {suggestion.match_reason}
                    </p>
                    
                    {suggestion.properties && (
                      <p className="text-xs text-gray-500 mt-1">
                        Property: {suggestion.properties.name}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleLinkToReservation(suggestion.id)}
                    disabled={actionLoading}
                    className="ml-3 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Search */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-3">Search Reservations</h4>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name, email, or booking ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {loadingSearch && (
          <div className="text-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        )}

        {searchTerm && !loadingSearch && searchResults.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-2">No reservations found</p>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {searchResults.map((reservation) => (
              <div
                key={reservation.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {reservation.booking_name}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 mb-1">
                      <div className="flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>{reservation.booking_email}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}</span>
                      </div>
                    </div>
                    
                    {reservation.properties && (
                      <p className="text-xs text-gray-500">
                        Property: {reservation.properties.name}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => handleLinkToReservation(reservation.id)}
                    disabled={actionLoading}
                    className="ml-3 inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Link className="w-3 h-3 mr-1" />
                    Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Other Actions</h4>
        
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => handleRejectThread('spam')}
            disabled={actionLoading}
            className="inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Mark as Spam
          </button>
          
          <button
            onClick={() => handleRejectThread('irrelevant')}
            disabled={actionLoading}
            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Mark as Irrelevant
          </button>
        </div>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Tip:</strong> Use the suggestions above for quick linking, or search manually for specific reservations. 
          If this is spam or irrelevant, use the action buttons to archive it.
        </p>
      </div>
    </div>
  );
}
