import React, { useRef, useEffect } from 'react';
import { Check, CheckCheck, AlertCircle, Clock, Bot, User } from 'lucide-react';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱'
};

const ROLE_COLORS = {
  guest: 'text-primary-600',
  host: 'text-green-600',
  assistant: 'text-purple-600',
  system: 'text-gray-600'
};

export default function MessageBubble({ message, isConsecutive = false, onMarkAsRead }) {
  const messageRef = useRef(null);
  const isIncoming = message.direction === 'incoming';
  const isOutgoing = message.direction === 'outgoing';
  const isFromGuest = message.origin_role === 'guest';
  const isFromHost = message.origin_role === 'host' || message.origin_role === 'admin';

  // Setup intersection observer to track when message becomes visible
  useEffect(() => {
    if (!messageRef.current || !onMarkAsRead || !isIncoming) return;
    
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
                onMarkAsRead(message.id);
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
  }, [message.id, message.message_deliveries, isIncoming, onMarkAsRead]);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getDeliveryStatus = () => {
    if (!message.message_deliveries || message.message_deliveries.length === 0) {
      return 'queued';
    }
    return message.message_deliveries[0].status;
  };

  const renderDeliveryIcon = () => {
    if (isIncoming) return null;

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

  const getRoleIcon = () => {
    switch (message.origin_role) {
      case 'guest':
        return <User className="w-3 h-3" />;
      case 'assistant':
        return <Bot className="w-3 h-3" />;
      default:
        return null;
    }
  };

  return (
    <div ref={messageRef} className={`flex ${isFromHost ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%]`}>
        {/* Message header (role/channel info) */}
        {!isConsecutive && (
          <div className={`flex items-center mb-1 text-xs text-gray-500 ${
            isFromHost ? 'justify-end' : 'justify-start'
          }`}>
            <div className="flex items-center space-x-1">
              {/* Channel icon */}
              <span title={message.channel}>
                {CHANNEL_ICONS[message.channel] || '📱'}
              </span>
              
              {/* Role */}
              <span className={`font-medium ${ROLE_COLORS[message.origin_role]}`}>
                {message.origin_role}
              </span>
              
              {/* Role icon */}
              {getRoleIcon()}
              
              {/* Timestamp */}
              <span className="ml-2">
                {formatTimestamp(message.created_at)}
              </span>
            </div>
          </div>
        )}

        {/* Message bubble */}
        <div className={`rounded-2xl px-4 py-2 shadow-sm border text-sm ${
          isFromHost
            ? 'bg-primary-600 text-white border-primary-600'
            : message.origin_role === 'assistant'
            ? 'bg-purple-50 text-purple-900 border-purple-200'
            : message.origin_role === 'system'
            ? 'bg-gray-50 text-gray-800 border-gray-200'
            : 'bg-white text-gray-900 border-gray-200'
        } ${
          isConsecutive 
            ? isFromHost
              ? 'rounded-tr-md'
              : 'rounded-tl-md'
            : ''
        }`}>
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

          {/* Message footer with delivery status */}
          <div className={`flex items-center justify-between mt-1 text-xs ${
            isFromHost ? 'text-primary-200' : 'text-gray-500'
          }`}>
            <div className="flex items-center space-x-1">
              {/* Delivery status for host messages */}
              {isFromHost && (
                <div className="flex items-center space-x-1">
                  {renderDeliveryIcon()}
                  <span className="capitalize">{getDeliveryStatus()}</span>
                </div>
              )}
            </div>
            
            {/* Consecutive message timestamp */}
            {isConsecutive && (
              <span className="opacity-75">
                {formatTimestamp(message.created_at)}
              </span>
            )}
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
