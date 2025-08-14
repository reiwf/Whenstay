import React, { useRef, useEffect } from 'react';
import { Check, CheckCheck, AlertCircle, Clock } from 'lucide-react';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱'
};

export default function MessageBubble({ message, showTimestamp = false, onMarkAsRead }) {
  const messageRef = useRef(null);
  const isIncoming = message.direction === 'incoming';
  const isFromGuest = message.origin_role === 'guest';
  const isFromHost = message.origin_role === 'host' || message.origin_role === 'admin';

  // Setup intersection observer to track when guest messages become visible to admin
  useEffect(() => {
    if (!messageRef.current || !onMarkAsRead || !isFromGuest || !isIncoming) return;
    
    const currentStatus = message.message_deliveries?.[0]?.status;
    if (currentStatus === 'read') return; // Already read

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Message is visible for more than 50% of its area
            setTimeout(() => {
              // Check if still visible and call mark as read
              const currentEntry = observer.takeRecords()[0] || entry;
              if (currentEntry.isIntersecting) {
                onMarkAsRead(message.id, 'inapp');
              }
            }, 2000); // Wait 2 seconds before marking as read
          }
        });
      },
      {
        threshold: 0.5, // Trigger when 50% of message is visible
        rootMargin: '0px 0px -50px 0px' // Require message to be 50px into viewport
      }
    );

    observer.observe(messageRef.current);

    return () => {
      observer.disconnect();
    };
  }, [message.id, message.message_deliveries, isFromGuest, isIncoming, onMarkAsRead]);

  const formatTime24Hour = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const getDeliveryStatus = () => {
    if (!message.message_deliveries || message.message_deliveries.length === 0) {
      return 'queued';
    }
    return message.message_deliveries[0].status;
  };

  const renderDeliveryIcon = () => {
    const status = getDeliveryStatus();
    switch (status) {
      case 'queued':
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 'sent':
        return <Check className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-primary-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col ${isFromHost ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-4' : 'mt-1'}`}>
      {/* Timestamp - only show when showTimestamp is true */}
      {showTimestamp && (
        <div className={`text-xs text-gray-500 mb-1 ${isFromHost ? 'mr-2' : 'ml-2'}`}>
          {formatTime24Hour(message.created_at)}
        </div>
      )}

      {/* Message bubble container */}
      <div className={`max-w-[70%] ${isFromHost ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Message bubble with status indicator */}
        <div className="relative">
          <div 
            ref={messageRef}
            className={`rounded-2xl px-4 py-2 shadow-sm border text-sm relative ${
              isFromHost
                ? 'bg-primary-600 text-white border-primary-600 rounded-br-md'
                : message.origin_role === 'assistant'
                ? 'bg-purple-50 text-purple-900 border-purple-200 rounded-bl-md'
                : message.origin_role === 'system'
                ? 'bg-gray-50 text-gray-800 border-gray-200 rounded-bl-md'
                : 'bg-white text-gray-900 border-gray-200 rounded-bl-md'
            }`}
          >
            {/* Message content */}
            <div className="whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>

            {/* Attachments */}
            {message.message_attachments && message.message_attachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {message.message_attachments.map((attachment, index) => (
                  <div
                    key={index}
                    className={`text-xs p-2 rounded border ${
                      isFromHost 
                        ? 'bg-primary-500 border-primary-400' 
                        : 'bg-gray-100 border-gray-200'
                    }`}
                  >
                    📎 {attachment.path.split('/').pop()}
                    {attachment.size_bytes && (
                      <span className="ml-1">
                        ({(attachment.size_bytes / 1024).toFixed(1)}KB)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Delivery status for outgoing messages - positioned at bottom right of bubble */}
            {!isIncoming && (
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm">
                {renderDeliveryIcon()}
              </div>
            )}
          </div>
        </div>

        {/* Channel logo under the bubble */}
        <div className="mt-2 flex justify-center">
          <div className="text-sm opacity-60" title={`Channel: ${message.channel}`}>
            {CHANNEL_ICONS[message.channel] || '📱'}
          </div>
        </div>

        {/* Parent message reference (for replies) */}
        {message.parent_message_id && (
          <div className={`mt-1 text-xs text-gray-500 ${
            isFromHost ? 'text-right' : 'text-left'
          }`}>
            <span className="italic">Reply to previous message</span>
          </div>
        )}
      </div>
    </div>
  );
}
