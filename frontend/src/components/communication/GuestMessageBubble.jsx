import React, { useRef, useEffect, useState  } from 'react'
import { CheckCircle, Clock, AlertCircle, X, ChevronLeft, ChevronRight } from 'lucide-react'
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

// Component to render large images without bubble
function LargeImageContent({ content, isFromGuest, onImageClick }) {
  if (!content) return null

  const parts = []
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  let match
  let imageIdx = 0

  while ((match = imgRegex.exec(content)) !== null) {
    const imgSrc = match[1]
    parts.push(
      <div key={`img-${match.index}`} className="my-2">
        <img
          src={imgSrc}
          alt="Shared image"
          className="rounded-2xl shadow-lg max-w-full h-auto cursor-pointer hover:opacity-95 transition-all duration-200 block"
          style={{ maxHeight: '400px', objectFit: 'cover' }}
          onClick={() => onImageClick?.(imageIdx)}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentNode.innerHTML = `
              <div class="text-xs p-3 rounded-lg ${
                isFromGuest 
                  ? 'bg-slate-600 text-slate-100' 
                  : 'bg-slate-100 border border-slate-200 text-slate-800'
              }">
                🖼️ Image: ${imgSrc.split('/').pop() || 'Unable to load'}
              </div>
            `
          }}
        />
      </div>
    )
    imageIdx += 1
  }

  return <div>{parts}</div>
}

export default function GuestMessageBubble({ message, showTimestamp = false, onMarkAsRead }) {
  const messageRef = useRef(null)
  const isFromGuest = message.origin_role === 'guest'
  const isFromAdmin = message.origin_role === 'host' || message.origin_role === 'admin'

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const images = extractAllMessageImages(message)

  const openLightboxAt = (idx) => {
      // idx refers to index within "content" images first; find the global index in `images`
      setLightboxIndex(Math.max(0, Math.min(idx, images.length - 1)))
      setLightboxOpen(true)
    }

  // Check if this is an image-only message
  const isImageOnly = isImageOnlyMessage(message.content)

  useEffect(() => {
    if (!messageRef.current || !onMarkAsRead || !isFromAdmin) return
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

    observer.observe(messageRef.current)
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
          <div ref={messageRef}>
             <LargeImageContent
                content={message.content}
                isFromGuest={isFromGuest}
                onImageClick={(idx) => openLightboxAt(idx)}
              />
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
        <div className="relative">
          <div
            ref={messageRef}
            className={[
              'px-3 py-2 sm:px-3.5 sm:py-2.5 relative w-full animate-pop',
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
