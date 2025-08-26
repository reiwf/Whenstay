import React, { useRef, useEffect, useState  } from 'react'
import { CheckCircle, Clock, AlertCircle, X, ChevronLeft, ChevronRight, MoreHorizontal, Trash2 } from 'lucide-react'
import airbnbLogo from '../../../shared/airbnblogo.png'
import { createPortal } from 'react-dom'

// Channel icons mapping (unchanged)
const CHANNEL_ICONS = {
  beds24: '🛏️',
  whatsapp: '🟢',
  inapp: '💬',
  email: '✉️',
  sms: '📱',
  airbnb: airbnbLogo,
  bookingcom: '🏠',
}

const renderChannelIcon = (channel) => {
  const icon = CHANNEL_ICONS[channel]
  if (!icon) return '📱'
  if (channel === 'airbnb') {
    return <img src={icon} alt="Airbnb" className="w-4 h-4 inline" />
  }
  return icon
}

function ImageLightbox({ images, index, onClose, setIndex }) {
  if (!images?.length) return null

  // keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, onClose, setIndex])

  const src = images[index]

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // click backdrop to close
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Close button */}
      <button
        aria-label="Close"
        className="absolute top-3 right-3 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
        onClick={onClose}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            aria-label="Previous image"
            className="absolute left-2 md:left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button
            aria-label="Next image"
            className="absolute right-2 md:right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={() => setIndex((i) => (i + 1) % images.length)}
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </>
      )}

      {/* Image */}
      <div className="max-w-[95vw] max-h-[90vh]">
        <img
          src={src}
          alt="Preview"
          className="max-h-[90vh] max-w-[95vw] object-contain select-none"
          draggable={false}
        />
      </div>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/80 text-xs">
          {index + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  )
}

function extractImageUrlsFromHtml(html) {
  const urls = []
  if (!html) return urls
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    urls.push(m[1])
  }
  return urls
}

function extractAllMessageImages(message) {
  const fromContent = extractImageUrlsFromHtml(message?.content || '')
  const fromAttachments = (message?.message_attachments || [])
    .filter((a) => a?.content_type?.startsWith('image/'))
    .map((a) => a.path)
  // dedupe while preserving order
  const seen = new Set()
  const all = []
  for (const u of [...fromContent, ...fromAttachments]) {
    if (!seen.has(u)) {
      seen.add(u)
      all.push(u)
    }
  }
  return all
}


// Content renderer (unchanged, just class tweaks)
function MessageContent({ content, onImageClick }) {
  if (!content) return null
  const hasHTML = /<[^>]*>/.test(content)
  if (!hasHTML) return <span>{content}</span>

  const parts = []
  let currentIndex = 0
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  let imageIdx = 0

  while ((match = imgRegex.exec(content)) !== null) {
    if (match.index > currentIndex) {
      const textBefore = content.substring(currentIndex, match.index)
      const cleanText = textBefore.replace(/<[^>]*>/g, '').trim()
      if (cleanText) {
        parts.push(
          <span key={`text-${currentIndex}`} className="block mb-2">
            {cleanText}
          </span>
        )
      }
    }

    const imgSrc = match[1]
    const styleMatch = match[0].match(/style=["']([^"']*)["']/)
    let imageHeight = '200px'
    if (styleMatch) {
      const heightMatch = styleMatch[1].match(/height:\s*(\d+)px/)
      if (heightMatch) imageHeight = `${Math.min(parseInt(heightMatch[1]), 300)}px`
    }

    parts.push(
      <div key={`img-${match.index}`} className="my-2">
        <img
          src={imgSrc}
          alt="Shared image"
          className="rounded-xl shadow-sm max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity block"
          style={{ maxHeight: imageHeight, objectFit: 'cover' }}
          onClick={() => onImageClick?.(imageIdx)}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentNode.innerHTML = `
              <div class="text-xs p-2 rounded bg-slate-100 border border-slate-200">
                🖼️ Image: ${imgSrc.split('/').pop() || 'Unable to load'}
              </div>
            `
          }}
        />
      </div>
    )

    imageIdx += 1
    currentIndex = match.index + match[0].length
  }

  if (currentIndex < content.length) {
    const textAfter = content.substring(currentIndex)
    const cleanText = textAfter.replace(/<[^>]*>/g, '').trim()
    if (cleanText) parts.push(<span key={`text-${currentIndex}`} className="block">{cleanText}</span>)
  }
  return <div>{parts.length > 0 ? parts : <span>{content.replace(/<[^>]*>/g, '')}</span>}</div>
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

