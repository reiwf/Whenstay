import React, { useState } from 'react';
import { Search, MessageCircle, Clock } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';

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
        (filter === 'closed' && thread.status === 'closed');

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
      <div className="p-4 rounded-lg border-b border-primary-200">
        <h2 className="text-lg font-semibold text-primary-900 mb-3">Conversations</h2>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-primary-300 rounded-md text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex space-x-1">
          {[
            { key: 'all', label: 'All', count: threads.length },
            { key: 'unread', label: 'Unread', count: threads.filter(t => t.unread_count > 0).length },
            { key: 'closed', label: 'Closed', count: threads.filter(t => t.status === 'closed').length }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
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
        {loading && (
          <div className="p-4 text-center text-primary-500">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto mb-2"></div>
            Loading conversations...
          </div>
        )}

        {!loading && filteredThreads.length === 0 && (
                  <div className="p-4 text-center text-primary-500">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 text-primary-300" />
                    <p className="text-sm">No conversations found</p>
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
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
            onClick={() => onThreadSelect(thread)}
            className={`rounded-lg border border-primary-200 cursor-pointer hover:bg-primary-50 transition-colors
              ${selectedThread?.id === thread.id ? 'bg-primary-50 border-primary-500' : ''}`}
          >
            <div className="grid grid-cols-[1fr_auto] grid-rows-2 gap-x-2 h-[72px] px-3 py-2">
              {/* Row 1: Subject (left) + Time (right) */}
              <div className="min-w-0 self-center">
                <p className="text-sm font-medium text-primary-900 truncate">
                  {thread.subject || 'No subject'}
                </p>
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
    </div>
  );
}
