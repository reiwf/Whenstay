import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function useGuestCommunication(token) {
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false);
  const [thread, setThread] = useState(null)
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  
  // Refs for real-time subscriptions
  const messagesChannelRef = useRef(null)
  const threadChannelRef = useRef(null)
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

  // API call wrapper with error handling
  const apiCall = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const ct = res.headers.get('content-type') || '';
    const isJSON = ct.includes('application/json');

    if (!res.ok) {
      const body = isJSON ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
      const message = isJSON ? (body.error || JSON.stringify(body)) : body;
      const err = new Error(message || `HTTP ${res.status}`);
      err.status = res.status;
      const retryAfter = res.headers.get('retry-after');
      err.retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
      throw err;
    }

    return isJSON ? res.json() : res.text();
  }, []);


  // Setup real-time subscription for messages in the guest's thread
  const setupMessagesSubscription = useCallback((threadId) => {
    if (messagesChannelRef.current) supabase.removeChannel(messagesChannelRef.current);
    if (!threadId) return;

    messagesChannelRef.current = supabase
      .channel(`guest_messages_thread_${threadId}`)
      .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          const newMessage = payload.new;

          setMessages(prev => (prev.some(m => m.id === newMessage.id) ? prev : [...prev, newMessage]));

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
        console.log('Guest messages subscription status:', status);
        setConnectionStatus(status);
      });
  }, [scrollToBottom]);

  // Setup real-time subscription for thread updates
  const setupThreadSubscription = useCallback((threadId) => {
    if (threadChannelRef.current) supabase.removeChannel(threadChannelRef.current);
    if (!threadId) return;

    threadChannelRef.current = supabase
      .channel(`guest_thread_${threadId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'message_threads',
        filter: `id=eq.${threadId}`
      }, (payload) => {
        console.log('Guest: Thread updated:', payload);
        setThread(payload.new);
      })
      .subscribe((status) => {
        console.log('Guest thread subscription status:', status);
      });
  }, []); // ✅ stable


  // Get or create communication thread for guest
  const loadThread = useCallback(async () => {
    if (!token) return null

    try {
      setLoading(true)
      const data = await apiCall(`/api/guest/${token}/thread`)
      setThread(data.thread)
      
      // Setup real-time subscription for the thread
      
      return data.thread
    } catch (error) {
      console.error('Error loading thread:', error)
      toast.error('Failed to load conversation')
      throw error
    } finally {
      setLoading(false)
    }
  }, [token, apiCall, setupThreadSubscription])

  // Load messages for the guest's thread
  const loadInFlightRef = useRef(null);
  const lastLoadAtRef = useRef(0);

  const loadMessages = useCallback(async () => {
    if (!token || !thread?.id) return [];

    // throttle to at most once per 2s
    const now = Date.now();
    if (now - lastLoadAtRef.current < 2000 && messages.length) {
      return messages;
    }

    // if already fetching, reuse the same promise
    if (loadInFlightRef.current) return loadInFlightRef.current;

    const p = (async () => {
      try {
        setLoading(true);
        const data = await apiCall(`/api/guest/${token}/thread/messages`);
        const msgs = data?.messages || [];
        setMessages(msgs);
        // scroll but don't force smooth every time
        setTimeout(() => scrollToBottom(false), 100);
        return msgs;
      } finally {
        lastLoadAtRef.current = Date.now();
        loadInFlightRef.current = null;
        setLoading(false);
      }
    })();

    loadInFlightRef.current = p;
    return p;
  }, [token, thread?.id, messages, apiCall, scrollToBottom]);


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
      }
    } catch (error) {
      console.error('Error initializing guest communication:', error);
    } finally {
      setLoading(false);
    }
  }, [token, loadThread, loadMessages, setupMessagesSubscription]); // ✅ will no longer change every thread update


  // Refresh data
  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);          // 👈 separate flag
      await loadMessages();
    } catch (e) {
      console.error('Error refreshing:', e);
    } finally {
      setRefreshing(false);
    }
  }, [loadMessages]);


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
    }
  }, [token])

  useEffect(() => {
    if (!thread?.id) return;
    setupMessagesSubscription(thread.id);
    setupThreadSubscription(thread.id);
    return () => {
      if (messagesChannelRef.current) supabase.removeChannel(messagesChannelRef.current);
      if (threadChannelRef.current) supabase.removeChannel(threadChannelRef.current);
    };
  }, [thread?.id, setupMessagesSubscription, setupThreadSubscription]);


  return {
    // State
    loading,
    refreshing,
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
    
    // Refs for external use
    messageListRef,
    
    // State setters for external updates
    setThread,
    setMessages
  }
}

export default useGuestCommunication
