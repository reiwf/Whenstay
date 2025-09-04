import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../../services/api';
import GlassCard from '../shared/GlassCard';
import StatusChip from '../shared/StatusChip';
import TimezoneDisplay from '../shared/TimezoneDisplay';

const channelIcons = {
  inapp: '💬',
  email: '📧',
  sms: '📱',
  whatsapp: '📞'
};

export default function MessageActivityTab({ reservationId, threadId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (threadId) {
      loadMessageActivity();
    }
  }, [threadId]);

  const loadMessageActivity = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getCommunicationMessages(threadId, {
        limit: 50,
        include_system: true
      });
      
      // Filter for system-generated messages from automation
      const systemMessages = (response.data.messages || []).filter(
        message => message.origin_role === 'system' || message.created_by?.includes('system')
      );
      
      setMessages(systemMessages);
      setError(null);
    } catch (err) {
      console.error('Error loading message activity:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getMessageSource = (message) => {
    if (message.created_by?.includes('system-immediate')) {
      return { type: 'immediate', label: 'Rule A (Immediate)', color: 'bg-green-100 text-green-800' };
    }
    if (message.created_by?.includes('system-scheduler')) {
      return { type: 'scheduled', label: 'Scheduled Rule', color: 'bg-blue-100 text-blue-800' };
    }
    if (message.origin_role === 'system') {
      return { type: 'system', label: 'System Generated', color: 'bg-purple-100 text-purple-800' };
    }
    return { type: 'unknown', label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  };

  const getChannelIcon = (channel) => {
    return channelIcons[channel] || '💬';
  };

  const truncateContent = (content, maxLength = 150) => {
    if (!content) return 'No content';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!threadId) {
    return (
      <div className="p-6 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">No message thread found for this reservation</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2m-2 2l2 2M4 13l2-2m-2 2l2 2" />
          </svg>
          <h4 className="text-sm font-medium text-gray-900 mb-2">No automated messages sent</h4>
          <p className="text-xs text-gray-500">
            System-generated messages will appear here once automation rules are triggered
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Message Activity</h4>
            <div className="text-sm text-gray-500">
              {messages.length} automated message{messages.length !== 1 ? 's' : ''} sent
            </div>
          </div>

          <div className="space-y-3">
            {messages.map((message) => {
              const source = getMessageSource(message);
              
              return (
                <div
                  key={message.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {/* Channel Icon */}
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-lg">
                        {getChannelIcon(message.channel)}
                      </span>
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${source.color}`}>
                              {source.label}
                            </span>
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                              {message.channel}
                            </span>
                          </div>
                          
                          <TimezoneDisplay 
                            datetime={message.created_at}
                            format="med"
                          />
                        </div>

                        <StatusChip status="sent" />
                      </div>

                      {/* Message Preview */}
                      <div className="text-sm text-gray-700 mb-2">
                        {truncateContent(message.content)}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Message ID: {message.id}</span>
                        {message.template_id && (
                          <span>Template: {message.template_id}</span>
                        )}
                        {message.rule_id && (
                          <span>Rule: {message.rule_id}</span>
                        )}
                      </div>

                      {/* Read Status */}
                      {message.read_at && (
                        <div className="mt-2 text-xs text-green-600">
                          ✓ Read at {new Date(message.read_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {messages.length >= 50 && (
            <div className="text-center pt-4">
              <button
                onClick={loadMessageActivity}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Load More Messages
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
