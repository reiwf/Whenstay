import React, { useRef, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

// Channel icons mapping
const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢', 
  inapp: '💬',
  email: '✉️',
  sms: '📱'
};

export default function GuestMessageBubble({ message, showTimestamp = false, onMarkAsRead }) {
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
      return { status: 'pending', icon: Clock, color: 'text-primary-400' };
    }

    const delivery = message.message_deliveries[0];
    
    if (delivery.error_message) {
      return { status: 'failed', icon: AlertCircle, color: 'text-red-500' };
    }
    
    if (delivery.read_at) {
      return { status: 'read', icon: CheckCircle, color: 'text-leaf-600' };
    }
    
    if (delivery.delivered_at) {
      return { status: 'delivered', icon: CheckCircle, color: 'text-leaf-500' };
    }
    
    if (delivery.sent_at) {
      return { status: 'sent', icon: CheckCircle, color: 'text-primary-500' };
    }
    
    if (delivery.status === 'sending') {
      return { status: 'sending', icon: Clock, color: 'text-blue-500' };
    }
    
    return { status: 'pending', icon: Clock, color: 'text-primary-400' };
  };

  const deliveryStatus = getDeliveryStatus();
  const StatusIcon = deliveryStatus.icon;

  return (
    <div className={`flex flex-col ${isFromGuest ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-4' : 'mt-1'}`}>
      {/* Timestamp - only show when showTimestamp is true */}
      {showTimestamp && (
        <div className={`text-xs text-primary-500 mb-1 ${isFromGuest ? 'mr-2' : 'ml-2'}`}>
          {formatTime24Hour(message.created_at)}
        </div>
      )}

      {/* Message bubble container */}
      <div className={`max-w-xs lg:max-w-md ${isFromGuest ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Message bubble with status indicator */}
        <div className="relative">
          <div 
            ref={messageRef}
            className={`
              inline-block px-4 py-2 rounded-2xl shadow-sm relative
              ${isFromGuest
                ? 'bg-primary-600 text-white rounded-br-md'
                : 'bg-white border border-primary-200 text-primary-900 rounded-bl-md'
              }
            `}
          >
            <p className="text-sm whitespace-pre-wrap break-words">
              {message.content}
            </p>

          </div>
        </div>

        {/* Delivery status text under the bubble - only show for guest sent messages */}
        {isFromGuest && (
          <div className="flex justify-center">
            <div className={`text-[0.625rem] ${deliveryStatus.color} opacity-75`}>
              {deliveryStatus.status}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
