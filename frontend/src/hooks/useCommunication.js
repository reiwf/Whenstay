import { useState, useCallback } from 'react'
import { adminAPI } from '../services/api'
import toast from 'react-hot-toast'

export function useCommunication() {
  const [loading, setLoading] = useState(false)
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [threadChannels, setThreadChannels] = useState([])
  const [templates, setTemplates] = useState([])
  const [selectedThread, setSelectedThread] = useState(null)
  const [reservation, setReservation] = useState(null)

  // Load message threads
  const loadThreads = useCallback(async (params = {}) => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommunicationThreads(params)
      const threadsData = response.data.threads || []
      setThreads(threadsData)
      return threadsData
    } catch (error) {
      console.error('Error loading threads:', error)
      toast.error('Failed to load message threads')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Load messages for a thread
  const loadMessages = useCallback(async (threadId, params = {}) => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommunicationMessages(threadId, params)
      const messagesData = response.data.messages || []
      setMessages(messagesData)
      return messagesData
    } catch (error) {
      console.error('Error loading messages:', error)
      toast.error('Failed to load messages')
      throw error
    } finally {
      setLoading(false)
    }
  }, [])

  // Send a new message
  const sendMessage = useCallback(async (threadId, messageData) => {
    try {
      const response = await adminAPI.sendCommunicationMessage(threadId, messageData)
      const newMessage = response.data.message
      
      // Add the new message to local state
      setMessages(prev => [...prev, newMessage])
      
      // Update thread preview in threads list
      setThreads(prev => 
        prev.map(thread => 
          thread.id === threadId 
            ? { 
                ...thread, 
                last_message_at: newMessage.created_at,
                last_message_preview: messageData.content.substring(0, 160)
              }
            : thread
        )
      )
      
      toast.success('Message sent successfully')
      return newMessage
    } catch (error) {
      console.error('Error sending message:', error)
      toast.error('Failed to send message')
      throw error
    }
  }, [])

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
      const reservationData = response.data.reservation
      setReservation(reservationData)
      return reservationData
    } catch (error) {
      console.error('Error loading reservation details:', error)
      setReservation(null)
      return null
    }
  }, [])

  // Select a thread and load its details
  const selectThread = useCallback(async (thread) => {
    try {
      setSelectedThread(thread)
      setLoading(true)
      
      // Load messages for the thread
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
        // Get the latest message ID from loaded messages
        const latestMessage = messages[messages.length - 1]
        if (latestMessage) {
          await markMessagesRead(thread.id, latestMessage.id)
        }
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

  return {
    // State
    loading,
    threads,
    messages,
    threadChannels,
    templates,
    selectedThread,
    reservation,
    
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
    
    // State setters
    setSelectedThread,
    setMessages,
    setThreads
  }
}

export default useCommunication
