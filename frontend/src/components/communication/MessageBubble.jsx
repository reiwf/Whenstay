import React, { useRef, useEffect, useState } from 'react';
import { Check, CheckCheck, AlertCircle, Clock, RotateCw, MoreHorizontal, Trash2 } from 'lucide-react';
import airbnbLogo from '../../../shared/airbnblogo.png';
import bookingLogo from '../../../shared/bookinglogo.png';
import { createPortal } from 'react-dom';

const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱',
  airbnb: airbnbLogo,
  'booking.com': bookingLogo
};

function getFileNameFromUrl(url) {
  try {
    const u = new URL(url); // strips ?query automatically
    const last = u.pathname.split('/').pop() || 'image';
    return decodeURIComponent(last);
  } catch {
    // non-http(s) or invalid
    const noQuery = url.split('?')[0];
    return decodeURIComponent(noQuery.split('/').pop() || 'image');
  }
}

const renderChannelIcon = (channel) => {
  const icon = CHANNEL_ICONS[channel];
  if (!icon) return '📱';
  
  if (channel === 'airbnb') {
    return <img src={icon} alt="Airbnb" className="w-4 h-4 inline" />;
  }
  
  if (channel === 'booking.com') {
    return <img src={icon} alt="Booking.com" className="w-4 h-4 inline" />;
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

  const parts = [];
  let currentIndex = 0;
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
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

    const imgSrc = match[1];
    const styleMatch = match[0].match(/style=["']([^"']*)["']/);
    let imageHeight = '200px';
    if (styleMatch) {
      const heightMatch = styleMatch[1].match(/height:\s*(\d+)px/);
      if (heightMatch) imageHeight = `${Math.min(parseInt(heightMatch[1]), 300)}px`;
    }

    parts.push(
      <div key={`img-${match.index}`} className="my-2">
        <img
          src={imgSrc}
          alt="Shared image"
          className="rounded-xl shadow-sm max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity block"
          style={{ maxHeight: imageHeight, objectFit: 'cover' }}
          onClick={() => window.open(imgSrc, '_blank')}
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentNode.innerHTML = `
              <div class="text-xs p-2 rounded bg-gray-100 border border-gray-200">
                🖼️ Image: ${imgSrc.split('/').pop() || 'Unable to load'}
              </div>
            `;
          }}
        />
      </div>
    );

    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < content.length) {
    const textAfter = content.substring(currentIndex);
    const cleanText = textAfter.replace(/<[^>]*>/g, '').trim();
    if (cleanText) parts.push(<span key={`text-${currentIndex}`} className="block">{cleanText}</span>);
  }
  return <div>{parts.length > 0 ? parts : <span>{content.replace(/<[^>]*>/g, '')}</span>}</div>;
}

// Helper function to detect if message is primarily an image
function isImageOnlyMessage(content) {
  if (!content) return false;
  
  // Check if content contains images
  const hasImages = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi.test(content);
  if (!hasImages) return false;
  
  // Remove all HTML tags and check remaining text
  const textOnly = content.replace(/<[^>]*>/g, '').trim();
  
  // Consider it image-only if there's no meaningful text (empty or just whitespace/minimal chars)
  return textOnly.length <= 10; // Allow for very short captions or empty
}

// Component to render large images without bubble
function LargeImageContent({ content, isFromHost }) {
  if (!content) return null;

  const parts = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = imgRegex.exec(content)) !== null) {
    const imgSrc = match[1];

    parts.push(
      <ImageWithFallback
        key={`img-${match.index}`}
        src={imgSrc}
        isFromHost={isFromHost}
      />
    );
  }

  return <div>{parts}</div>;
}

