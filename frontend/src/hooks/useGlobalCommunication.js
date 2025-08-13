import { useState, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { adminAPI } from '../services/api'

// Initialize Supabase client for global notifications
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey)

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
    console.log('🔧 Setting up global unread count subscription...')
    
    if (threadsChannelRef.current) {
      console.log('🧹 Removing existing global threads channel')
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
          loadUnreadCount()
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
            loadUnreadCount()
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Global unread count subscription status:', status)
      })
      
    console.log('✅ Global unread count subscription setup complete')
  }, [loadUnreadCount])

  // Initialize on mount
  useEffect(() => {
    loadUnreadCount()
    setupUnreadCountSubscription()
    
    // Cleanup on unmount
    return () => {
      if (threadsChannelRef.current) {
        supabase.removeChannel(threadsChannelRef.current)
      }
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
