import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function useGuestCommunication(token) {
  const [loading, setLoading] = useState(false)
  const [thread, setThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  
  // Refs for real-time subscriptions
  const messagesChannelRef = useRef(null)
  const threadChannelRef = useRef(null)
  const messageListRef = useRef(null)
  const currentSubscriptionThreadId = useRef(null)
  const currentThreadSubscriptionId = useRef(null)
  const processedMessageIds = useRef(new Set())

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback((smooth = true) => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'instant'
      })
    }
  }, [])

  // API call wrapper with error handling
  const apiCall = useCallback(async (url, options = {}) => {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Request failed')
    }

    return response.json()
  }, [])

  // Setup real-time subscription for messages in the guest's thread
  const setupMessagesSubscription = useCallback((threadId) => {
    const handlerId = Math.random().toString(36).substr(2, 9)
    console.log('🔧 Guest: Setting up messages subscription for thread:', threadId, 'Handler ID:', handlerId)
    
    // Check if we already have a subscription for this thread
    if (currentSubscriptionThreadId.current === threadId && messagesChannelRef.current) {
      console.log('✅ Guest: Subscription already exists for thread:', threadId, 'skipping setup')
      return
    }
    
    if (messagesChannelRef.current) {
      console.log('🧹 Guest: Removing existing messages channel')
      supabase.removeChannel(messagesChannelRef.current)
      messagesChannelRef.current = null
    }
    
    if (!threadId) {
      console.log('⚠️ Guest: No threadId provided, skipping subscription setup')
      currentSubscriptionThreadId.current = null
      return
    }

    const channelName = `guest_messages_thread_${threadId}`
    console.log('📡 Guest: Creating channel:', channelName)

    messagesChannelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const newMessage = payload.new;

          // Skip processing if this message is from our own optimistic update
          if (newMessage.id.startsWith('temp_')) {
            return
          }

          // Skip if we've already processed this message
          if (processedMessageIds.current.has(newMessage.id)) {
            console.log('🔄 Guest: Skipping duplicate message:', newMessage.id)
            return
          }

          // Mark as processed
          processedMessageIds.current.add(newMessage.id)

          setMessages(prev => {
            const existingIndex = prev.findIndex(msg => msg.id === newMessage.id)
            if (existingIndex !== -1) {
              // Update existing message with new data (in case of partial updates)
              const updated = [...prev]
              updated[existingIndex] = { ...updated[existingIndex], ...newMessage }
              return updated
            }
            
            // Check if this message already exists (including temporary IDs)
            const duplicateIndex = prev.findIndex(msg => 
              msg.content === newMessage.content && 
              msg.thread_id === newMessage.thread_id &&
              msg.origin_role === newMessage.origin_role &&
              Math.abs(new Date(msg.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 5000 // Within 5 seconds
            )
            
            if (duplicateIndex !== -1) {
              // Replace the duplicate (likely a temp message) with the real one
              const updated = [...prev]
              updated[duplicateIndex] = newMessage
              return updated
            }
            
            // Only log successful additions to reduce noise
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ Guest: Added new message:', newMessage.id, 'from', newMessage.origin_role)
            }
            return [...prev, newMessage]
          });

          // use functional update; don't close over `thread`
          setThread(prev => prev ? {
            ...prev,
            last_message_at: newMessage.created_at,
            last_message_preview: newMessage.content.substring(0, 160)
          } : prev);

          setTimeout(() => scrollToBottom(), 100);

          if (newMessage.origin_role === 'host' || newMessage.origin_role === 'admin') {
            toast.success('New message from support team', { duration: 3000, icon: '💬' });
          }
        }
      )
      .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'message_deliveries'
        },
        (payload) => {
          console.log('📱 Guest: Message delivery updated:', payload.new);
          setMessages(prev => {
            return prev.map(msg => {
              if (msg.id === payload.new.message_id) {
                const updatedDeliveries = msg.message_deliveries?.map(delivery => 
                  delivery.id === payload.new.id ? { ...delivery, ...payload.new } : delivery
                ) || [payload.new];
                return { ...msg, message_deliveries: updatedDeliveries };
              }
              return msg;
            });
          });
        }
      )
      .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'message_deliveries'
        },
        (payload) => {
          console.log('📱 Guest: New message delivery:', payload.new);
          setMessages(prev => {
            return prev.map(msg => {
              if (msg.id === payload.new.message_id) {
                const existingDeliveries = msg.message_deliveries || [];
                const deliveryExists = existingDeliveries.some(d => d.id === payload.new.id);
                if (!deliveryExists) {
                  return { ...msg, message_deliveries: [...existingDeliveries, payload.new] };
                }
              }
              return msg;
            });
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Guest: Messages subscription status:', status, 'for thread:', threadId);
        setConnectionStatus(status);
      });
      
    // Track the current subscription thread ID
    currentSubscriptionThreadId.current = threadId
    console.log('✅ Guest: Messages subscription setup complete for thread:', threadId)
  }, [scrollToBottom]);

  // Setup real-time subscription for thread updates
  const setupThreadSubscription = useCallback((threadId) => {
    console.log('🔧 Guest: Setting up thread subscription for thread:', threadId)
    
    // Check if we already have a thread subscription for this thread
    if (currentThreadSubscriptionId.current === threadId && threadChannelRef.current) {
      console.log('✅ Guest: Thread subscription already exists for thread:', threadId, 'skipping setup')
      return
    }
    
    if (threadChannelRef.current) {
      console.log('🧹 Guest: Removing existing thread channel')
      supabase.removeChannel(threadChannelRef.current)
      threadChannelRef.current = null
    }
    
    if (!threadId) {
      console.log('⚠️ Guest: No threadId provided, skipping thread subscription setup')
      currentThreadSubscriptionId.current = null
      return
    }

    const channelName = `guest_thread_${threadId}`
    console.log('📡 Guest: Creating thread channel:', channelName)

    threadChannelRef.current = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'message_threads',
        filter: `id=eq.${threadId}`
      }, (payload) => {
        console.log('📨 Guest: Thread updated:', threadId, payload.eventType);
        setThread(payload.new);
      })
      .subscribe((status) => {
        console.log('📡 Guest: Thread subscription status:', status, 'for thread:', threadId);
      });
      
    // Track the current thread subscription ID
    currentThreadSubscriptionId.current = threadId
    console.log('✅ Guest: Thread subscription setup complete for thread:', threadId)
  }, []);

  // Get or create communication thread for guest
  const loadThread = useCallback(async () => {
    if (!token) return null

    try {
      setLoading(true)
      const data = await apiCall(`/api/guest/${token}/thread`)
      setThread(data.thread)
      return data.thread
    } catch (error) {
      console.error('Error loading thread:', error)
      toast.error('Failed to load conversation')
      throw error
    } finally {
      setLoading(false)
    }
  }, [token, apiCall])

  // Load messages for the guest's thread
  const loadMessages = useCallback(async () => {
    if (!token) return []

    try {
      setLoading(true)
      const data = await apiCall(`/api/guest/${token}/thread/messages`)
      const messagesData = data.messages || []
      setMessages(messagesData)
      
      // Auto-scroll to bottom
      setTimeout(() => scrollToBottom(false), 100)
      
      return messagesData
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
      throw error
    } finally {
      setLoading(false)
    }
  }, [token, apiCall, scrollToBottom])

  // Send a new message with optimistic updates
  const sendMessage = useCallback(async (content, parentMessageId = null) => {
    if (!token || !content?.trim()) return null

    let optimisticMessage = null

    try {
      setSending(true)
      console.log(`📤 [GUEST SEND] Sending message, current thread:`, thread?.id || 'none')
      
      // Optimistic update - add message immediately
      optimisticMessage = {
        id: `temp_${Date.now()}`,
        thread_id: thread?.id,
        content: content.trim(),
        channel: 'inapp',
        direction: 'outgoing',
        origin_role: 'guest',
        created_at: new Date().toISOString(),
        message_deliveries: [{ status: 'sending', channel: 'inapp' }]
      }
      
      setMessages(prev => [...prev, optimisticMessage])
      setTimeout(() => scrollToBottom(), 50)

      // Send to server
      const data = await apiCall(`/api/guest/${token}/thread/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: content.trim(),
          parent_message_id: parentMessageId
        })
      })

      const newMessage = data.message
      const returnedThread = data.thread
      
      console.log(`✅ [GUEST SEND] Message sent successfully:`, newMessage.id)
      console.log(`🎯 [GUEST SEND] Thread info:`, returnedThread?.id || 'none')
      
      // Mark this message as processed to prevent real-time duplicate
      processedMessageIds.current.add(newMessage.id)
      
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id ? newMessage : msg
        )
      )
      
      // ENHANCED: Handle thread creation for first message
      if (returnedThread && (!thread || thread.id !== returnedThread.id)) {
        console.log(`🎉 [GUEST SEND] New thread created or updated: ${returnedThread.id}, setting up real-time subscriptions`)
        
        // Update thread state
        setThread(returnedThread)
        
        // Set up real-time subscriptions for the new thread
        setupMessagesSubscription(returnedThread.id)
        setupThreadSubscription(returnedThread.id)
      } else if (thread) {
        // Update existing thread's last message info
        setThread(prev => prev ? ({
          ...prev,
          last_message_at: newMessage.created_at,
          last_message_preview: content.substring(0, 160)
        }) : prev)
      }
      
      toast.success('Message sent successfully')
      return newMessage
    } catch (error) {
      // Remove optimistic message on error (only if it was created)
      if (optimisticMessage) {
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      }
      
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      throw error
    } finally {
      setSending(false)
    }
  }, [token, thread, apiCall, scrollToBottom, setupMessagesSubscription, setupThreadSubscription])

  // Initialize thread and load messages with real-time setup
  const initialize = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      console.log(`🚀 [GUEST COMM] Initializing guest communication for token: ${token}`);

      const threadData = await loadThread();

      if (threadData?.id) {
        console.log(`✅ [GUEST COMM] Found existing thread: ${threadData.id}, loading messages and setting up real-time`);
        await loadMessages();
        // Setup real-time subscriptions after loading data
        setupMessagesSubscription(threadData.id);
        setupThreadSubscription(threadData.id);
      } else {
        console.log(`📭 [GUEST COMM] No existing thread found, ready to create on first message`);
        // No thread exists yet - this is fine, it will be created when they send their first message
        // Don't set up subscriptions until thread exists
        setMessages([]); // Ensure we have empty messages array
      }
    } catch (error) {
      console.error('Error initializing guest communication:', error);
    } finally {
      setLoading(false);
    }
  }, [token, loadThread, loadMessages, setupMessagesSubscription, setupThreadSubscription]);

  // Mark messages as read for guest side
  const markMessageAsRead = useCallback(async (messageId) => {
    try {
      const response = await apiCall(`/api/guest/${token}/messages/${messageId}/read`, {
        method: 'POST'
      })
      
      // Update message delivery status in local state
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            const updatedDeliveries = msg.message_deliveries?.map(delivery => 
              delivery.channel === 'inapp' 
                ? { ...delivery, status: 'read', read_at: new Date().toISOString() }
                : delivery
            ) || []
            return { ...msg, message_deliveries: updatedDeliveries }
          }
          return msg
        })
      )

      return response
    } catch (error) {
      console.error('Error marking message as read:', error)
      return false
    }
  }, [token, apiCall])

  // Auto-mark messages as read when they become visible
  const autoMarkMessagesRead = useCallback((visibleMessages) => {
    visibleMessages.forEach(msg => {
      if (msg.direction === 'incoming' && msg.origin_role !== 'guest') {
        const currentStatus = msg.message_deliveries?.[0]?.status
        if (currentStatus && currentStatus !== 'read') {
          markMessageAsRead(msg.id)
        }
      }
    })
  }, [markMessageAsRead])

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      await loadMessages()
    } catch (error) {
      console.error('Error refreshing:', error)
    }
  }, [loadMessages])

  // Cleanup subscriptions on unmount or token change
  useEffect(() => {
    return () => {
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current)
        messagesChannelRef.current = null
      }
      if (threadChannelRef.current) {
        supabase.removeChannel(threadChannelRef.current)
        threadChannelRef.current = null
      }
      // Reset tracking refs
      currentSubscriptionThreadId.current = null
      currentThreadSubscriptionId.current = null
    }
  }, [token])

  return {
    // State
    loading,
    thread,
    messages,
    sending,
    connectionStatus,
    
    // Actions
    loadThread,
    loadMessages,
    sendMessage,
    initialize,
    refresh,
    scrollToBottom,
    markMessageAsRead,
    autoMarkMessagesRead,
    
    // Refs for external use
    messageListRef,
    
    // State setters for external updates
    setThread,
    setMessages
  }
}

export default useGuestCommunication
