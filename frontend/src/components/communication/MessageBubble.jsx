import React, { useRef, useEffect } from 'react';
import { Check, CheckCheck, AlertCircle, Clock, RotateCw } from 'lucide-react';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱'
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

export default function MessageBubble({ message, showTimestamp = false, onMarkAsRead }) {
  const messageRef = useRef(null);
  const isIncoming = message.direction === 'incoming';
  const isFromGuest = message.origin_role === 'guest';
  const isFromHost = message.origin_role === 'host' || message.origin_role === 'admin';

  // Setup intersection observer to track when guest messages become visible to admin
  useEffect(() => {
    // For host viewing guest messages: we want to mark guest messages as read regardless of direction
    // The key is that the message is FROM a guest (origin_role = 'guest') and being viewed by admin
    const shouldTrackAsRead = isFromGuest;

    if (!messageRef.current || !onMarkAsRead || !shouldTrackAsRead) {
      return;
    }
    
    const currentStatus = message.message_deliveries?.[0]?.status;
    if (currentStatus === 'read') {
      return; // Already read
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Message is visible for more than 50% of its area
            setTimeout(() => {
              // Check if still visible and not already read
              const currentEntry = observer.takeRecords()[0] || entry;
              const currentStatus = message.message_deliveries?.[0]?.status;
              
              if (currentEntry.isIntersecting && currentStatus !== 'read') {
                onMarkAsRead(message.id, 'inapp');
                
                // Disconnect observer after marking as read to prevent repeated calls
                observer.disconnect();
              } else if (currentStatus === 'read') {
                observer.disconnect();
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
  }, [message.id, isFromGuest, onMarkAsRead]);

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
        return <RotateCw className="w-3 h-3 text-gray-400" />;
      case 'delivered':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-primary-500" />;
      case 'failed':
        return <AlertCircle className="w-3 h-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col ${isFromHost ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
      {/* Timestamp - only show when showTimestamp is true */}
      {showTimestamp && (
        <div className={`text-xs text-gray-500 mb-1 ${isFromHost ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
          {formatTime24Hour(message.created_at)}
        </div>
      )}

      {/* Message bubble container */}
      <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromHost ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Message bubble with status indicator */}
        <div className="relative">
          <div 
            ref={messageRef}
            className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2 shadow-sm border text-sm relative w-full ${
              isFromHost
                ? 'bg-primary-200 text-primary-900 border-primary-300 rounded-br-md'
                : message.origin_role === 'assistant'
                ? 'bg-purple-50 text-purple-900 border-purple-200 rounded-bl-md'
                : message.origin_role === 'system'
                ? 'bg-gray-50 text-gray-800 border-gray-200 rounded-bl-md'
                : 'bg-white text-gray-900 border-gray-200 rounded-bl-md'
            }`}
          >
            {/* Message content */}
            <div className="whitespace-pre-wrap leading-relaxed break-words overflow-hidden" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
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
                                isFromHost 
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
                          isFromHost 
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

       <div className="mt-2 flex items-center justify-center space-x-1 text-xs opacity-70">
          <span title={`Channel: ${message.channel}`}>
            {CHANNEL_ICONS[message.channel] || '📱'}
          </span>

          {/* Separator */}
          {!isIncoming && <span className="opacity-40">•</span>}

          {/* Delivery status */}
          {!isIncoming && renderDeliveryIcon()}
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
