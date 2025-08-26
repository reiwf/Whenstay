import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, RefreshCw, Camera, X, Upload, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Section from '../ui/Section'
import { ListGroup } from '../ui/ListGroup'
import GuestMessageBubble from './GuestMessageBubble';
import useGuestCommunication from '../../hooks/useGuestCommunication';
import LoadingSpinner from '../LoadingSpinner';
import imageResizeService from '../../services/imageResizeService';
import { uploadMessageImages } from '../../services/fileUpload';
import api from '../../services/api';
import toast from 'react-hot-toast';

function useKeyboardInsets() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', `${kb}px`);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.documentElement.style.removeProperty('--kb');
    };
  }, []);
}

export default function GuestMessagePanel({ token, guestName }) {
  const { t } = useTranslation('guest');
  const [draft, setDraft] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasInitialScrolled = useRef(false);
  const keyboardInset = useKeyboardInsets();
    
  const {
    loading,
    thread,
    messages,
    sending,
    connectionStatus,
    sendMessage,
    initialize,
    refresh,
    markMessageAsRead,
    messageListRef
  } = useGuestCommunication(token);

  // Initialize communication on mount - only run when token changes
  useEffect(() => {
    if (token) {
      initialize();
    }
  }, [token, initialize]);

  // Scroll to bottom helper function
  const scrollToBottom = (immediate = false) => {
    if (!messagesEndRef.current) return;
    
    const scrollOptions = immediate 
      ? { behavior: 'auto' } 
      : { behavior: 'smooth' };
    
    messagesEndRef.current.scrollIntoView(scrollOptions);
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (!messageListRef.current || !messagesEndRef.current) return;
    
    // For initial load, scroll immediately after a short delay to ensure rendering
    if (messages.length > 0 && !hasInitialScrolled.current) {
      setTimeout(() => {
        scrollToBottom(true);
        hasInitialScrolled.current = true;
      }, 100);
      return;
    }
    
    // For new messages, wait for DOM to update then scroll
    if (messages.length > 0 && hasInitialScrolled.current) {
      // Use multiple techniques to ensure proper timing
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom(false);
        }, 50);
      });
    }
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [draft]);

  const handleSend = async () => {
    if (!draft.trim() || sending) return;

    const messageContent = draft.trim();
    setDraft(''); // Clear immediately for better UX

    try {
      await sendMessage(messageContent);
    } catch (error) {
      // If sending fails, restore the draft
      setDraft(messageContent);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendWithImages();
    }
  };

  const handleRefresh = () => {
    refresh();
  };

  // Image attachment handlers
  const handleImageSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      // Validate selected images
      const validation = imageResizeService.validateImages(files, {
        maxFiles: 3,
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
    if ((!draft.trim() && selectedImages.length === 0) || sending) return;

    const messageContent = draft.trim();
    const imagesToSend = [...selectedImages];
    
    console.log('handleSendWithImages called:', { 
      messageContent: messageContent, 
      hasText: !!messageContent,
      imageCount: imagesToSend.length,
      sending: sending,
      uploading: uploading
    });

    // Clear the UI state immediately
    setDraft('');
    setSelectedImages([]);

    try {
      // Step 1: Send text message first if we have text
      if (messageContent) {
        console.log('Step 1: Sending text message:', messageContent);
        await sendMessage(messageContent);
        console.log('✅ Text message sent successfully');
      }

      // Step 2: Send images separately if we have any
      if (imagesToSend.length > 0) {
        console.log('Step 2: Processing and sending images...');
        setUploading(true);

        // Upload images first
        const uploadResults = await uploadMessageImages(
          imagesToSend.map(img => img.file),
          `temp_${Date.now()}`,
          (current, total) => {
            setUploadProgress({ current, total });
            console.log(`Upload progress: ${current}/${total}`);
          }
        );

        console.log('Upload results:', uploadResults);

        // Send each image as a separate message
        for (const result of uploadResults) {
          if (result.success) {
            const imageMessage = `<img src="${result.publicUrl}" alt="${result.originalName}" style="max-width: 100%; height: auto;" />`;
            console.log('Sending image message:', imageMessage);
            await sendMessage(imageMessage);
            console.log('✅ Image message sent successfully');
          } else {
            console.error('❌ Failed to upload image:', result.error);
          }
        }

        // Clean up preview URLs
        imagesToSend.forEach(img => {
          if (img.preview) {
            URL.revokeObjectURL(img.preview);
          }
        });

        toast.success(`Sent message${messageContent ? ' with text' : ''} and ${uploadResults.filter(r => r.success).length} image(s)`);
        console.log('✅ All messages sent successfully');
      } else if (messageContent) {
        toast.success('Text message sent');
      }

    } catch (error) {
      console.error('❌ Error sending messages:', error);
      
      // Restore state on error
      if (messageContent) setDraft(messageContent);
      if (imagesToSend.length > 0) setSelectedImages(imagesToSend);
      
      toast.error('Failed to send message');
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  const canSend = (draft.trim() || selectedImages.length > 0) && !sending && !uploading;

  // Handle unsending a message
  const handleUnsendMessage = async (messageId) => {
    try {
      const response = await api.delete(`guest/${token}/messages/${messageId}/unsend`);
      
      if (response.status === 200) {
        toast.success('Message unsent successfully');
        
        // Refresh messages
        refresh();
      }
    } catch (error) {
      console.error('Failed to unsend message:', error);
      
      if (error.response?.status === 403) {
        toast.error('You can only unsend your own messages within 24 hours');
      } else if (error.response?.status === 404) {
        toast.error('Message not found');
      } else if (error.response?.status === 409) {
        toast.error('Message has already been unsent');
      } else {
        toast.error('Failed to unsend message');
      }
    }
  };

 return (
    <div className="h-full flex flex-col">
      {/* Header (blended) */}
      <Section title={t('supportChat.title')} subtitle={t('supportChat.subtitle')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={[
                'inline-block w-2 h-2 rounded-full',
                connectionStatus === 'SUBSCRIBED'
                  ? 'bg-emerald-500'
                  : connectionStatus === 'CONNECTING'
                  ? 'bg-yellow-400'
                  : 'bg-slate-400',
              ].join(' ')}
              title={t('supportChat.connectionStatus', { status: connectionStatus })}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            aria-label={t('supportChat.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </Section>

      {/* Messages (inset sheet) */}
      <div ref={messageListRef} className="flex-1 overflow-y-auto pt-1 pb-3">
        <div
          className="rounded-2xl bg-white/70 dark:bg-slate-900/50 backdrop-blur
                    supports-[backdrop-filter]:bg-white/60 ring-1 ring-slate-200/70 dark:ring-slate-700/60
                    p-3 min-h-[180px]"
        >
          {loading && messages.length === 0 ? (
            <div className="text-center py-8">
              <LoadingSpinner />
              <p className="text-slate-600 mt-2 text-sm">{t('supportChat.loadingMessages')}</p>
            </div>
          ) : null}

          {!loading && messages.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                <MessageCircle className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                {!thread ? t('supportChat.emptyState.noThread.title') : t('supportChat.emptyState.hasThread.title')}
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {!thread
                  ? t('supportChat.emptyState.noThread.description')
                  : t('supportChat.emptyState.hasThread.description')}
              </p>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const formatTimeKey = (timestamp) => {
              const date = new Date(timestamp)
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            }
            const showTimestamp =
              index === 0 || formatTimeKey(message.created_at) !== formatTimeKey(messages[index - 1].created_at)

            return (
              <GuestMessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamp}
                onMarkAsRead={markMessageAsRead}
                onUnsendMessage={handleUnsendMessage}
                currentUser={{ role: 'guest' }}
              />
            )
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

        {/* --- Composer -------------------------------------------------------- */}
      <div className="pb-3 safe-pb">
        <div className="">
          {/* Composer container: ring disappears while typing */}
          <div className="rounded-2xl bg-white shadow-sm
            [box-shadow:0_0_0_1px_theme(colors.slate.200)_inset]">
            {/* Typing area */}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Write a message..."
              rows={1}
              style={{ paddingBottom: keyboardInset }}
              className="
                no-focus-ring
                w-full rounded-2xl resize-none bg-transparent px-4 py-2.5 text-sm
                appearance-none border-0 outline-none
                focus:outline-none focus:border-0 focus:ring-0 focus:shadow-none"
            />

            {/* Inline previews (under typing) */}
            {selectedImages.length > 0 && (
              <div className="px-3">
                <div className="flex flex-wrap gap-2">
                  {selectedImages.map((image) => (
                    <div
                      key={image.id}
                      className="relative group rounded-xl overflow-hidden bg-slate-100 border border-slate-200"
                    >
                      <img src={image.preview} alt={image.name} className="w-14 h-14 object-cover" />
                      <button
                        onClick={() => handleRemoveImage(image.id)}
                        className="absolute top-1 right-1 w-6 h-6 bg-slate-900/60 hover:bg-slate-900/80 
                                  text-white rounded-full flex items-center justify-center opacity-0 
                                  group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900/60 to-transparent p-1">
                        <div className="text-xs text-white truncate">{Math.round(image.size / 1024)}KB</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer row INSIDE the box */}
            <div className="flex items-center justify-between  px-2.5">
              {/* Left: Camera */}
              <div className="flex items-center gap-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || uploading || selectedImages.length >= 3}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full 
                            text-slate-600 hover:text-slate-700 hover:bg-slate-100 
                            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Attach images"
                  type="button"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Right: Send */}
              <button
                onClick={handleSendWithImages}
                disabled={!canSend}
                className="inline-flex items-center justify-center w-6 h-6 rounded-full 
                          bg-slate-800 text-white hover:bg-slate-700
                          disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress (below box) */}
          {uploading && uploadProgress.total > 0 && (
            <div className="mt-2">
              <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-slate-600 h-2 transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {uploading && selectedImages.length === 0
                  ? `Processing images... ${uploadProgress.current}/${uploadProgress.total}`
                  : uploading
                  ? `Uploading images... ${uploadProgress.current}/${uploadProgress.total}`
                  : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
