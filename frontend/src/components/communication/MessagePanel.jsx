import React, { useState, useRef, useEffect } from 'react';
import { Send, Calendar, Archive, X, ChevronDown, Clock } from 'lucide-react';
import MessageBubble from './MessageBubble';
import ChannelSelector from './ChannelSelector';
import ScheduleModal from './ScheduleModal';

export default function MessagePanel({
  thread,
  messages,
  selectedChannel,
  onChannelChange,
  onSendMessage,
  onThreadAction,
  onMarkAsRead,
  loading
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || sending || !thread) return;

    setSending(true);
    try {
      await onSendMessage(draft.trim(), selectedChannel);
      setDraft('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getAvailableChannels = () => {
    if (!thread?.thread_channels) return ['inapp'];
    const channels = thread.thread_channels.map(tc => tc.channel);
    return ['inapp', ...channels];
  };

  const formatThreadSubject = () => {
    if (!thread) return 'Select a conversation';
    return thread.subject || 'Conversation';
  };

  if (!thread) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
          <p className="text-gray-600">Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {formatThreadSubject()}
            </h1>
            <div className="flex items-center mt-1 space-x-4">
              <span className="text-sm text-gray-500">
                Thread ID: {thread.id.slice(0, 8)}
              </span>
              {thread.reservation_id && (
                <span className="text-sm text-gray-500">
                  Reservation: #{thread.reservation_id.slice(0, 8)}
                </span>
              )}
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

          <div className="flex items-center space-x-2">
            <ChannelSelector
              availableChannels={getAvailableChannels()}
              selectedChannel={selectedChannel}
              onChannelChange={onChannelChange}
            />
            
            <button
              onClick={() => setShowScheduleModal(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </button>

            <div className="relative">
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                More
                <ChevronDown className="w-4 h-4 ml-2" />
              </button>
              {/* Dropdown menu would go here */}
            </div>

            <button
              onClick={() => onThreadAction('archive', thread.id)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </button>

            <button
              onClick={() => onThreadAction('close', thread.id)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
        {loading && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading messages...</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
            <p className="text-gray-600">Start the conversation by sending a message below</p>
          </div>
        )}

        <div className="space-y-1">
          {messages.map((message, index) => {
            // Helper function to format timestamp as HH:MM
            const formatTimeKey = (timestamp) => {
              const date = new Date(timestamp);
              return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            };

            // Determine if we should show timestamp for this message
            const showTimestamp = index === 0 || 
              formatTimeKey(message.created_at) !== formatTimeKey(messages[index - 1].created_at);

            return (
              <MessageBubble
                key={`${message.id}-${index}`}
                message={message}
                showTimestamp={showTimestamp}
                onMarkAsRead={onMarkAsRead}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`Send a message via ${selectedChannel}...`}
              className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 max-h-32"
              rows="1"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span>{draft.length}/1000</span>
            </div>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending || draft.length > 1000}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send
          </button>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <ScheduleModal
          thread={thread}
          channel={selectedChannel}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={(data) => {
            console.log('Schedule message:', data);
            setShowScheduleModal(false);
          }}
        />
      )}
    </div>
  );
}
