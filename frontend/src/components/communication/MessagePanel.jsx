import React, { useState, useRef, useEffect } from 'react';
import { Send, Calendar, Archive, X, ChevronDown, Clock, Camera } from 'lucide-react';
import MessageBubble from './MessageBubble';
import ChannelSelector from './ChannelSelector';
import ScheduledMessagesPanel from './ScheduledMessagesPanel';
import GroupBookingPanel from './GroupBookingPanel';
import imageResizeService from '../../services/imageResizeService';
import { uploadMessageImages } from '../../services/fileUpload';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function MessagePanel({
  thread,
  messages,
  selectedChannel,
  onChannelChange,
  onSendMessage,
  onThreadAction,
  onMarkAsRead,
  onUnsendMessage,
  onMessageUpdate,
  loading,
  reservation,
  groupBookingInfo
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [showScheduledMessages, setShowScheduledMessages] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState(null);

  // Check if user is at the bottom of the message container
  const isAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const container = messagesContainerRef.current;
    const threshold = 50; // pixels from bottom
    return container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
  };

  // Handle scroll events to track if user manually scrolled
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    setIsUserScrolled(!isAtBottom());
  };

  // Scroll to bottom helper function
  const scrollToBottom = (immediate = false) => {
    if (!messagesEndRef.current) return;
    
    const scrollOptions = immediate 
      ? { behavior: 'instant' } 
      : { behavior: 'smooth' };
    
    messagesEndRef.current.scrollIntoView(scrollOptions);
  };

  // Only auto-scroll when thread changes (initial load) or when user is at bottom and new message arrives
  useEffect(() => {
    // Thread changed - this is initial load, always scroll to bottom
    if (thread?.id !== currentThreadId) {
      setCurrentThreadId(thread?.id || null);
      setIsUserScrolled(false);
      // Use longer timeout and requestAnimationFrame for initial load to ensure complete rendering
      setTimeout(() => {
        requestAnimationFrame(() => {
          scrollToBottom(true);
        });
      }, 150);
      return;
    }

    // Same thread, new messages - only scroll if user hasn't manually scrolled up
    if (messages.length > 0 && !isUserScrolled) {
      // Use requestAnimationFrame + timeout for proper timing with DOM updates
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom(false);
        }, 75);
      });
    }
  }, [thread?.id, messages, currentThreadId, isUserScrolled]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || sending || !thread) return;

    setSending(true);
    try {
      await onSendMessage(draft.trim(), selectedChannel);
      setDraft('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getAvailableChannels = () => {
    if (!thread) return ['inapp'];
    
    const availableChannels = ['inapp']; // Always available
    
    // Add channels from thread_channels if they exist
    if (thread.thread_channels && Array.isArray(thread.thread_channels)) {
      thread.thread_channels.forEach(tc => {
        if (tc.channel && !availableChannels.includes(tc.channel)) {
          availableChannels.push(tc.channel);
        }
      });
    }
    
    return availableChannels;
  };

  const formatThreadSubject = () => {
    if (!thread) return 'Select a conversation';
    return thread.subject || 'Conversation';
  };

  // Image attachment handlers
  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      // Validate selected images
      const validation = imageResizeService.validateImages(files, {
        maxFiles: 5,
        maxFileSizeMB: 10
      });

      if (!validation.isValid) {
        toast.error(validation.errors.join('\n'));
        return;
      }

      setUploading(true);
      setUploadProgress({ current: 0, total: validation.validFiles.length });

      // Resize images
      const resizedImages = await imageResizeService.resizeMultipleImages(
        validation.validFiles,
        (current, total) => {
          setUploadProgress({ current: current + 1, total });
        }
      );

      // Create preview objects
      const imagePreviews = resizedImages.map((file, index) => ({
        id: `temp_${Date.now()}_${index}`,
        file: file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size
      }));

      setSelectedImages(prev => [...prev, ...imagePreviews]);
      toast.success(`${resizedImages.length} image(s) selected and resized`);

    } catch (error) {
      console.error('Error processing images:', error);
      toast.error('Failed to process images');
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (imageId) => {
    setSelectedImages(prev => {
      const imageToRemove = prev.find(img => img.id === imageId);
      if (imageToRemove?.preview) {
        URL.revokeObjectURL(imageToRemove.preview);
      }
      return prev.filter(img => img.id !== imageId);
    });
  };

  const handleSendWithImages = async () => {
    if ((!draft.trim() && selectedImages.length === 0) || sending || !thread) return;

    const messageContent = draft.trim();
    const imagesToSend = [...selectedImages];
    
    // Don't clear state until we're sure the message will be sent
    setSending(true);
    setUploading(true);

    try {
      let finalMessageContent = messageContent;

      if (imagesToSend.length > 0) {
        // Upload images first
        const uploadResults = await uploadMessageImages(
          imagesToSend.map(img => img.file),
          `temp_${Date.now()}`,
          (current, total) => {
            setUploadProgress({ current, total });
          }
        );

        // Create message content with images
        // If we have text, add a line break before images, otherwise start with images
        if (messageContent) {
          finalMessageContent = messageContent + '\n';
        } else {
          finalMessageContent = '';
        }
        
        uploadResults.forEach(result => {
          if (result.success) {
            finalMessageContent += `<img src="${result.publicUrl}" alt="${result.originalName}" style="max-width: 100%; height: auto;" />\n`;
          }
        });

        // Clean up preview URLs
        imagesToSend.forEach(img => {
          if (img.preview) {
            URL.revokeObjectURL(img.preview);
          }
        });
      }

      // Send the message (either text-only or text + images)
      await onSendMessage(finalMessageContent, selectedChannel);
      
      // Clear state only after successful send
      setDraft('');
      setSelectedImages([]);
      
      if (imagesToSend.length > 0) {
        toast.success('Message with images sent successfully');
      }
    } catch (error) {
      console.error('Error sending message with images:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const canSend = (draft.trim() || selectedImages.length > 0) && !sending && !uploading;

  // Handle unsending a message
  const handleUnsendMessage = async (messageId) => {
    if (!onUnsendMessage) {
      console.error('onUnsendMessage function not provided');
      toast.error('Unable to unsend message');
      return;
    }

    try {
      await onUnsendMessage(messageId);
      // Don't call onMessageUpdate here - the real-time subscription and optimistic update 
      // in useRealtimeCommunication will handle showing the unsent state
    } catch (error) {
      // Error handling is already done in the hook's unsendMessage function
      console.error('Failed to unsend message:', error);
    }
  };

  // Automation handlers for ScheduledMessagesPanel
  const handleTriggerAutomation = async (reservationId) => {
    if (!reservationId) return;
    
    try {
      const { adminAPI } = await import('../../services/api');
      const response = await adminAPI.triggerAutomationForReservation(reservationId, false);
      console.log('Automation triggered:', response.data);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error triggering automation:', error);
      throw error;
    }
  };

  const handleCancelMessages = async (reservationId) => {
    if (!reservationId) return;
    
    try {
      const { adminAPI } = await import('../../services/api');
      const response = await adminAPI.cancelScheduledMessagesForReservation(reservationId, 'Manual cancellation via message panel');
      console.log('Messages cancelled:', response.data);
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error cancelling messages:', error);
      throw error;
    }
  };

  if (!thread) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <Send className="w-6 h-6 sm:w-8 sm:h-8 text-primary-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-primary-800 mb-2">No conversation selected</h3>
          <p className="text-sm sm:text-base text-primary-600">Choose a conversation from the sidebar to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ height: '100%', maxHeight: '100vh' }}>
      {/* Header */}
      <div className="bg-white border-b border-primary-200 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between">
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-primary-900 truncate">
              {formatThreadSubject()}
            </h1>
            <div className="flex flex-wrap items-center mt-1 gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-500">
                Thread: {thread.id.slice(0, 8)}
              </span>
              {thread.reservation_id && (
                <span className="text-xs sm:text-sm text-gray-500">
                  Res: #{thread.reservation_id.slice(0, 8)}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                thread.status === 'open' 
                  ? 'bg-green-100 text-green-800'
                  : thread.status === 'closed'
                  ? 'bg-gray-100 text-gray-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {thread.status}
              </span>
            </div>
          </div>
          {/* Scheduled Messages Panel */}
      {showScheduledMessages && thread?.reservation_id && (
        <div className="border-t border-gray-200 bg-white">
          <ScheduledMessagesPanel
            reservationId={thread.reservation_id}
            onTriggerAutomation={handleTriggerAutomation}
            onCancelMessages={handleCancelMessages}
          />
        </div>
      )}

          <div className="flex items-center mt-3 sm:mt-0 space-x-1 sm:space-x-2">
            <button
              onClick={() => setShowScheduledMessages(!showScheduledMessages)}
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Scheduled</span>
            </button>

            <div className="relative">
              <button className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <span className="hidden sm:inline">More</span>
                <span className="sm:hidden">⋯</span>
                <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 ml-1 sm:ml-2" />
              </button>
              {/* Dropdown menu would go here */}
            </div>

            <button
              onClick={() => onThreadAction('close', thread.id)}
              className="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </div>
        </div>
      </div>

      {/* Group Booking Panel - shows when applicable */}
      {groupBookingInfo?.is_group_booking && (
        <div className="border-b border-gray-200 p-3 sm:p-4 bg-white">
          <GroupBookingPanel 
            groupBookingInfo={groupBookingInfo}
            reservation={reservation}
          />
        </div>
      )}

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-gray-50 p-2 sm:p-4" 
        style={{ WebkitOverflowScrolling: 'touch' }}
        onScroll={handleScroll}
      >
        {loading && messages.length === 0 && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading messages...</p>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-6 sm:py-8 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No messages yet</h3>
            <p className="text-sm sm:text-base text-gray-600">Start the conversation by sending a message below</p>
          </div>
        )}

        <div className="space-y-1">
          {messages.map((message, index) => {
            // Helper function to format timestamp as HH:MM
            const formatTimeKey = (timestamp) => {
              const date = new Date(timestamp);
              return date.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
            };

            // Determine if we should show timestamp for this message
            const showTimestamp = index === 0 || 
              formatTimeKey(message.created_at) !== formatTimeKey(messages[index - 1].created_at);

            return (
              <MessageBubble
                key={`${message.id}-${index}`}
                message={message}
                showTimestamp={showTimestamp}
                onMarkAsRead={onMarkAsRead}
                onUnsendMessage={handleUnsendMessage}
                currentUser={user}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-3 sm:p-4 space-y-3">
        {/* Image Previews */}
        {selectedImages.length > 0 && (
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex flex-wrap gap-2">
              {selectedImages.map((image) => (
                <div
                  key={image.id}
                  className="relative group rounded-lg overflow-hidden bg-white border border-gray-200 shadow-sm"
                >
                  <img
                    src={image.preview}
                    alt={image.name}
                    className="w-20 h-20 object-cover"
                  />
                  <button
                    onClick={() => handleRemoveImage(image.id)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 
                             text-white rounded-full flex items-center justify-center opacity-0 
                             group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                    <div className="text-xs text-white truncate">
                      {Math.round(image.size / 1024)}KB
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && uploadProgress.total > 0 && (
          <div className="border rounded-lg p-3 bg-blue-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-700">
                {uploading && selectedImages.length === 0
                  ? 'Processing images...'
                  : 'Uploading images...'
                }
              </span>
              <span className="text-sm text-blue-600">
                {uploadProgress.current}/{uploadProgress.total}
              </span>
            </div>
            <div className="bg-blue-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-600 h-2 transition-all duration-300"
                style={{
                  width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
                }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-end space-y-3 sm:space-y-0 sm:space-x-3">
          <div className="flex-1">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            <div className="flex items-end space-x-2">
              {/* Image attachment button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || uploading || selectedImages.length >= 5}
                className="inline-flex items-center justify-center p-2 border border-gray-300 rounded-lg 
                         text-gray-600 hover:text-gray-700 hover:bg-gray-50 
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label="Attach images"
                type="button"
              >
                <Camera className="w-5 h-5" />
              </button>

              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendWithImages();
                    }
                  }}
                  placeholder={
                    selectedImages.length > 0 
                      ? "Add a message (optional)..." 
                      : "Type your message..."
                  }
                  className="w-full resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary-500 focus:border-primary-500 max-h-32 text-base sm:text-sm"
                  rows="1"
                  style={{ fontSize: '16px' }}
                  disabled={sending || uploading}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-2 gap-2">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <span className="text-xs text-gray-500 whitespace-nowrap">Send via:</span>
                <ChannelSelector
                  availableChannels={getAvailableChannels()}
                  selectedChannel={selectedChannel}
                  onChannelChange={onChannelChange}
                />
                {selectedImages.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {selectedImages.length}/5 images
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">{draft.length}/1000</span>
            </div>
            <div className="mt-1 text-xs text-gray-400 hidden sm:block">
              Press Enter to send, Shift+Enter for new line
            </div>
          </div>
          
          <button
            onClick={handleSendWithImages}
            disabled={!canSend || draft.length > 1000}
            className="inline-flex items-center justify-center px-3 sm:px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {sending || uploading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {selectedImages.length > 0 ? 'Send with Images' : 'Send'}
          </button>
        </div>
      </div>

      
    </div>
  );
}
