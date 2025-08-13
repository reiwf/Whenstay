import React, { useState } from 'react';
import { Search, MessageCircle, Clock } from 'lucide-react';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱'
};

export default function InboxPanel({ threads, selectedThread, onThreadSelect, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, archived

  const filteredThreads = threads
    .filter(thread => {
      const matchesSearch = !searchTerm || 
        thread.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        thread.last_message_preview?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesFilter = filter === 'all' || 
        (filter === 'unread' && thread.unread_count > 0) ||
        (filter === 'archived' && thread.status === 'archived');

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort by last_message_at in descending order (most recent first)
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Conversations</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All', count: threads.length },
            { key: 'unread', label: 'Unread', count: threads.filter(t => t.unread_count > 0).length },
            { key: 'archived', label: 'Archived', count: threads.filter(t => t.status === 'archived').length }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === key
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {label} {count > 0 && `(${count})`}
            </button>
          ))}
        </div>
      </div>

      {/* Thread List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-gray-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            Loading conversations...
          </div>
        )}

        {!loading && filteredThreads.length === 0 && (
          <div className="p-4 text-center text-gray-500">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No conversations found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-blue-600 hover:text-blue-800 text-xs mt-1"
              >
                Clear search
              </button>
            )}
          </div>
        )}

        {!loading && filteredThreads.map((thread) => (
          <div
            key={thread.id}
            onClick={() => onThreadSelect(thread)}
            className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedThread?.id === thread.id
                ? 'bg-blue-50 border-l-4 border-l-blue-500'
                : ''
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {thread.subject || 'No subject'}
                </h3>
                <div className="flex items-center mt-1">
                  {/* Channel indicators */}
                  <div className="flex space-x-1 mr-2">
                    {getThreadChannels(thread).slice(0, 3).map((channel, idx) => (
                      <span key={idx} className="text-xs" title={channel}>
                        {CHANNEL_ICONS[channel] || '📱'}
                      </span>
                    ))}
                    {getThreadChannels(thread).length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{getThreadChannels(thread).length - 3}
                      </span>
                    )}
                  </div>
                  
                  {/* Status indicators */}
                  {thread.status === 'archived' && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end ml-2">
                <span className="text-xs text-gray-500">
                  {formatTimestamp(thread.last_message_at)}
                </span>
                {thread.unread_count > 0 && (
                  <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-0.5 mt-1 min-w-[20px] text-center">
                    {thread.unread_count > 99 ? '99+' : thread.unread_count}
                  </span>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
              {thread.last_message_preview || 'No messages yet'}
            </p>

            {/* Additional metadata */}
            {thread.reservation_id && (
              <div className="flex items-center mt-2 text-xs text-gray-500">
                <Clock className="w-3 h-3 mr-1" />
                Reservation #{thread.reservation_id.slice(0, 8)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
