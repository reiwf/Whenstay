import { useState, useCallback, useEffect, useRef } from 'react'
import { adminAPI } from '../services/api'
import { getSupabaseAdminClient, checkSupabaseEnvironment } from '../services/supabaseClient'
import toast from 'react-hot-toast'
import { useDebounce } from './useDebounce'

// Check environment variables and get admin client
checkSupabaseEnvironment()
const supabase = getSupabaseAdminClient()

if (!supabase) {
  console.error('Failed to initialize Supabase admin client')
}

export function useRealtimeCommunication() {
  const [loading, setLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [threadChannels, setThreadChannels] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [reservation, setReservation] = useState(null)
  const [groupBookingInfo, setGroupBookingInfo] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  
  // Cache state for performance optimization
  const [channelsCache, setChannelsCache] = useState(new Map())
  const [reservationCache, setReservationCache] = useState(new Map())
  const [pendingThreadSelection, setPendingThreadSelection] = useState(null)
  
  // PHASE 3C: Thread list caching for instant subsequent loads
  const [threadsCache, setThreadsCache] = useState(new Map())
  const [lastCacheTime, setLastCacheTime] = useState(null)
  const CACHE_TTL = 2 * 60 * 1000 // 2 minutes cache TTL
  
  // Refs for real-time subscriptions
  const threadsChannelRef = useRef(null)
  const messagesChannelRef = useRef(null)
  const globalMessagesChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const messageListRef = useRef(null)
  const threadSelectionTimeoutRef = useRef(null)
  
  // Refs to track subscription state and prevent duplicate setups
  const subscriptionsInitialized = useRef(false)
  const isLoadingThreads = useRef(false)

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      })
    }
  }, [])

  // Setup real-time subscription for threads
  const setupThreadsSubscription = useCallback(() => {
    if (import.meta.env.MODE === 'development') {
      console.log('🔧 Setting up threads subscription...')
    }
    
    if (threadsChannelRef.current) {
      if (import.meta.env.MODE === 'development') {
        console.log('🧹 Removing existing threads channel')
      }
      supabase.removeChannel(threadsChannelRef.current)
      threadsChannelRef.current = null
    }

    threadsChannelRef.current = supabase
      .channel('message_threads_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads'
        },
        (payload) => {
          if (import.meta.env.MODE === 'development') {
            console.log('📨 Thread change received:', payload.eventType, payload.new?.id)
          }
          
          switch (payload.eventType) {
            case 'INSERT':
              setThreads(prev => [payload.new, ...prev])
              break
            case 'UPDATE':
              setThreads(prev => {
                const updatedThreads = prev.map(thread => 
                  thread.id === payload.new.id ? payload.new : thread
                )
                
                // If the updated thread is closed or archived, remove it from the list
                // since InboxPanel only shows 'open' threads by default
                if (payload.new.status !== 'open') {
                  if (import.meta.env.MODE === 'development') {
                    console.log(`Removing thread ${payload.new.id} from inbox (status: ${payload.new.status})`)
                  }
                  return updatedThreads.filter(thread => thread.id !== payload.new.id)
                }
                
                return updatedThreads
              })
              
              // Update selected thread if it's the one being updated
              setSelectedThread(prev => {
                if (prev?.id === payload.new.id) {
                  // If the updated thread is closed/archived and it's currently selected, clear selection
                  if (payload.new.status !== 'open') {
                    if (import.meta.env.MODE === 'development') {
                      console.log(`Clearing selection for closed/archived thread ${payload.new.id}`)
                    }
                    setMessages([])
                    setReservation(null)
                    setGroupBookingInfo(null)
                    
                    // Cleanup subscriptions
                    if (messagesChannelRef.current) {
                      supabase.removeChannel(messagesChannelRef.current)
                      messagesChannelRef.current = null
                    }
                    
                    return null
                  }
                  return payload.new
                }
                return prev
              })
              break
            case 'DELETE':
              setThreads(prev => prev.filter(thread => thread.id !== payload.old.id))
              // Clear selection if deleted thread was selected
              setSelectedThread(prev => 
                prev?.id === payload.old.id ? null : prev
              )
              if (selectedThread?.id === payload.old.id) {
                setMessages([])
                setReservation(null)
                setGroupBookingInfo(null)
              }
              break
          }
        }
      )
      .subscribe((status) => {
        if (import.meta.env.MODE === 'development') {
          console.log('📡 Threads subscription status:', status)
        }
        setConnectionStatus(status)
      })
      
    if (import.meta.env.MODE === 'development') {
      console.log('✅ Threads subscription setup complete')
    }
  }, []) // Remove selectedThread dependency to prevent recreating subscription

  // Setup global real-time subscription for message delivery status updates
  const setupGlobalDeliverySubscription = useCallback(() => {
    console.log('🔧 Setting up global delivery subscription...')
    
    if (globalMessagesChannelRef.current) {
      console.log('🧹 Removing existing global delivery channel')
      supabase.removeChannel(globalMessagesChannelRef.current)
      globalMessagesChannelRef.current = null
    }

    globalMessagesChannelRef.current = supabase
      .channel('global_message_deliveries')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_deliveries'
        },
        (payload) => {
          console.log('🔔 GLOBAL DELIVERY STATUS UPDATE received:', {
            messageId: payload.new.message_id,
            status: payload.new.status,
            channel: payload.new.channel,
            timestamp: new Date().toISOString()
          })
          
          setMessages(prev => 
            prev.map(msg => {
              if (msg.id === payload.new.message_id) {
                console.log('✅ Updating delivery status for message:', msg.id, 'to:', payload.new.status)
                
                const updatedDeliveries = msg.message_deliveries?.map(delivery => 
                  delivery.channel === payload.new.channel 
                    ? { ...delivery, ...payload.new }
                    : delivery
                ) || [payload.new]
                
                return { ...msg, message_deliveries: updatedDeliveries }
              }
              return msg
            })
          )
        }
      )
      .subscribe((status) => {
        console.log('📡 Global delivery subscription status:', status)
      })
      
    console.log('✅ Global delivery subscription setup complete')
  }, [])

  // Setup real-time subscription for messages in selected thread
  const setupMessagesSubscription = useCallback((threadId) => {
    console.log('🔧 Setting up messages subscription for thread:', threadId)
    
    if (messagesChannelRef.current) {
      console.log('🧹 Removing existing messages channel')
      supabase.removeChannel(messagesChannelRef.current)
      messagesChannelRef.current = null
    }

    if (!threadId) {
      console.log('⚠️ No threadId provided, skipping subscription setup')
      return
    }

    const channelName = `messages_thread_${threadId}`
    console.log('📡 Creating channel:', channelName)

    messagesChannelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('📨 New message received for thread:', threadId, 'Message ID:', payload.new.id)
          
          const newMessage = payload.new
          
          // Skip processing if this message is from our own optimistic update
          if (newMessage.id.startsWith('temp_')) {
            console.log('⏭️ Skipping temp message from real-time:', newMessage.id)
            return
          }
          
          setMessages(prev => {
            // Check for existing message by ID
            const existingIndex = prev.findIndex(msg => msg.id === newMessage.id)
            if (existingIndex !== -1) {
              // Message already exists - this happens when real-time fires after optimistic update
              console.log('⚠️ Duplicate message detected via real-time:', newMessage.id, '- skipping')
              return prev
            }
            
            // Check if this message replaces a temp message that was just sent
            const tempMessageIndex = prev.findIndex(msg => 
              msg.id.startsWith('temp_') && 
              msg.thread_id === newMessage.thread_id &&
              msg.content === newMessage.content &&
              msg.origin_role === newMessage.origin_role
            )
            
            if (tempMessageIndex !== -1) {
              // Replace the temp message with the real one
              console.log('🔄 Replacing temp message with real message:', newMessage.id)
              const updated = [...prev]
              updated[tempMessageIndex] = newMessage
              return updated
            }
            
            // This is a genuine new message (usually incoming)
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Admin: Added new message:', newMessage.id, 'from', newMessage.origin_role)
            }
            return [...prev, newMessage]
          })
          
          // Auto-scroll to new message
          setTimeout(() => scrollToBottom(), 100)
          
          // Show notification for incoming messages
          if (newMessage.direction === 'incoming') {
            toast.success(`New message from ${newMessage.origin_role}`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('📝 Message updated for thread:', threadId, 'Message ID:', payload.new.id)
          
          // Update the message in local state
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.new.id ? { ...msg, ...payload.new } : msg
            )
          )
        }
      )
      .on(
        'broadcast',
        { event: 'message_unsent' },
        (payload) => {
          console.log('🗑️ Message unsent event received:', payload)
          
          // Update the message to show as unsent
          setMessages(prev => 
            prev.map(msg => 
              msg.id === payload.messageId 
                ? { ...msg, is_unsent: true, unsent_at: payload.timestamp }
                : msg
            )
          )
          
          // Show notification
          toast.success('Message unsent successfully')
        }
      )
      .subscribe((status) => {
        console.log('📡 Messages subscription status:', status, 'for thread:', threadId)
      })
      
    console.log('✅ Messages subscription setup complete for thread:', threadId)
  }, [scrollToBottom])

  // Typing indicator functionality
  const sendTypingIndicator = useCallback((threadId, isTyping) => {
    if (!threadId) return

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (isTyping) {
      // Send typing event via presence
      supabase
        .channel(`typing_${threadId}`)
        .track({
          user_id: 'current_user', // In real app, get from auth context
          typing: true,
          timestamp: new Date().toISOString()
        })
        .subscribe()

      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingIndicator(threadId, false)
      }, 3000)
    } else {
      supabase
        .channel(`typing_${threadId}`)
        .untrack()
        .subscribe()
    }
  }, [])

  // OPTIMIZED: Progressive + cached loading WITHOUT subscription setup
  const loadThreads = useCallback(async (params = {}) => {
    // Prevent concurrent loading
    if (isLoadingThreads.current) {
      console.log('⚠️ Thread loading already in progress, skipping duplicate request');
      return threads;
    }
    
    const cacheKey = JSON.stringify(params || {});
    const now = Date.now();
    
    try {
      isLoadingThreads.current = true;
      console.log('🚀 Progressive thread loading started');
      
      // STAGE 0: INSTANT CACHE CHECK - show cached data immediately if available
      if (threadsCache.has(cacheKey) && lastCacheTime && (now - lastCacheTime) < CACHE_TTL) {
        console.log('⚡ INSTANT: Using cached threads data');
        const cachedThreads = threadsCache.get(cacheKey);
        setThreads(cachedThreads);
        setLoading(false);
        
        // Still fetch fresh data in background for next time (but no subscriptions here)
        console.log('🔄 Background refresh started...');
        adminAPI.getCommunicationThreads(params)
          .then(response => {
            const freshThreads = response.data.threads || [];
            const processedThreads = freshThreads.map(thread => ({
              ...thread,
              unread_count: thread.unread_count || 0
            }));
            
            // Update cache and state with fresh data
            setThreadsCache(prev => new Map(prev).set(cacheKey, processedThreads));
            setLastCacheTime(now);
            setThreads(processedThreads);
            console.log('✅ Background refresh complete');
          })
          .catch(error => {
            console.warn('Background refresh failed:', error);
          })
          .finally(() => {
            isLoadingThreads.current = false;
          });
        
        return cachedThreads;
      }
      
      // STAGE 1: Fresh data fetch with loading indicator
      setLoading(true);
      console.log('⚡ Stage 1: Loading fresh thread data...');
      
      const response = await adminAPI.getCommunicationThreads(params);
      const threadsData = response.data.threads || [];
      
      // Process threads data
      const processedThreads = threadsData.map(thread => ({
        ...thread,
        unread_count: thread.unread_count || 0
      }));
      
      // Update cache
      setThreadsCache(prev => new Map(prev).set(cacheKey, processedThreads));
      setLastCacheTime(now);
      
      // Clear old cache entries (keep only last 3 to prevent memory bloat)
      if (threadsCache.size > 3) {
        const oldestKey = Array.from(threadsCache.keys())[0];
        setThreadsCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(oldestKey);
          return newCache;
        });
      }
      
      // Immediately show threads
      setThreads(processedThreads);
      setLoading(false);
      
      console.log(`✅ Stage 1 complete: ${processedThreads.length} threads displayed & cached`);
      console.log('🎯 Progressive + cached loading complete');
      return processedThreads;
      
    } catch (error) {
      console.error('Error loading threads:', error);
      toast.error('Failed to load message threads');
      
      // Fallback to cache if network fails
      if (threadsCache.has(cacheKey)) {
        console.log('🛡️ Network failed, falling back to cache');
        const cachedThreads = threadsCache.get(cacheKey);
        setThreads(cachedThreads);
        setLoading(false);
        toast.success('Showing cached conversations');
        return cachedThreads;
      }
      
      throw error;
    } finally {
      isLoadingThreads.current = false;
    }
  }, [threadsCache, lastCacheTime, CACHE_TTL, threads])

  // Load messages for a thread with real-time setup
  const loadMessages = useCallback(async (threadId, params = {}) => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommunicationMessages(threadId, params)
      const messagesData = response.data.messages || []
      setMessages(messagesData)
      
      // Setup real-time subscription for messages
      setupMessagesSubscription(threadId)
      
      // Note: Removed auto-scroll here - MessagePanel now handles initial scroll on thread selection
      
      return messagesData
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
      throw error
    } finally {
      setLoading(false)
    }
  }, [setupMessagesSubscription])

  // Send a new message with optimistic updates
  const sendMessage = useCallback(async (threadId, messageData) => {
    // Declare optimisticMessage in the outer scope so it's accessible in catch block
    let optimisticMessage = null;
    
    try {
      const currentTime = new Date().toISOString()
      
      // Optimistic update - add message immediately
      optimisticMessage = {
        id: `temp_${Date.now()}`,
        thread_id: threadId,
        content: messageData.content,
        channel: messageData.channel,
        direction: 'outgoing',
        origin_role: 'host',
        created_at: currentTime,
        message_deliveries: [{ status: 'sending', channel: messageData.channel }]
      }
      
      setMessages(prev => [...prev, optimisticMessage])
      setTimeout(() => scrollToBottom(), 50)

      // Optimistically update thread metadata
      setThreads(prev => {
        const updated = prev.map(thread => {
          if (thread.id === threadId) {
            return {
              ...thread,
              last_message_at: currentTime,
              last_message_preview: messageData.content.substring(0, 160),
              // Don't change unread_count for outgoing messages
            }
          }
          return thread
        })
        
        // Sort threads by last_message_at in descending order (most recent first)
        return updated.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
      })

      // Send to server
      const response = await adminAPI.sendCommunicationMessage(threadId, messageData)
      const newMessage = response.data.message
      
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id ? newMessage : msg
        )
      )
      
      // Update thread metadata with real message data
      setThreads(prev => {
        const updated = prev.map(thread => {
          if (thread.id === threadId) {
            return {
              ...thread,
              last_message_at: newMessage.created_at,
              last_message_preview: newMessage.content.substring(0, 160),
            }
          }
          return thread
        })
        
        // Sort threads by last_message_at in descending order (most recent first)
        return updated.sort((a, b) => {
          const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
          const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
      })
      
      console.log('✅ Message sent and thread updated:', { threadId, messageId: newMessage.id })
      toast.success('Message sent successfully')
      return newMessage
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Remove optimistic message on error (only if it was created)
      if (optimisticMessage) {
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
        
        // Revert optimistic thread update on error
        setThreads(prev => {
          const updated = prev.map(thread => {
            if (thread.id === threadId) {
              // Find the previous message to restore metadata
              const threadMessages = messages.filter(msg => msg.thread_id === threadId && msg.id !== optimisticMessage.id)
              const lastMessage = threadMessages[threadMessages.length - 1]
              
              if (lastMessage) {
                return {
                  ...thread,
                  last_message_at: lastMessage.created_at,
                  last_message_preview: lastMessage.content.substring(0, 160),
                }
              }
            }
            return thread
          })
          
          return updated.sort((a, b) => {
            const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
            const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
            return bTime - aTime;
          });
        })
      }
      
      toast.error('Failed to send message')
      throw error
    }
  }, [scrollToBottom, messages])

  // Update thread status
  const updateThreadStatus = useCallback(async (threadId, status) => {
    try {
      const response = await adminAPI.updateCommunicationThreadStatus(threadId, status)
      const updatedThread = response.data.thread
      
      // Update local state
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId ? updatedThread : thread
        )
      )
      
      // If current thread is updated and archived/closed, clear selection
      if (selectedThread?.id === threadId && status !== 'open') {
        setSelectedThread(null)
        setMessages([])
        setReservation(null)
        setGroupBookingInfo(null)
        
        // Cleanup subscriptions
        if (messagesChannelRef.current) {
          supabase.removeChannel(messagesChannelRef.current)
          messagesChannelRef.current = null
        }
      }
      
      toast.success(`Thread ${status} successfully`)
      return updatedThread
    } catch (error) {
      console.error('Error updating thread status:', error)
      toast.error('Failed to update thread status')
      throw error
    }
  }, [selectedThread])

  // Bulk update thread status
  const bulkUpdateThreadStatus = useCallback(async (threadIds, status) => {
    if (!threadIds || threadIds.length === 0) return

    const failedUpdates = []
    const successfulUpdates = []
    
    try {
      // Process threads sequentially to avoid overwhelming the API
      for (const threadId of threadIds) {
        try {
          const response = await adminAPI.updateCommunicationThreadStatus(threadId, status)
          successfulUpdates.push(response.data.thread)
        } catch (error) {
          console.error(`Failed to update thread ${threadId}:`, error)
          failedUpdates.push(threadId)
        }
      }

      // Update local state for successful updates
      if (successfulUpdates.length > 0) {
        setThreads(prev => 
          prev.map(thread => {
            const updatedThread = successfulUpdates.find(updated => updated.id === thread.id)
            return updatedThread || thread
          })
        )

        // If current thread is in the successful updates and archived/closed, clear selection
        const currentThreadUpdated = successfulUpdates.find(thread => thread.id === selectedThread?.id)
        if (currentThreadUpdated && status !== 'open') {
          setSelectedThread(null)
          setMessages([])
          setReservation(null)
          setGroupBookingInfo(null)
          
          // Cleanup subscriptions
          if (messagesChannelRef.current) {
            supabase.removeChannel(messagesChannelRef.current)
            messagesChannelRef.current = null
          }
        }
      }

      // Show appropriate notifications
      if (successfulUpdates.length > 0 && failedUpdates.length === 0) {
        toast.success(`Successfully ${status} ${successfulUpdates.length} thread${successfulUpdates.length > 1 ? 's' : ''}`)
      } else if (successfulUpdates.length > 0 && failedUpdates.length > 0) {
        toast.success(`${successfulUpdates.length} thread${successfulUpdates.length > 1 ? 's' : ''} ${status} successfully`)
        toast.error(`Failed to ${status.replace('ed', '')} ${failedUpdates.length} thread${failedUpdates.length > 1 ? 's' : ''}`)
      } else if (failedUpdates.length > 0) {
        toast.error(`Failed to ${status.replace('ed', '')} all selected threads`)
      }

      return {
        successful: successfulUpdates,
        failed: failedUpdates
      }
    } catch (error) {
      console.error('Error in bulk update:', error)
      toast.error('Failed to update threads')
      throw error
    }
  }, [selectedThread])

  // Load available channels for a thread with caching
  const loadThreadChannels = useCallback(async (threadId) => {
    try {
      // Check cache first
      if (channelsCache.has(threadId)) {
        console.log('📦 Using cached channels for thread:', threadId);
        const cachedChannels = channelsCache.get(threadId);
        setThreadChannels(cachedChannels);
        return cachedChannels;
      }
      
      const response = await adminAPI.getCommunicationThreadChannels(threadId);
      const channelsData = response.data.channels || [];
      
      // Cache the result (TTL: 5 minutes)
      setChannelsCache(prev => new Map(prev).set(threadId, channelsData));
      setThreadChannels(channelsData);
      
      // Clear cache after 5 minutes
      setTimeout(() => {
        setChannelsCache(prev => {
          const newCache = new Map(prev);
          newCache.delete(threadId);
          return newCache;
        });
      }, 5 * 60 * 1000);
      
      return channelsData;
    } catch (error) {
      console.error('Error loading thread channels:', error);
      return ['inapp']; // Default fallback
    }
  }, [channelsCache]);

  // Optimistic mark messages as read - immediate UI update, background sync
  const markMessagesRead = useCallback(async (threadId, lastMessageId) => {
    // Get original thread state for potential rollback
    const originalThread = threads.find(t => t.id === threadId);
    
    try {
      // Immediate optimistic update - this provides instant UI feedback
      console.log('⚡ Optimistic mark-as-read for thread:', threadId);
      
      // Update unread count in threads list immediately
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId 
            ? { ...thread, unread_count: 0 }
            : thread
        )
      );
      
      // Update message read status immediately
      setMessages(prev => 
        prev.map(msg => {
          if (msg.direction === 'incoming' && msg.thread_id === threadId) {
            const updatedDeliveries = msg.message_deliveries?.map(delivery => 
              delivery.channel === 'inapp' 
                ? { ...delivery, status: 'read', read_at: new Date().toISOString() }
                : delivery
            ) || [{ channel: 'inapp', status: 'read', read_at: new Date().toISOString() }];
            return { ...msg, message_deliveries: updatedDeliveries };
          }
          return msg;
        })
      );
      
      // Trigger global unread count update immediately via custom event
      console.log('🔄 Triggering global unread count update via custom event');
      window.dispatchEvent(new CustomEvent('thread-messages-read', { 
        detail: { threadId, lastMessageId }
      }));
      
      // Background sync with server (non-blocking)
      adminAPI.markCommunicationMessagesRead(threadId, lastMessageId)
        .then(() => {
          console.log('✅ Mark-as-read synced with server for thread:', threadId);
        })
        .catch((error) => {
          console.error('❌ Failed to sync mark-as-read with server:', error);
          
          // Rollback optimistic update on server error
          if (originalThread) {
            setThreads(prev => 
              prev.map(thread => 
                thread.id === threadId ? originalThread : thread
              )
            );
            
            // Revert message read status
            setMessages(prev => 
              prev.map(msg => {
                if (msg.direction === 'incoming' && msg.thread_id === threadId) {
                  const revertedDeliveries = msg.message_deliveries?.map(delivery => 
                    delivery.channel === 'inapp' 
                      ? { ...delivery, status: 'delivered', read_at: null }
                      : delivery
                  ) || [];
                  return { ...msg, message_deliveries: revertedDeliveries };
                }
                return msg;
              })
            );
            
            toast.error('Failed to mark messages as read');
          }
        });
      
      return true;
    } catch (error) {
      console.error('Error in optimistic mark-as-read:', error);
      
      // Rollback optimistic update on immediate error
      if (originalThread) {
        setThreads(prev => 
          prev.map(thread => 
            thread.id === threadId ? originalThread : thread
          )
        );
      }
      
      return false;
    }
  }, [threads, messages]);

  // Mark a specific message as read
  const markMessageAsRead = useCallback(async (messageId, channel = 'inapp') => {
    try {
      await adminAPI.markCommunicationMessageRead(messageId, channel)
      
      // Update message delivery status in local state
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            const updatedDeliveries = msg.message_deliveries?.map(delivery => 
              delivery.channel === channel 
                ? { ...delivery, status: 'read', read_at: new Date().toISOString() }
                : delivery
            ) || []
            return { ...msg, message_deliveries: updatedDeliveries }
          }
          return msg
        })
      )

      return true
    } catch (error) {
      console.error('Error marking message as read:', error)
      return false
    }
  }, [])

  // Mark all unread messages in thread as read
  const markAllMessagesAsRead = useCallback(async (threadId, beforeMessageId = null) => {
    try {
      const response = await fetch(`/api/communication/threads/${threadId}/read-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ before_message_id: beforeMessageId })
      })

      if (!response.ok) {
        throw new Error('Failed to mark messages as read')
      }

      const result = await response.json()

      // Update delivery status for all relevant messages
      setMessages(prev => 
        prev.map(msg => {
          if (msg.direction === 'incoming') {
            const currentStatus = msg.message_deliveries?.[0]?.status
            if (currentStatus !== 'read') {
              const updatedDeliveries = msg.message_deliveries?.map(delivery => 
                delivery.channel === 'inapp' 
                  ? { ...delivery, status: 'read', read_at: new Date().toISOString() }
                  : delivery
              ) || []
              return { ...msg, message_deliveries: updatedDeliveries }
            }
          }
          return msg
        })
      )

      // Update thread unread count
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId 
            ? { ...thread, unread_count: 0 }
            : thread
        )
      )

      return result
    } catch (error) {
      console.error('Error marking all messages as read:', error)
      return false
    }
  }, [])

  // Load message templates
  const loadTemplates = useCallback(async (params = {}) => {
    try {
      const response = await adminAPI.getCommunicationTemplates(params)
      const templatesData = response.data.templates || []
      setTemplates(templatesData)
      return templatesData
    } catch (error) {
      console.error('Error loading templates:', error)
      toast.error('Failed to load templates')
      return []
    }
  }, [])

  // Schedule a message
  const scheduleMessage = useCallback(async (scheduleData) => {
    try {
      const response = await adminAPI.scheduleCommunicationMessage(scheduleData)
      toast.success('Message scheduled successfully')
      return response.data.scheduled_message
    } catch (error) {
      console.error('Error scheduling message:', error)
      toast.error('Failed to schedule message')
      throw error
    }
  }, [])

  // Create a new thread
  const createThread = useCallback(async (threadData) => {
    try {
      const response = await adminAPI.createCommunicationThread(threadData)
      const newThread = response.data.thread
      
      // Add to local state
      setThreads(prev => [newThread, ...prev])
      
      toast.success('Thread created successfully')
      return newThread
    } catch (error) {
      console.error('Error creating thread:', error)
      toast.error('Failed to create thread')
      throw error
    }
  }, [])

  // Load reservation details for a thread with caching
  const loadReservationDetails = useCallback(async (reservationId) => {
    if (!reservationId) {
      setReservation(null)
      setGroupBookingInfo(null)
      return null
    }
    
    try {
      // Check cache first
      if (reservationCache.has(reservationId)) {
        console.log('📦 Using cached reservation for ID:', reservationId);
        const cachedData = reservationCache.get(reservationId);
        setReservation(cachedData.reservation);
        setGroupBookingInfo(cachedData.groupBookingInfo);
        return cachedData.reservation;
      }
      
      const response = await adminAPI.getReservationDetails(reservationId)
      
      // Extract the actual reservation data from nested structure
      let reservationData = null
      
      if (response.data.data?.reservation) {
        reservationData = response.data.data.reservation
      } else if (response.data.reservation) {
        reservationData = response.data.reservation
      } else if (response.data.data && !response.data.data.message) {
        reservationData = response.data.data
      } else {
        reservationData = response.data
      }
      
      if (reservationData && typeof reservationData === 'object' && !reservationData.message && !reservationData.reservation) {
        setReservation(reservationData)
        if (process.env.NODE_ENV === 'development') {
          console.log('Reservation loaded successfully for ID:', reservationId)
        }
        
        // Load group booking information if this reservation is part of a group
        let groupBookingData = null;
        try {
          const groupResponse = await adminAPI.getGroupBookingInfo(reservationId)
          if (groupResponse.data && groupResponse.data.isGroupBooking) {
            groupBookingData = groupResponse.data;
            setGroupBookingInfo(groupBookingData)
            if (process.env.NODE_ENV === 'development') {
              console.log('Group booking info loaded for reservation:', reservationId)
            }
          } else {
            setGroupBookingInfo(null)
          }
        } catch (groupError) {
          console.warn('Failed to load group booking info:', groupError)
          setGroupBookingInfo(null)
        }
        
        // Cache the result (TTL: 10 minutes)
        const cacheData = {
          reservation: reservationData,
          groupBookingInfo: groupBookingData
        };
        setReservationCache(prev => new Map(prev).set(reservationId, cacheData));
        
        // Clear cache after 10 minutes
        setTimeout(() => {
          setReservationCache(prev => {
            const newCache = new Map(prev);
            newCache.delete(reservationId);
            return newCache;
          });
        }, 10 * 60 * 1000);
        
      } else {
        console.warn('Invalid reservation data structure received')
        setReservation({ error: true, message: 'Invalid reservation data structure returned from API' })
        setGroupBookingInfo(null)
      }
      
      return reservationData
    } catch (error) {
      console.error('Error loading reservation details:', error)
      
      // Set reservation to an error state instead of null to differentiate from loading
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load reservation details'
      setReservation({ error: true, message: errorMessage })
      setGroupBookingInfo(null)
      return null
    }
  }, [reservationCache]);

  // Optimized thread selection with immediate mark-as-read and parallel operations
  const selectThread = useCallback(async (thread) => {
    try {
      setSelectedThread(thread);
      setLoading(true);
      
      console.log('🚀 Optimized thread selection started for:', thread.id);
      
      // PHASE 1: IMMEDIATE MARK-AS-READ (highest priority for UX)
      // This provides instant visual feedback to the user
      if (thread.unread_count > 0) {
        console.log('⚡ Immediate mark-as-read for instant UI feedback');
        // Use optimistic mark-as-read for immediate response
        markMessagesRead(thread.id, thread.id); // Use thread.id as fallback message ID
      }
      
      // PHASE 2: CRITICAL DATA LOADING (blocking)
      // Load messages first since this is essential for the conversation view
      console.log('📥 Loading messages (critical path)');
      const loadedMessages = await loadMessages(thread.id);
      
      // PHASE 3: PARALLEL NON-CRITICAL OPERATIONS (non-blocking)
      // Load channels and reservation data in parallel since they're supplementary
      console.log('🔄 Starting parallel operations for supplementary data');
      
      const parallelOperations = [];
      
      // Add channels loading to parallel operations
      parallelOperations.push(
        loadThreadChannels(thread.id).catch(error => {
          console.warn('Non-critical: Failed to load channels:', error);
          return ['inapp']; // Fallback
        })
      );
      
      // Add reservation loading to parallel operations if needed
      if (thread.reservation_id) {
        parallelOperations.push(
          loadReservationDetails(thread.reservation_id).catch(error => {
            console.warn('Non-critical: Failed to load reservation:', error);
            setReservation({ error: true, message: 'Failed to load reservation details' });
            return null;
          })
        );
      } else {
        // Clear reservation data immediately if no reservation_id
        setReservation(null);
        setGroupBookingInfo(null);
      }
      
      // Execute parallel operations without blocking the UI
      Promise.allSettled(parallelOperations).then((results) => {
        console.log('✅ Parallel operations completed:', results.length, 'operations');
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.warn(`Parallel operation ${index} failed:`, result.reason);
          }
        });
      });
      
      // PHASE 4: REFINED MARK-AS-READ (if we have actual message data)
      // Update mark-as-read with precise last message ID if available
      if (thread.unread_count > 0 && loadedMessages && loadedMessages.length > 0) {
        const latestMessage = loadedMessages[loadedMessages.length - 1];
        console.log('🔍 Refining mark-as-read with actual latest message ID:', latestMessage.id);
        // Note: This will be handled optimistically, so no await needed
        markMessagesRead(thread.id, latestMessage.id);
      }
      
      console.log('🎯 Thread selection core operations completed');
      
    } catch (error) {
      console.error('❌ Error in optimized thread selection:', error);
      // Don't show error toast here as individual operations handle their own errors
    } finally {
      setLoading(false);
    }
  }, [loadMessages, loadThreadChannels, loadReservationDetails, markMessagesRead]);

  // Unsend a message with optimistic update
  const unsendMessage = useCallback(async (messageId) => {
    try {
      // Optimistic update - immediately mark message as unsent
      const originalMessages = [...messages];
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, is_unsent: true, unsent_at: new Date().toISOString() }
            : msg
        )
      );

      // Make API call
      const response = await fetch(`/api/communication/messages/${messageId}/unsend`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        // Revert optimistic update on error
        setMessages(originalMessages);
        
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Failed to unsend message';
        
        if (response.status === 403) {
          errorMessage = 'You can only unsend your own messages within 24 hours';
        } else if (response.status === 404) {
          errorMessage = 'Message not found';
        } else if (response.status === 409) {
          errorMessage = 'Message has already been unsent';
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }

      // Success - no need to update messages again since real-time will handle it
      toast.success('Message unsent successfully');
      return true;
    } catch (error) {
      console.error('Error unsending message:', error);
      throw error;
    }
  }, [messages]);

  // Refresh current data
  const refresh = useCallback(async () => {
    try {
      await loadThreads()
      if (selectedThread) {
        await loadMessages(selectedThread.id)
      }
    } catch (error) {
      console.error('Error refreshing:', error)
    }
  }, [loadThreads, loadMessages, selectedThread])

  // Initialize subscriptions once on mount (separate from data loading)
  useEffect(() => {
    if (!subscriptionsInitialized.current && supabase) {
      console.log('🔌 Initializing realtime subscriptions...');
      subscriptionsInitialized.current = true;
      
      // Setup threads and global delivery subscriptions
      setupThreadsSubscription();
      setupGlobalDeliverySubscription();
      
      console.log('✅ Realtime subscriptions initialized');
    }
  }, [setupThreadsSubscription, setupGlobalDeliverySubscription]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up realtime subscriptions on unmount...');
      
      if (threadsChannelRef.current) {
        supabase.removeChannel(threadsChannelRef.current)
        threadsChannelRef.current = null
      }
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current)
        messagesChannelRef.current = null
      }
      if (globalMessagesChannelRef.current) {
        supabase.removeChannel(globalMessagesChannelRef.current)
        globalMessagesChannelRef.current = null
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = null
      }
      
      // Reset initialization flag to allow re-initialization if component remounts
      subscriptionsInitialized.current = false
      
      console.log('✅ Realtime subscriptions cleanup complete');
    }
  }, [])

  return {
    // State
    loading,
    threads,
    messages,
    threadChannels,
    templates,
    selectedThread,
    reservation,
    groupBookingInfo,
    typingUsers,
    connectionStatus,
    
    // Actions
    loadThreads,
    loadMessages,
    sendMessage,
    unsendMessage,
    updateThreadStatus,
    bulkUpdateThreadStatus,
    loadThreadChannels,
    markMessagesRead,
    markMessageAsRead,
    markAllMessagesAsRead,
    loadTemplates,
    scheduleMessage,
    createThread,
    loadReservationDetails,
    selectThread,
    refresh,
    sendTypingIndicator,
    scrollToBottom,
    
    // Refs for external use
    messageListRef,
    
    // State setters
    setSelectedThread,
    setMessages,
    setThreads,
    setThreadChannels
  }
}

export default useRealtimeCommunication
