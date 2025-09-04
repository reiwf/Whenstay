import React, { useState, useEffect } from 'react';
import { messageRulesAPI } from '../../../services/api';
import GlassCard from '../shared/GlassCard';
import StatusChip from '../shared/StatusChip';
import TimezoneDisplay from '../shared/TimezoneDisplay';
import InlineActions from './InlineActions';

const channelIcons = {
  inapp: '💬',
  email: '📧',
  sms: '📱',
  whatsapp: '📞'
};

export default function ScheduledMessagesPanel({ reservationId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (reservationId) {
      loadScheduledMessages();
    }
  }, [reservationId]);

  const loadScheduledMessages = async () => {
    try {
      setLoading(true);
      const response = await messageRulesAPI.getScheduledMessagesForReservation(reservationId);
      setMessages(response.data.scheduled_messages || []);
      setError(null);
    } catch (err) {
      console.error('Error loading scheduled messages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMessageAction = async (action, messageId = null) => {
    try {
      switch (action) {
        case 'regenerate':
          await messageRulesAPI.generateMessagesForReservation(reservationId, {
            cancel_existing: true
          });
          break;
        case 'cancel_all':
          await messageRulesAPI.cancelMessagesForReservation(reservationId);
          break;
        case 'preview':
          // This would open a preview modal
          console.log('Preview for reservation:', reservationId);
          break;
        case 'cancel_single':
          // This would cancel a single message
          console.log('Cancel message:', messageId);
          break;
      }
      
      // Reload messages after action
      await loadScheduledMessages();
    } catch (err) {
      console.error('Error performing action:', err);
      setError(err.message);
    }
  };

  const groupMessagesByRule = () => {
    const grouped = {};
    messages.forEach(message => {
      const ruleCode = message.message_rules?.code || 'Unknown';
      if (!grouped[ruleCode]) {
        grouped[ruleCode] = [];
      }
      grouped[ruleCode].push(message);
    });
    return grouped;
  };

  const groupedMessages = groupMessagesByRule();

  if (loading) {
    return (
      <GlassCard className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Scheduled Messages</h3>
          <p className="text-sm text-gray-600 mt-1">
            Timeline of automated messages for this reservation
          </p>
        </div>
        
        <InlineActions
          reservationId={reservationId}
          messageCount={messages.length}
          onAction={handleMessageAction}
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {Object.keys(groupedMessages).length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m16 0l-2-2m-2 2l2 2M4 13l2-2m-2 2l2 2" />
          </svg>
          <h4 className="text-sm font-medium text-gray-900 mb-2">No scheduled messages</h4>
          <p className="text-xs text-gray-500 mb-4">
            Messages will appear here when automation rules are triggered
          </p>
          <button
            onClick={() => handleMessageAction('regenerate')}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Generate Messages
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedMessages).map(([ruleCode, ruleMessages]) => (
            <div key={ruleCode} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-blue-600">{ruleCode}</span>
                  <span className="text-sm text-gray-700">
                    {ruleMessages[0]?.message_rules?.name || 'Unknown Rule'}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({ruleMessages.length} message{ruleMessages.length !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>
              
              <div className="divide-y divide-gray-200">
                {ruleMessages.map((message) => (
                  <div key={message.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Channel & Template */}
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {channelIcons[message.message_templates?.channel] || '💬'}
                          </span>
                          <div>
                            <div className="font-medium text-gray-900 text-sm">
                              {message.message_templates?.name || 'Unknown Template'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {message.message_templates?.channel}
                            </div>
                          </div>
                        </div>

                        {/* Timing */}
                        <div className="text-sm">
                          <TimezoneDisplay 
                            datetime={message.run_at}
                            format="short"
                          />
                          <div className="text-xs text-gray-500">
                            {new Date(message.run_at) > new Date() ? 'Upcoming' : 'Past'}
                          </div>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-3">
                        <StatusChip status={message.status} />
                        
                        {message.status === 'pending' && (
                          <button
                            onClick={() => handleMessageAction('cancel_single', message.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Cancel this message"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Error Info */}
                    {message.last_error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        <span className="font-medium">Error:</span> {message.last_error}
                      </div>
                    )}

                    {/* Attempts */}
                    {message.attempts > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        Attempts: {message.attempts}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
