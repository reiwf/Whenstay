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

          setMessages(prev => {
            const existingIndex = prev.findIndex(msg => msg.id === newMessage.id)
            if (existingIndex !== -1) {
              // Silently skip duplicates (React Strict Mode behavior)
              return prev
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
          setMessages(prev => prev.map(msg => {
            if (!msg.message_deliveries) return msg;
            const updated = msg.message_deliveries.map(d =>
              d.message_id === payload.new.message_id ? { ...d, ...payload.new } : d
            );
            return { ...msg, message_deliveries: updated };
          }));
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

    try {
      setSending(true)
      
      // Optimistic update - add message immediately
      const optimisticMessage = {
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
      
      // Replace optimistic message with real one
      setMessages(prev => 
        prev.map(msg => 
          msg.id === optimisticMessage.id ? newMessage : msg
        )
      )
      
      // Update thread's last message info if we have the thread
      if (thread) {
        setThread(prev => prev ? ({
          ...prev,
          last_message_at: newMessage.created_at,
          last_message_preview: content.substring(0, 160)
        }) : prev)
      }
      
      toast.success('Message sent successfully')
      return newMessage
    } catch (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id))
      
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      throw error
    } finally {
      setSending(false)
    }
  }, [token, thread, apiCall, scrollToBottom])

  // Initialize thread and load messages with real-time setup
  const initialize = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);

      const threadData = await loadThread();

      if (threadData?.id) {
        await loadMessages();
        // Setup real-time subscriptions after loading data
        setupMessagesSubscription(threadData.id);
        setupThreadSubscription(threadData.id);
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
