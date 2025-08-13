import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

// Initialize Supabase clients - Debug environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

console.log('🔧 Environment variables check:', {
  url: supabaseUrl ? 'loaded' : 'missing',
  anonKey: supabaseAnonKey ? 'loaded' : 'missing', 
  serviceKey: supabaseServiceKey ? 'loaded' : 'missing'
})

// Use service role client for admin operations (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

if (supabaseServiceKey) {
  console.log('🔧 Admin Supabase client initialized with service role key')
} else {
  console.log('⚠️ Admin Supabase client falling back to anonymous key - service key not loaded!')
}

export function useRealtimeCommunication() {
  const [loading, setLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [threadChannels, setThreadChannels] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [reservation, setReservation] = useState(null)
  const [typingUsers, setTypingUsers] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  
  // Refs for real-time subscriptions
  const threadsChannelRef = useRef(null)
  const messagesChannelRef = useRef(null)
  const globalMessagesChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const messageListRef = useRef(null)

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
    if (threadsChannelRef.current) {
      supabase.removeChannel(threadsChannelRef.current)
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
          console.log('Thread change received:', payload)
          
          switch (payload.eventType) {
            case 'INSERT':
              setThreads(prev => [payload.new, ...prev])
              break
            case 'UPDATE':
              setThreads(prev => 
                prev.map(thread => 
                  thread.id === payload.new.id ? payload.new : thread
                )
              )
              // Update selected thread if it's the one being updated
              if (selectedThread?.id === payload.new.id) {
                setSelectedThread(payload.new)
              }
              break
            case 'DELETE':
              setThreads(prev => prev.filter(thread => thread.id !== payload.old.id))
              // Clear selection if deleted thread was selected
              if (selectedThread?.id === payload.old.id) {
                setSelectedThread(null)
                setMessages([])
                setReservation(null)
              }
              break
          }
        }
      )
      .subscribe((status) => {
        console.log('Threads subscription status:', status)
        setConnectionStatus(status)
      })
  }, [selectedThread])

  // Setup real-time subscription for messages in selected thread
  const setupMessagesSubscription = useCallback((threadId) => {
    console.log('🔧 Setting up messages subscription for thread:', threadId)
    
    if (messagesChannelRef.current) {
      console.log('🧹 Removing existing messages channel')
      supabase.removeChannel(messagesChannelRef.current)
    }

    if (!threadId) {
      console.log('⚠️ No threadId provided, skipping subscription setup')
      return
    }

    const channelName = `messages_thread_${threadId}`
    console.log('📡 Creating channel:', channelName)
    console.log('🎯 Filter:', `thread_id=eq.${threadId}`)

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
          console.log('🔥 ADMIN: New message received:', payload)
          console.log('📋 Message details:', {
            id: payload.new.id,
            thread_id: payload.new.thread_id,
            direction: payload.new.direction,
            origin_role: payload.new.origin_role,
            content: payload.new.content?.substring(0, 50) + '...'
          })
          
          const newMessage = payload.new
          
          console.log('✅ Message is for current thread, processing...')
          
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(msg => msg.id === newMessage.id)) {
              console.log('⚠️ Duplicate message detected, skipping:', newMessage.id)
              return prev
            }
            console.log('✅ Adding new message to state:', newMessage.id)
            return [...prev, newMessage]
          })
          
          // Auto-scroll to new message after a brief delay
          setTimeout(() => scrollToBottom(), 100)
          
          // Show notification for incoming messages (not from current user)
          if (newMessage.direction === 'incoming' || newMessage.origin_role === 'guest') {
            toast.success(`New message from ${newMessage.origin_role}`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_deliveries'
        },
        (payload) => {
          console.log('Message delivery updated:', payload)
          // Update delivery status in messages for the current thread
          setMessages(prev => 
            prev.map(msg => {
              if (!msg.message_deliveries) return msg;
              
              const updatedDeliveries = msg.message_deliveries.map(delivery => 
                delivery.message_id === payload.new.message_id 
                  ? { ...delivery, ...payload.new }
                  : delivery
              );
              
              // Check if any delivery was updated
              const hasUpdates = updatedDeliveries.some((delivery, index) => 
                delivery !== msg.message_deliveries[index]
              );
              
              return hasUpdates ? { ...msg, message_deliveries: updatedDeliveries } : msg;
            })
          )
        }
      )
      .subscribe((status) => {
        console.log('Messages subscription status:', status)
      })
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

  // Load message threads with real-time setup
  const loadThreads = useCallback(async (params = {}) => {
    try {
      setLoading(true)
      
      const response = await adminAPI.getCommunicationThreads(params)
      const threadsData = response.data.threads || []
      setThreads(threadsData)
      
      // Setup real-time subscriptions
      setupThreadsSubscription()
      
      return threadsData
    } catch (error) {
      console.error('Error loading threads:', error)
      toast.error('Failed to load message threads')
      throw error
    } finally {
      setLoading(false)
    }
  }, [setupThreadsSubscription])

  // Load messages for a thread with real-time setup
  const loadMessages = useCallback(async (threadId, params = {}) => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommunicationMessages(threadId, params)
      const messagesData = response.data.messages || []
      setMessages(messagesData)
      
      // Setup real-time subscription for messages
      setupMessagesSubscription(threadId)
      
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
  }, [setupMessagesSubscription, scrollToBottom])

  // Send a new message with optimistic updates
  const sendMessage = useCallback(async (threadId, messageData) => {
    try {
      const currentTime = new Date().toISOString()
      
      // Optimistic update - add message immediately
      const optimisticMessage = {
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
      // Remove optimistic message on error
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
      
      console.error('Error sending message:', error)
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

  // Load available channels for a thread
  const loadThreadChannels = useCallback(async (threadId) => {
    try {
      const response = await adminAPI.getCommunicationThreadChannels(threadId)
      const channelsData = response.data.channels || []
      setThreadChannels(channelsData)
      return channelsData
    } catch (error) {
      console.error('Error loading thread channels:', error)
      return ['inapp'] // Default fallback
    }
  }, [])

  // Mark messages as read
  const markMessagesRead = useCallback(async (threadId, lastMessageId) => {
    try {
      await adminAPI.markCommunicationMessagesRead(threadId, lastMessageId)
      
      // Update unread count in threads list
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId 
            ? { ...thread, unread_count: 0 }
            : thread
        )
      )
      
      return true
    } catch (error) {
      console.error('Error marking messages as read:', error)
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

  // Load reservation details for a thread
  const loadReservationDetails = useCallback(async (reservationId) => {
    if (!reservationId) {
      setReservation(null)
      return null
    }
    
    try {
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
      } else {
        console.warn('Invalid reservation data structure received')
        setReservation({ error: true, message: 'Invalid reservation data structure returned from API' })
      }
      
      return reservationData
    } catch (error) {
      console.error('Error loading reservation details:', error)
      
      // Set reservation to an error state instead of null to differentiate from loading
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load reservation details'
      setReservation({ error: true, message: errorMessage })
      return null
    }
  }, [])

  // Select a thread and load its details
  const selectThread = useCallback(async (thread) => {
    try {
      setSelectedThread(thread)
      setLoading(true)
      
      // Load messages for the thread (includes real-time setup)
      await loadMessages(thread.id)
      
      // Load available channels
      await loadThreadChannels(thread.id)
      
      // Load reservation details if available
      if (thread.reservation_id) {
        await loadReservationDetails(thread.reservation_id)
      } else {
        setReservation(null)
      }
      
      // Mark messages as read
      if (thread.unread_count > 0) {
        // Use a timeout to ensure messages are loaded first
        setTimeout(async () => {
          const currentMessages = messages
          if (currentMessages.length > 0) {
            const latestMessage = currentMessages[currentMessages.length - 1]
            await markMessagesRead(thread.id, latestMessage.id)
          }
        }, 500)
      }
      
    } catch (error) {
      console.error('Error selecting thread:', error)
    } finally {
      setLoading(false)
    }
  }, [loadMessages, loadThreadChannels, loadReservationDetails, markMessagesRead, messages])

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

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      if (threadsChannelRef.current) {
        supabase.removeChannel(threadsChannelRef.current)
      }
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current)
      }
      if (globalMessagesChannelRef.current) {
        supabase.removeChannel(globalMessagesChannelRef.current)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
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
    typingUsers,
    connectionStatus,
    
    // Actions
    loadThreads,
    loadMessages,
    sendMessage,
    updateThreadStatus,
    loadThreadChannels,
    markMessagesRead,
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
    setThreads
  }
}

export default useRealtimeCommunication
