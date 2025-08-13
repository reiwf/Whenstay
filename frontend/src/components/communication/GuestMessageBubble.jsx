import React, { useRef, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

export default function GuestMessageBubble({ message, isConsecutive = false, onMarkAsRead }) {
  const messageRef = useRef(null);
  const isFromGuest = message.origin_role === 'guest';
  const isFromAdmin = message.origin_role === 'host' || message.origin_role === 'admin';

  // Setup intersection observer to track when admin messages become visible
  useEffect(() => {
    if (!messageRef.current || !onMarkAsRead || !isFromAdmin) return;
    
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
  }, [message.id, message.message_deliveries, isFromAdmin, onMarkAsRead]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getDeliveryStatus = () => {
    if (!message.message_deliveries || message.message_deliveries.length === 0) {
      return { status: 'pending', icon: Clock, color: 'text-gray-400' };
    }

    const delivery = message.message_deliveries[0];
    
    if (delivery.error_message) {
      return { status: 'failed', icon: AlertCircle, color: 'text-red-500' };
    }
    
    if (delivery.read_at) {
      return { status: 'read', icon: CheckCircle, color: 'text-blue-500' };
    }
    
    if (delivery.delivered_at) {
      return { status: 'delivered', icon: CheckCircle, color: 'text-green-500' };
    }
    
    if (delivery.sent_at) {
      return { status: 'sent', icon: CheckCircle, color: 'text-gray-500' };
    }
    
    return { status: 'pending', icon: Clock, color: 'text-gray-400' };
  };

  const deliveryStatus = getDeliveryStatus();
  const StatusIcon = deliveryStatus.icon;

  return (
    <div className={`flex ${isFromGuest ? 'justify-end' : 'justify-start'} ${isConsecutive ? 'mt-1' : 'mt-4'}`}>
      <div className={`max-w-xs lg:max-w-md ${isFromGuest ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div 
          ref={messageRef}
          className={`
            inline-block px-4 py-2 rounded-2xl shadow-sm
            ${isFromGuest
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
            }
            ${!isConsecutive && isFromGuest ? 'rounded-br-md' : ''}
            ${!isConsecutive && !isFromGuest ? 'rounded-bl-md' : ''}
          `}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Timestamp and status */}
        <div className={`flex items-center mt-1 space-x-1 ${isFromGuest ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-500">
            {formatTime(message.created_at)}
          </span>
          
          {/* Show delivery status only for guest messages */}
          {isFromGuest && (
            <StatusIcon className={`w-3 h-3 ${deliveryStatus.color}`} />
          )}
        </div>

        {/* Sender label for consecutive messages from different roles */}
        {!isConsecutive && (
          <div className={`text-xs text-gray-500 mt-1 ${isFromGuest ? 'text-right' : 'text-left'}`}>
            {isFromGuest ? 'You' : isFromAdmin ? 'Support Team' : 'System'}
          </div>
        )}
      </div>
    </div>
  );
}
