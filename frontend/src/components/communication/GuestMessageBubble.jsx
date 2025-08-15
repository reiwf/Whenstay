import React, { useRef, useEffect } from 'react';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';

// Channel icons mapping
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

// Component to parse and render message content with HTML support
function MessageContent({ content }) {
  if (!content) return null;

  // Check if content contains HTML (specifically image tags)
  const hasHTML = /<[^>]*>/.test(content);
  
  if (!hasHTML) {
    return <span>{content}</span>;
  }

  // Extract and render HTML images
  const renderHTMLContent = () => {
    // Parse the HTML to extract images and text
    const parts = [];
    let currentIndex = 0;
    
    // Find all img tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    
    while ((match = imgRegex.exec(content)) !== null) {
      // Add text before image
      if (match.index > currentIndex) {
        const textBefore = content.substring(currentIndex, match.index);
        const cleanText = textBefore.replace(/<[^>]*>/g, '').trim();
        if (cleanText) {
          parts.push(
            <span key={`text-${currentIndex}`} className="block mb-2">
              {cleanText}
            </span>
          );
        }
      }
      
      // Add the image
      const imgSrc = match[1];
      
      // Extract height from style attribute if present
      const styleMatch = match[0].match(/style=["']([^"']*)["']/);
      let imageHeight = '200px'; // default
      if (styleMatch) {
        const heightMatch = styleMatch[1].match(/height:\s*(\d+)px/);
        if (heightMatch) {
          imageHeight = `${Math.min(parseInt(heightMatch[1]), 300)}px`; // cap at 300px
        }
      }
      
      parts.push(
        <div key={`img-${match.index}`} className="my-2">
          <img
            src={imgSrc}
            alt="Shared image"
            className="rounded-lg shadow-sm max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity block"
            style={{ 
              maxHeight: imageHeight,
              objectFit: 'cover'
            }}
            onClick={() => window.open(imgSrc, '_blank')}
            onError={(e) => {
              // Fallback to showing the URL if image fails to load
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = `
                <div class="text-xs p-2 rounded border bg-gray-100 border-gray-200">
                  🖼️ Image: ${imgSrc.split('/').pop() || 'Unable to load'}
                </div>
              `;
            }}
          />
        </div>
      );
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text after last image
    if (currentIndex < content.length) {
      const textAfter = content.substring(currentIndex);
      const cleanText = textAfter.replace(/<[^>]*>/g, '').trim();
      if (cleanText) {
        parts.push(
          <span key={`text-${currentIndex}`} className="block">
            {cleanText}
          </span>
        );
      }
    }
    
    return parts.length > 0 ? parts : <span>{content.replace(/<[^>]*>/g, '')}</span>;
  };

  return <div>{renderHTMLContent()}</div>;
}

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
    <div className={`flex flex-col ${isFromGuest ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
      {/* Timestamp - only show when showTimestamp is true */}
      {showTimestamp && (
        <div className={`text-xs text-primary-500 mb-1 ${isFromGuest ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
          {formatTime24Hour(message.created_at)}
        </div>
      )}

      {/* Message bubble container */}
      <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromGuest ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Message bubble with status indicator */}
        <div className="relative">
          <div 
            ref={messageRef}
            className={`
              px-3 py-2 sm:px-4 sm:py-2 rounded-2xl shadow-sm relative w-full
              ${isFromGuest
                ? 'bg-primary-200 text-primary-900 rounded-br-md border border-primary-300'
                : 'bg-white border border-primary-200 text-primary-900 rounded-bl-md'
              }
            `}
          >
            <div className="text-sm whitespace-pre-wrap break-words overflow-hidden" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
              <MessageContent content={message.content} />
            </div>

            {/* Attachments */}
            {message.message_attachments && message.message_attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.message_attachments.map((attachment, index) => {
                  const isImage = attachment.content_type?.startsWith('image/');
                  
                  if (isImage) {
                    return (
                      <div key={index} className="max-w-xs">
                        <img
                          src={attachment.path}
                          alt={attachment.path.split('/').pop()}
                          className="rounded-lg shadow-sm max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ 
                            maxHeight: '200px',
                            objectFit: 'cover'
                          }}
                          onClick={() => window.open(attachment.path, '_blank')}
                          onError={(e) => {
                            // Fallback to file link if image fails to load
                            e.target.style.display = 'none';
                            e.target.parentNode.innerHTML = `
                              <div class="text-xs p-2 rounded border ${
                                isFromGuest 
                                  ? 'bg-primary-500 border-primary-400' 
                                  : 'bg-gray-100 border-gray-200'
                              }">
                                📎 ${attachment.path.split('/').pop()}
                                ${attachment.size_bytes ? `(${(attachment.size_bytes / 1024).toFixed(1)}KB)` : ''}
                              </div>
                            `;
                          }}
                        />
                        {/* Image caption with filename and size */}
                        <div className="text-xs text-gray-500 mt-1 text-center">
                          {attachment.path.split('/').pop()}
                          {attachment.size_bytes && (
                            <span className="ml-1">
                              ({(attachment.size_bytes / 1024).toFixed(1)}KB)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    // Non-image attachments - show as file link
                    return (
                      <div
                        key={index}
                        className={`text-xs p-2 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                          isFromGuest 
                            ? 'bg-primary-500 border-primary-400' 
                            : 'bg-gray-100 border-gray-200'
                        }`}
                        onClick={() => window.open(attachment.path, '_blank')}
                      >
                        📎 {attachment.path.split('/').pop()}
                        {attachment.size_bytes && (
                          <span className="ml-1">
                            ({(attachment.size_bytes / 1024).toFixed(1)}KB)
                          </span>
                        )}
                      </div>
                    );
                  }
                })}
              </div>
            )}

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