function ImageWithFallback({ src, isFromHost }) {
  const [failed, setFailed] = React.useState(false);
  const fileName = getFileNameFromUrl(src);

  if (failed) {
    return (
      <div
        className={`my-2 text-xs p-3 rounded-lg border ${
          isFromHost
            ? 'bg-primary-50 border-primary-200 text-primary-800'
            : 'bg-gray-50 border-gray-200 text-gray-800'
        } break-all`}
        style={{ overflowWrap: 'anywhere' }}
      >
        🖼️ Image: <span className="font-medium">{fileName}</span>
        <button
          className="ml-2 underline"
          onClick={() => window.open(src, '_blank')}
        >
          open link
        </button>
      </div>
    );
  }

  return (
    <div className="my-2">
      <img
        src={src}
        alt={fileName}
        className="rounded-2xl shadow-lg max-w-full h-auto cursor-pointer hover:opacity-95 transition-all duration-200 block"
        style={{ maxHeight: '400px', objectFit: 'cover' }}
        onClick={() => window.open(src, '_blank')}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function MessageBubble({ message, showTimestamp = false, onMarkAsRead, onUnsendMessage, currentUser }) {
  const wrapperRef = useRef(null)
  const [showMenu, setShowMenu] = useState(false);
  const [showUnsendConfirm, setShowUnsendConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const isIncoming = message.direction === 'incoming';
  const isFromGuest = message.origin_role === 'guest';
  const isFromHost = message.origin_role === 'host' || message.origin_role === 'admin' || message.origin_role === 'system';

  // Check if this is an image-only message
  const isImageOnly = isImageOnlyMessage(message.content);

  // Check if message is unsent
  const isUnsent = message.is_unsent;

  // Check if current user can unsend this message
  const canUnsend = () => {
    if (isUnsent) return false; // Already unsent
    if (message.channel !== 'inapp') return false; // Only in-app messages
    if (isIncoming) return false; // Only outgoing messages
    if (!isFromHost) return false; // Only host messages
    
    // Check 24 hour time limit
    const messageTime = new Date(message.created_at);
    const now = new Date();
    const hoursDifference = (now - messageTime) / (1000 * 60 * 60);
    
    return hoursDifference < 24;
  };

  const handleUnsendClick = () => {
    setShowMenu(false);
    setShowUnsendConfirm(true);
  };

  const handleConfirmUnsend = () => {
    if (onUnsendMessage) {
      onUnsendMessage(message.id);
    }
    setShowUnsendConfirm(false);
  };

  const handleCancelUnsend = () => {
    setShowUnsendConfirm(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleDocClick = (e) => {
      if (showMenu && wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('click', handleDocClick)
    return () => {
      document.removeEventListener('click', handleDocClick)
    };
  }, [showMenu]);

  // Setup intersection observer to track when guest messages become visible to admin
  useEffect(() => {
    // For host viewing guest messages: we want to mark guest messages as read regardless of direction
    // The key is that the message is FROM a guest (origin_role = 'guest') and being viewed by admin
    const shouldTrackAsRead = isFromGuest;

    if (!wrapperRef.current || !onMarkAsRead || !shouldTrackAsRead) {
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

    observer.observe(wrapperRef.current);

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

  function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [locked]);
}

  function ConfirmDialog({ open, title, message, onCancel, onConfirm }) {
    useLockBodyScroll(open);
    if (!open) return null;

    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onCancel}
          aria-hidden="true"
        />
        <div
          role="dialog" aria-modal="true"
          className="relative bg-white rounded-lg p-6 max-w-sm w-[92%] shadow-xl"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 mb-4">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 text-white bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Unsend
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

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

  // If message is unsent, show placeholder (check this BEFORE image-only check)
  if (isUnsent) {
    return (
      <div className={`flex flex-col ${isFromHost ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
        {/* Timestamp */}
        {showTimestamp && (
          <div className={`text-xs text-gray-500 mb-1 ${isFromHost ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
            {formatTime24Hour(message.created_at)}
          </div>
        )}

        {/* Unsent message placeholder */}
        <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromHost ? 'items-end' : 'items-start'} flex flex-col`}>
          <div className={`px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm italic opacity-60 ${
            isFromHost
              ? 'bg-slate-50 border border-slate-400 text-slate-900 rounded-2xl rounded-br-md'
              : 'bg-slate-50 border border-slate-400 text-slate-900 rounded-2xl rounded-bl-md ring-1 ring-slate-200/70'
          }`}>
            Message unsent
          </div>
        </div>
      </div>
    );
  }

  // Render image-only messages without bubble
  if (isImageOnly) {
    return (
      <div className={`flex flex-col ${isFromHost ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
        {/* Timestamp */}
        {showTimestamp && (
          <div className={`text-xs text-gray-500 mb-1 ${isFromHost ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
            {formatTime24Hour(message.created_at)}
          </div>
        )}

        {/* Large image content without bubble */}
        <div className={`max-w-[90%] sm:max-w-[80%] lg:max-w-[75%] ${isFromHost ? 'items-end' : 'items-start'} flex flex-col`}>
          <div 
            className={`relative flex items-start gap-2 ${isFromHost ? 'flex-row-reverse' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            ref={wrapperRef}
          >
            <div ref={wrapperRef}>
              <LargeImageContent content={message.content} isFromHost={isFromHost} />
            </div>

            {/* Three dots menu positioned next to the image */}
            {isFromHost && canUnsend() && (isHovered || showMenu) && (
              <div className="relative flex-shrink-0 self-start mt-2">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-full hover:bg-gray-200 transition-colors bg-white/80 shadow-sm"
                  title="Message options"
                >
                  <MoreHorizontal className="w-4 h-4 text-gray-600" />
                </button>
                
                {/* Dropdown menu */}
                {showMenu && (
                 <div className="message-menu-container absolute top-8 left-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[120px] z-50">
                    <button
                      onClick={handleUnsendClick}
                      className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Unsend</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation modal for unsend */}
            {showUnsendConfirm && (
              <ConfirmDialog
                open={showUnsendConfirm}
                title="Unsend Message?"
                message="This will remove the message from the conversation. This action cannot be undone."
                onCancel={handleCancelUnsend}
                onConfirm={handleConfirmUnsend}
              />
            )}
          </div>

          {/* Channel and delivery status for image-only messages */}
          <div className="mt-2 flex items-center justify-center space-x-1 text-xs opacity-70">
            <span title={`Channel: ${message.channel}`} className="inline-flex items-center">
              {renderChannelIcon(message.channel)}
            </span>

            {/* Separator */}
            {!isIncoming && <span className="opacity-40">•</span>}

            {/* Delivery status */}
            {!isIncoming && renderDeliveryIcon()}
          </div>
        </div>
      </div>
    );
  }

  // Regular bubble rendering for text and mixed content
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
        <div 
          className={`relative flex items-start gap-2 ${isFromHost ? 'flex-row-reverse' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          ref={wrapperRef}
        >
          <div 
            ref={wrapperRef}
            className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-2 shadow-sm border text-sm relative w-full message-menu-container ${
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

          {/* Three dots menu positioned next to the bubble */}
          {isFromHost && canUnsend() && (isHovered || showMenu) && (
            <div className="relative flex-shrink-0 self-end mb-1">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-full hover:bg-gray-200 transition-colors"
                title="Message options"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-600" />
              </button>
              
              {/* Dropdown menu */}
              {showMenu && (
               <div className="message-menu-container absolute top-8 left-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[120px] z-50">
                  <button
                    onClick={handleUnsendClick}
                    className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Unsend</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Confirmation modal for unsend */}
          {showUnsendConfirm && (
            <ConfirmDialog
              open={showUnsendConfirm}
              title="Unsend Message?"
              message="This will remove the message from the conversation. This action cannot be undone."
              onCancel={handleCancelUnsend}
              onConfirm={handleConfirmUnsend}
            />
          )}
        </div>

       <div className="mt-2 flex items-center justify-center space-x-1 text-xs opacity-70">
          <span title={`Channel: ${message.channel}`} className="inline-flex items-center">
            {renderChannelIcon(message.channel)}
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
