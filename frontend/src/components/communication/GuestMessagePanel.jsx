import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, RefreshCw } from 'lucide-react';
import GuestMessageBubble from './GuestMessageBubble';
import useGuestCommunication from '../../hooks/useGuestCommunication';
import LoadingSpinner from '../LoadingSpinner';

export default function GuestMessagePanel({ token, guestName }) {
  const [draft, setDraft] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  const {
    loading,
    thread,
    messages,
    sending,
    connectionStatus,
    sendMessage,
    initialize,
    refresh,
    messageListRef
  } = useGuestCommunication(token);

  // Initialize communication on mount
  useEffect(() => {
    if (token) {
      initialize();
    }
  }, [token, initialize]);

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
    if (!draft.trim() || sending) return;

    const messageContent = draft.trim();
    setDraft(''); // Clear immediately for better UX

    try {
      await sendMessage(messageContent);
    } catch (error) {
      // If sending fails, restore the draft
      setDraft(messageContent);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRefresh = () => {
    refresh();
  };

  if (loading && !thread) {
    return (
      <div className="h-full flex items-center justify-center bg-blue-50">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="text-blue-600 mt-4">Setting up your support chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-blue-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-blue-900">Support Chat</h2>
              <div className="flex items-center space-x-2">
                <p className="text-xs text-blue-600">Get help from our team</p>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'SUBSCRIBED' ? 'bg-green-400' : 
                  connectionStatus === 'CONNECTING' ? 'bg-yellow-400' : 'bg-gray-400'
                }`} title={`Connection: ${connectionStatus}`}></div>
              </div>
            </div>
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && messages.length === 0 && (
          <div className="text-center py-8">
            <LoadingSpinner />
            <p className="text-blue-600 mt-2 text-sm">Loading messages...</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-blue-900 mb-2">
                Welcome to Support Chat!
              </h3>
              <p className="text-blue-600 text-sm max-w-sm mx-auto">
                Need help during your stay? Send us a message and our support team will get back to you quickly.
              </p>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isConsecutive = 
            index > 0 && 
            messages[index - 1].origin_role === message.origin_role &&
            new Date(message.created_at) - new Date(messages[index - 1].created_at) < 5 * 60 * 1000; // 5 minutes

          return (
            <GuestMessageBubble
              key={message.id}
              message={message}
              isConsecutive={isConsecutive}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <div className="bg-white border-t border-blue-200 p-4">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full resize-none border border-blue-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-h-32"
              rows="1"
              disabled={sending}
            />
            <div className="flex justify-between items-center mt-2 text-xs text-blue-500">
              <span>Press Enter to send, Shift+Enter for new line</span>
              <span className={draft.length > 800 ? 'text-red-500' : ''}>{draft.length}/1000</span>
            </div>
          </div>
          
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending || draft.length > 1000}
            className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
