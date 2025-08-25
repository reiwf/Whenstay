import { useState, useCallback, useEffect, useRef } from 'react'
import { getSupabaseAdminClient } from '../services/supabaseClient'
import { adminAPI } from '../services/api'

// Get Supabase admin client from singleton service for global notifications
const supabase = getSupabaseAdminClient()

if (!supabase) {
  console.error('Failed to initialize Supabase admin client for global communication')
}

export function useGlobalCommunication() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const threadsChannelRef = useRef(null)

  // Load unread count
  const loadUnreadCount = useCallback(async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommunicationThreads()
      const threads = response.data.threads || []
      
      // Calculate total unread count
      const totalUnread = threads.reduce((sum, thread) => {
        return sum + (thread.unread_count || 0)
      }, 0)
      
      setUnreadCount(totalUnread)
      return totalUnread
    } catch (error) {
      console.error('Error loading unread count:', error)
      return 0
    } finally {
      setLoading(false)
    }
  }, [])

  // Setup real-time subscription for unread count updates
  const setupUnreadCountSubscription = useCallback(() => {
    // console.log('🔧 Setting up global unread count subscription...')
    
    if (threadsChannelRef.current) {
      // console.log('🧹 Removing existing global threads channel')
      supabase.removeChannel(threadsChannelRef.current)
      threadsChannelRef.current = null
    }

    threadsChannelRef.current = supabase
      .channel('global_message_threads_unread')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads'
        },
        (payload) => {
          console.log('📨 Global thread change received for unread count:', payload.eventType)
          
          // Reload unread count when threads change
          setTimeout(() => loadUnreadCount(), 100) // Small delay to ensure DB consistency
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('📨 New message received globally:', payload.new.id)
          
          // If it's an incoming message, reload unread count
          if (payload.new.direction === 'incoming') {
            setTimeout(() => loadUnreadCount(), 100) // Small delay to ensure DB consistency
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
          console.log('📨 Message delivery status updated globally:', payload.new.message_id, 'status:', payload.new.status)
          
          // If delivery status changes (especially to 'delivered' for new messages), reload unread count
          if (payload.new.status === 'delivered' || payload.new.status === 'read') {
            setTimeout(() => loadUnreadCount(), 100) // Small delay to ensure DB consistency
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_participants'
        },
        (payload) => {
          console.log('📨 Message participant updated globally:', {
            threadId: payload.new.thread_id, 
            lastReadAt: payload.new.last_read_at,
            oldLastReadAt: payload.old?.last_read_at
          })
          
          // If last_read_at is updated (messages marked as read), reload unread count
          if (payload.new.last_read_at && payload.new.last_read_at !== payload.old?.last_read_at) {
            // console.log('🔄 Reloading global unread count due to message participant read status change')
            setTimeout(() => loadUnreadCount(), 100) // Small delay to ensure DB consistency
          }
        }
      )
      .subscribe((status) => {
        // console.log('📡 Global unread count subscription status:', status)
      })
      
    // console.log('✅ Global unread count subscription setup complete')
  }, [loadUnreadCount])

  // Initialize on mount
  useEffect(() => {
    loadUnreadCount()
    setupUnreadCountSubscription()
    
    // Listen for custom events from the local communication hook
    const handleThreadMessagesRead = (event) => {
      console.log('🔄 Received thread-messages-read event:', event.detail)
      // Immediately refresh the global unread count
      setTimeout(() => loadUnreadCount(), 50) // Small delay to ensure database update is processed
    }
    
    window.addEventListener('thread-messages-read', handleThreadMessagesRead)
    
    // Cleanup on unmount
    return () => {
      if (threadsChannelRef.current) {
        supabase.removeChannel(threadsChannelRef.current)
      }
      window.removeEventListener('thread-messages-read', handleThreadMessagesRead)
    }
  }, [loadUnreadCount, setupUnreadCountSubscription])

  return {
    unreadCount,
    loading,
    loadUnreadCount,
    refresh: loadUnreadCount
  }
}

export default useGlobalCommunication