function LargeImageContent({ content, isFromGuest, onImageClick }) {
  if (!content) return null;

  const parts = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  let imageIndex = 0;

  while ((match = imgRegex.exec(content)) !== null) {
    const imgSrc = match[1];

    parts.push(
      <ImageWithFallback
        key={`img-${match.index}`}
        src={imgSrc}
        isFromGuest={isFromGuest}
        imageIndex={imageIndex}
        onImageClick={onImageClick}
      />
    );
    imageIndex++;
  }

  return <div>{parts}</div>;
}

function ImageWithFallback({ src, isFromGuest, imageIndex, onImageClick }) {
  const [failed, setFailed] = React.useState(false);
  const fileName = getFileNameFromUrl(src);

  if (failed) {
    return (
      <div
        className={`my-2 text-xs p-3 rounded-lg border ${
          isFromGuest
            ? 'bg-slate-700/10 border-slate-600/20 text-slate-800'
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
        onClick={() => onImageClick?.(imageIndex)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function GuestMessageBubble({ message, showTimestamp = false, onMarkAsRead, onUnsendMessage, currentUser }) {
  const wrapperRef = useRef(null) 
  const isFromGuest = message.origin_role === 'guest'
  const isFromAdmin = message.origin_role === 'host' || message.origin_role === 'admin'

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const images = extractAllMessageImages(message)
  const [showMenu, setShowMenu] = useState(false)
  const [showUnsendConfirm, setShowUnsendConfirm] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const openLightboxAt = (idx) => {
      setLightboxIndex(Math.max(0, Math.min(idx, images.length - 1)))
      setLightboxOpen(true)
    }

  // Check if this is an image-only message
  const isImageOnly = isImageOnlyMessage(message.content)

  // Check if message is unsent
  const isUnsent = message.is_unsent

  // Check if current user can unsend this message
  const canUnsend = () => {
    if (isUnsent) return false; // Already unsent
    if (message.channel !== 'inapp') return false; // Only in-app messages
    if (!isFromGuest) return false; // Only guest messages (in guest panel)
    
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

  useEffect(() => {
    if (!wrapperRef.current || !onMarkAsRead || !isFromAdmin) return
    const currentStatus = message.message_deliveries?.[0]?.status
    if (currentStatus === 'read') return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            setTimeout(() => {
              const currentEntry = observer.takeRecords()[0] || entry
              if (currentEntry.isIntersecting) onMarkAsRead(message.id)
            }, 2000)
          }
        })
      },
      { threshold: 0.5, rootMargin: '0px 0px -50px 0px' }
    )

    observer.observe(wrapperRef.current)
    return () => observer.disconnect()
  }, [message.id, message.message_deliveries, isFromAdmin, onMarkAsRead])

  const formatTime24Hour = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })

  const getDeliveryStatus = () => {
    if (!message.message_deliveries || message.message_deliveries.length === 0) {
      return { status: 'pending', icon: Clock, color: 'text-slate-400' }
    }
    const d = message.message_deliveries[0]
    if (d.error_message) return { status: 'failed', icon: AlertCircle, color: 'text-red-500' }
    if (d.read_at) return { status: 'read', icon: CheckCircle, color: 'text-emerald-600' }
    if (d.delivered_at) return { status: 'delivered', icon: CheckCircle, color: 'text-emerald-500' }
    if (d.sent_at) return { status: 'sent', icon: CheckCircle, color: 'text-slate-500' }
    if (d.status === 'sending') return { status: 'sending', icon: Clock, color: 'text-slate-400' }
    return { status: 'pending', icon: Clock, color: 'text-slate-400' }
  }
    
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

  const deliveryStatus = getDeliveryStatus()
  const StatusIcon = deliveryStatus.icon

  // --- New, blended styles
  const bubbleClsGuest =
    'bg-slate-700 text-white rounded-2xl rounded-br-md shadow-sm'
  const bubbleClsHost =
    'bg-white/80 dark:bg-slate-900/60 text-slate-900 dark:text-slate-100 ' +
    'backdrop-blur supports-[backdrop-filter]:bg-white/60 ' +
    'ring-1 ring-slate-200/70 dark:ring-slate-700/60 rounded-2xl rounded-bl-md shadow-sm'

  const attachmentTileGuest =
    'bg-white/10 text-white border border-white/10 rounded-lg px-2 py-1 text-xs'
  const attachmentTileHost =
    'bg-slate-100 text-slate-800 border border-slate-200 rounded-lg px-2 py-1 text-xs'

  // If message is unsent, show placeholder
  if (isUnsent) {
    return (
      <div className={`flex flex-col ${isFromGuest ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
        {/* Timestamp */}
        {showTimestamp && (
          <div className={`text-[11px] text-slate-500 mb-1 ${isFromGuest ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
            {formatTime24Hour(message.created_at)}
          </div>
        )}

        {/* Unsent message placeholder */}
        <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromGuest ? 'items-end' : 'items-start'} flex flex-col`}>
          <div className={`px-3 py-2 sm:px-3.5 sm:py-2.5 text-sm italic opacity-60 ${
            isFromGuest
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
      <div className={`flex flex-col ${isFromGuest ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
        {/* Timestamp */}
        {showTimestamp && (
          <div className={`text-[11px] text-slate-500 mb-1 ${isFromGuest ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
            {formatTime24Hour(message.created_at)}
          </div>
        )}

        {/* Large image content without bubble */}
        <div className={`max-w-[90%] sm:max-w-[80%] lg:max-w-[75%] ${isFromGuest ? 'items-end' : 'items-start'} flex flex-col`}>
          <div 
            className={`relative flex items-start gap-2 ${isFromGuest ? 'flex-row-reverse' : ''}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            ref={wrapperRef}
          >
             {/* Image wrapper becomes positioning context */}
              <div className="relative">
                <LargeImageContent
                  content={message.content}
                  isFromGuest={isFromGuest}
                  onImageClick={(idx) => openLightboxAt(idx)}
                />

                {/* Dots + menu anchored to bottom-left of the image */}
                {isFromGuest && canUnsend() && (isHovered || showMenu) && (
                  <div className="absolute left-2 bottom-2">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="p-1 rounded-full hover:bg-slate-200 transition-colors bg-white/90 shadow-sm"
                      title="Message options"
                    >
                      <MoreHorizontal className="w-4 h-4 text-slate-700" />
                    </button>

                    {showMenu && (
                      <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px] z-50">
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
              </div>

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

          {/* Delivery status for image-only messages */}
          {isFromGuest && (
            <div className="flex justify-center">
              <div className={`text-[10px] mt-1 ${deliveryStatus.color} opacity-75 capitalize`}>
                {deliveryStatus.status}
              </div>
            </div>
          )}
        </div>
        {lightboxOpen && (
          <ImageLightbox
            images={images}
            index={lightboxIndex}
            setIndex={setLightboxIndex}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </div>
    );
  }

  // Regular bubble rendering for text and mixed content
  return (
    <div className={`flex flex-col ${isFromGuest ? 'items-end' : 'items-start'} ${showTimestamp ? 'mt-3 sm:mt-4' : 'mt-1'}`}>
      {/* Timestamp */}
      {showTimestamp && (
        <div className={`text-[11px] text-slate-500 mb-1 ${isFromGuest ? 'mr-1 sm:mr-2' : 'ml-1 sm:ml-2'}`}>
          {formatTime24Hour(message.created_at)}
        </div>
      )}

      {/* Bubble */}
      <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromGuest ? 'items-end' : 'items-start'} flex flex-col`}>
        <div 
          className={`relative flex items-start gap-2 ${isFromGuest ? 'flex-row-reverse' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          ref={wrapperRef}
        >
          <div
            ref={wrapperRef}
            className={[
              'px-3 py-2 sm:px-3.5 sm:py-2.5 relative w-full animate-pop message-menu-container',
              isFromGuest ? bubbleClsGuest : bubbleClsHost,
            ].join(' ')}
            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
          >
            {/* Optional tiny header: channel + status for host messages */}
            {/* {!isFromGuest && (
              <div className="mb-1.5 flex items-center justify-between">
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <span>{renderChannelIcon(message.channel)}</span>
                  <span className="truncate max-w-[140px] capitalize">{message.channel || 'inapp'}</span>
                </div>
                {deliveryStatus.status !== 'pending' && (
                  <div className={`flex items-center gap-1 text-[10px] ${deliveryStatus.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span className="capitalize">{deliveryStatus.status}</span>
                  </div>
                )}
              </div>
            )} */}

            <div className="text-sm whitespace-pre-wrap">
               <MessageContent
                content={message.content}
                onImageClick={(idx) => openLightboxAt(idx)}
              />
            </div>

            {/* Attachments */}
            {message.message_attachments?.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.message_attachments.map((attachment, index) => {
                  const isImage = attachment.content_type?.startsWith('image/')
                  if (isImage) {
                    const globalIdx = images.findIndex((u) => u === attachment.path)
                    return (
                      <div key={index} className="max-w-xs">
                        <img
                          src={attachment.path}
                          alt={attachment.path.split('/').pop()}
                          className="rounded-xl shadow-sm max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          style={{ maxHeight: '220px', objectFit: 'cover' }}
                           onClick={() =>
                              openLightboxAt(globalIdx >= 0 ? globalIdx : 0)
                            }
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.parentNode.innerHTML = `
                              <div class="text-xs p-2 rounded bg-slate-100 border border-slate-200">
                                📎 ${attachment.path.split('/').pop()}
                                ${attachment.size_bytes ? `(${(attachment.size_bytes / 1024).toFixed(1)}KB)` : ''}
                              </div>
                            `
                          }}
                        />
                        <div className="text-[11px] text-slate-500 mt-1 text-center">
                          {attachment.path.split('/').pop()}
                          {attachment.size_bytes && <span className="ml-1">({(attachment.size_bytes / 1024).toFixed(1)}KB)</span>}
                        </div>
                      </div>
                    )
                  }
                  // Non-image attachment tile
                  return (
                    <button
                      key={index}
                      className={`${isFromGuest ? attachmentTileGuest : attachmentTileHost} cursor-pointer hover:opacity-90 transition-opacity`}
                      onClick={() => window.open(attachment.path, '_blank')}
                      type="button"
                    >
                      📎 {attachment.path.split('/').pop()}
                      {attachment.size_bytes && <span className="ml-1">({(attachment.size_bytes / 1024).toFixed(1)}KB)</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Three dots menu positioned next to the bubble */}
          {isFromGuest && canUnsend() && (isHovered || showMenu) && (
            <div className="relative flex-shrink-0 self-end mb-1">
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="p-1 rounded-full hover:bg-slate-200 transition-colors"
                title="Message options"
              >
                <MoreHorizontal className="w-4 h-4 text-slate-600" />
              </button>

              {showMenu && (
                <div
                  className="absolute right-0 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[140px] z-50"
                >
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

        {/* Delivery status (guest messages only, under bubble) */}
        {isFromGuest && (
          <div className="flex justify-center">
            <div className={`text-[10px] mt-1 ${deliveryStatus.color} opacity-75 capitalize`}>
              {deliveryStatus.status}
            </div>
          </div>
        )}
      </div>
      {lightboxOpen && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          setIndex={setLightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
