import React, { useState, useMemo, useCallback } from 'react';
import { Search, MessageCircle, Clock, Users, Crown, AlertTriangle, X, Check } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';
import { useDebounce } from '../../hooks/useDebounce';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱',
  airbnb: airbnbLogo,
  bookingcom: '🏠'
};

const renderChannelIcon = (channel) => {
  const icon = CHANNEL_ICONS[channel];
  if (!icon) return '📱';
  
  if (channel === 'airbnb') {
    return <img src={icon} alt="Airbnb" className="w-4 h-4 inline" />;
  }
  
  return icon;
};

export default function InboxPanel({ threads, selectedThread, onThreadSelect, loading, onBulkClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, archived
  const [selectedThreads, setSelectedThreads] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // Debounce search term to reduce filter operations
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoize thread counts for filter tabs
  const threadCounts = useMemo(() => ({
    all: threads.length,
    unread: threads.filter(t => t.unread_count > 0).length,
    unlinked: threads.filter(t => t.needs_linking).length,
  }), [threads]);

  // Memoize filtered and sorted threads
  const filteredThreads = useMemo(() => {
    return threads
      .filter(thread => {
        const matchesSearch = !debouncedSearchTerm || 
          thread.subject?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          thread.last_message_preview?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

        const matchesFilter = filter === 'all' || 
          (filter === 'unread' && thread.unread_count > 0) ||
          (filter === 'unlinked' && thread.needs_linking) ||
          (filter === 'closed' && thread.status === 'closed');

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        // Sort by last_message_at in descending order (most recent first)
        const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [threads, debouncedSearchTerm, filter]);

  const getThreadChannels = (thread) => {
    if (!thread.thread_channels) return [];
    return thread.thread_channels.map(tc => tc.channel);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // Less than 24 hours - show time
    if (diff < 24 * 60 * 60 * 1000) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Less than 7 days - show day
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // Older - show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Bulk selection handlers with useCallback optimization
  const handleSelectModeToggle = useCallback(() => {
    setIsSelectMode(prev => {
      if (prev) {
        setSelectedThreads(new Set());
      }
      return !prev;
    });
  }, []);

  const handleThreadSelectionToggle = useCallback((threadId, event) => {
    event.stopPropagation(); // Prevent thread selection
    setSelectedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAllToggle = useCallback(() => {
    const openThreads = filteredThreads.filter(thread => thread.status === 'open');
    const allSelected = openThreads.every(thread => selectedThreads.has(thread.id));
    
    if (allSelected) {
      setSelectedThreads(new Set());
    } else {
      setSelectedThreads(new Set(openThreads.map(thread => thread.id)));
    }
  }, [filteredThreads, selectedThreads]);

  const handleBulkCloseConfirm = useCallback(async () => {
    if (onBulkClose && selectedThreads.size > 0) {
      try {
        await onBulkClose(Array.from(selectedThreads));
        setSelectedThreads(new Set());
        setIsSelectMode(false);
        setShowBulkConfirm(false);
      } catch (error) {
        console.error('Bulk close failed:', error);
      }
    }
  }, [onBulkClose, selectedThreads]);

  // Additional optimized handlers
  const handleSearchTermChange = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  const handleThreadClick = useCallback((thread) => {
    if (!isSelectMode && onThreadSelect) {
      onThreadSelect(thread);
    }
  }, [isSelectMode, onThreadSelect]);

  const openThreads = filteredThreads.filter(thread => thread.status === 'open');
  const allOpenSelected = openThreads.length > 0 && openThreads.every(thread => selectedThreads.has(thread.id));
  const someSelected = selectedThreads.size > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 rounded-lg border-b border-primary-200">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handleSelectModeToggle}
            className="px-3 py-1 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-md hover:bg-primary-50 transition-colors"
          >
            {isSelectMode ? 'Cancel' : 'Select'}
          </button>
          {isSelectMode && (
          <div>
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allOpenSelected}
                  onChange={handleSelectAllToggle}
                  className="px-3 py-1 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-md hover:bg-primary-50 transition-colors"
                />
                <span className="text-sm text-primary-700">
                  All ({openThreads.length} thread)
                </span>
              </label>

            </div>
          </div>
        )}
        </div>

        {/* Bulk selection controls */}
        

        {/* Bulk action toolbar */}
        {someSelected && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                {selectedThreads.size}  selected
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowBulkConfirm(true)}
                  className="px-3 py-1 text-[10px] font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Close All Selected
                </button>
                <button
                  onClick={() => setSelectedThreads(new Set())}
                  className="px-3 py-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={handleSearchTermChange}
            className="w-full pl-9 pr-3 py-2 border border-primary-300 rounded-md text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All', count: threadCounts.all },
            { key: 'unread', label: 'Unread', count: threadCounts.unread },
            { key: 'unlinked', label: 'Unlinked', count: threadCounts.unlinked },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-primary-600 hover:text-primary-900 hover:bg-primary-100'
              }`}
            >
              {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">


        {!loading && filteredThreads.length === 0 && (
                  <div className="p-4 text-center text-primary-500">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 text-primary-300" />
                    <p className="text-sm">No conversations found</p>
                    {searchTerm && (
                      <button
                        onClick={handleClearSearch}
                        className="text-primary-600 hover:text-primary-800 text-xs mt-1"
                      >
                        Clear search
                      </button>
                    )}
                  </div>
                )}

                {!loading && filteredThreads.map((thread) => (
          <div
            key={thread.id}
            onClick={() => handleThreadClick(thread)}
            className={`rounded-lg border border-primary-200 cursor-pointer hover:bg-primary-50 transition-colors
              ${selectedThread?.id === thread.id ? 'bg-primary-50 border-primary-500' : ''}
              ${isSelectMode ? 'pl-2' : ''}`}
          >
            <div className={`grid gap-x-2 h-[72px] px-3 py-2 ${
              isSelectMode ? 'grid-cols-[auto_1fr_auto] grid-rows-2' : 'grid-cols-[1fr_auto] grid-rows-2'
            }`}>
              {/* Checkbox column (only in select mode) */}
              {isSelectMode && (
                <div className="row-span-2 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedThreads.has(thread.id)}
                    onChange={(e) => handleThreadSelectionToggle(thread.id, e)}
                    disabled={thread.status === 'closed'}
                    className="w-4 h-4 text-primary-600 border-primary-300 rounded focus:ring-primary-500 disabled:opacity-50"
                  />
                </div>
              )}

              {/* Row 1: Subject (left) + Time (right) */}
              <div className="min-w-0 self-center">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-primary-900 truncate">
                    {thread.subject || 'No subject'}
                  </p>
                  {/* Unlinked thread indicator */}
                  {thread.needs_linking && (
                    <AlertTriangle className="w-3 h-3 text-orange-500 flex-shrink-0" title="Needs Manual Linking" />
                  )}
                  {/* Group booking indicators */}
                  {thread.reservations?.is_group_master && (
                    <Crown className="w-3 h-3 text-purple-600 flex-shrink-0" title="Group Master" />
                  )}
                  {(thread.reservations?.is_group_master || thread.reservations?.booking_group_master_id) && (
                    <Users className="w-3 h-3 text-purple-600 flex-shrink-0" 
                           title={`Group Booking${thread.reservations?.group_room_count ? ` (${thread.reservations.group_room_count} rooms)` : ''}`} />
                  )}

                </div>
              </div>
              <span className="text-xs text-primary-500 self-center">
                {formatTimestamp(thread.last_message_at)}
              </span>

              {/* Row 2: Preview (left) + Unread badge (right) */}
              <div className="min-w-0 self-center">
                <p className="text-xs text-primary-600 truncate">
                  {thread.last_message_preview || 'No messages yet'}
                </p>
              </div>
              <div className="self-center justify-self-end">
                {thread.unread_count > 0 && (
                  <span className="bg-primary-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center inline-block">
                    {thread.unread_count > 99 ? '99+' : thread.unread_count}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bulk Close Confirmation Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Close Selected Conversations
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to close {selectedThreads.size} selected conversation{selectedThreads.size > 1 ? 's' : ''}? 
                      This action cannot be undone and closed conversations will no longer appear in your active inbox.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleBulkCloseConfirm}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close {selectedThreads.size} Conversation{selectedThreads.size > 1 ? 's' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkConfirm(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
