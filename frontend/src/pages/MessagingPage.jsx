import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Plus, MessageSquare } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import DashboardLayout from '../components/layout/DashboardLayout'
import { PageHeader } from '../components/ui'
import { Button } from '../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import useCommunication from '../hooks/useCommunication'
import toast from 'react-hot-toast'

// Channel configuration
const CHANNEL_CONFIG = {
  beds24: { icon: "🛏️", label: "Beds24", color: "bg-blue-500" },
  whatsapp: { icon: "🟢", label: "WhatsApp", color: "bg-green-500" },
  inapp: { icon: "💬", label: "In-App", color: "bg-purple-500" },
  email: { icon: "✉️", label: "Email", color: "bg-red-500" },
  sms: { icon: "📱", label: "SMS", color: "bg-yellow-500" },
}

export default function MessagingPage() {
  const { hasAdminAccess } = useAuth()
  const navigate = useNavigate()
  
  const {
    loading,
    threads,
    messages,
    threadChannels,
    templates,
    selectedThread,
    reservation,
    loadThreads,
    sendMessage,
    updateThreadStatus,
    loadTemplates,
    scheduleMessage,
    selectThread,
    refresh
  } = useCommunication()

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState("inapp")
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [scheduleDateTime, setScheduleDateTime] = useState("")

  const messagesEndRef = useRef(null)

  // Navigation handler for sidebar
  const handleSectionChange = (section) => {
    if (section === 'dashboard') {
      navigate('/dashboard')
    } else if (section === 'messages') {
      // Already on messages page
      return
    } else {
      navigate('/dashboard')
    }
  }

  // Load initial data
  useEffect(() => {
    if (hasAdminAccess()) {
      loadThreads({ status: 'open' })
    }
  }, [hasAdminAccess, loadThreads])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Update selected channel when thread channels change
  useEffect(() => {
    if (threadChannels.length > 0) {
      const availableChannels = Array.from(new Set(['inapp', ...threadChannels.map(c => c.channel)]))
      if (!availableChannels.includes(selectedChannel)) {
        setSelectedChannel(availableChannels[0])
      }
    }
  }, [threadChannels, selectedChannel])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async () => {
    if (!selectedThread || !draft.trim()) return
    
    setSending(true)
    try {
      await sendMessage(selectedThread.id, {
        content: draft.trim(),
        channel: selectedChannel,
        origin_role: 'host'
      })
      setDraft("")
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleThreadStatusUpdate = async (status) => {
    if (!selectedThread) return
    
    try {
      await updateThreadStatus(selectedThread.id, status)
    } catch (error) {
      console.error('Error updating thread status:', error)
    }
  }

  const handleScheduleMessage = async () => {
    if (!selectedThread || !selectedTemplateId || !scheduleDateTime) return
    
    try {
      await scheduleMessage({
        thread_id: selectedThread.id,
        template_id: selectedTemplateId,
        channel: selectedChannel,
        run_at: new Date(scheduleDateTime).toISOString(),
        payload: {} // Could be populated with reservation data
      })
      
      setScheduleModalOpen(false)
      setSelectedTemplateId("")
      setScheduleDateTime("")
    } catch (error) {
      console.error('Error scheduling message:', error)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getAvailableChannels = useMemo(() => {
    const channels = threadChannels.map(c => c.channel)
    return Array.from(new Set(['inapp', ...channels]))
  }, [threadChannels])

  const openScheduleModal = async () => {
    try {
      await loadTemplates({ channel: selectedChannel })
      setScheduleModalOpen(true)
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  return (
    <DashboardLayout
      activeSection="messages"
      onSectionChange={handleSectionChange}
      pageTitle="Messages"
      pageSubtitle="Communicate with your guests"
      pageAction={
        <div className="flex space-x-2">
          <button
            onClick={refresh}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      }
    >
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="h-[calc(100vh-200px)] grid grid-cols-12 gap-0 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
          
          {/* Left Sidebar - Thread List */}
          <div className="col-span-3 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Inbox</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : threads.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>No conversations</p>
                </div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => selectThread(thread)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedThread?.id === thread.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {thread.subject || 'No Subject'}
                          </span>
                          {thread.unread_count > 0 && (
                            <Badge variant="destructive" className="text-xs px-1 py-0 h-4">
                              {thread.unread_count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {thread.last_message_preview || 'No messages yet'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {thread.last_message_at ? formatDateTime(thread.last_message_at) : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Center - Messages */}
          <div className="col-span-6 flex flex-col">
            {selectedThread ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {selectedThread.subject || 'Conversation'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Thread ID: {selectedThread.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableChannels.map((channel) => (
                          <SelectItem key={channel} value={channel}>
                            <span className="flex items-center gap-2">
                              <span>{CHANNEL_CONFIG[channel]?.icon}</span>
                              <span>{CHANNEL_CONFIG[channel]?.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openScheduleModal}
                    >
                      Schedule
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleThreadStatusUpdate('archived')}
                    >
                      Archive
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleThreadStatusUpdate('closed')}
                    >
                      Close
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 mt-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start the conversation below</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-3 py-2 shadow-sm ${
                            message.direction === 'incoming'
                              ? 'bg-white border border-gray-200'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs">
                              {CHANNEL_CONFIG[message.channel]?.icon}
                            </span>
                            <span className="text-xs opacity-75">
                              {message.origin_role}
                            </span>
                            <span className="text-xs opacity-75">
                              {formatDateTime(message.created_at)}
                            </span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                          {message.direction === 'outgoing' && message.message_deliveries?.[0] && (
                            <div className="text-xs opacity-75 mt-1">
                              {message.message_deliveries[0].status}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <div className="p-4 bg-white border-t border-gray-200">
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type a message..."
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!draft.trim() || sending}
                    >
                      {sending ? 'Sending...' : 'Send'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center text-gray-500">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                  <p>Choose a conversation from the sidebar to start messaging</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar - Reservation Details */}
          <div className="col-span-3 bg-white border-l border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Reservation Details</h3>
            
            {selectedThread && reservation ? (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="font-medium text-gray-700">Guest Name</label>
                  <p className="text-gray-900">{reservation.booking_name || reservation.guest_name}</p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">{reservation.booking_email || reservation.guest_email}</p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Phone</label>
                  <p className="text-gray-900">{reservation.phone || 'Not provided'}</p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Check-in</label>
                  <p className="text-gray-900">
                    {reservation.check_in_date ? formatDate(reservation.check_in_date) : 'Not set'}
                  </p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Check-out</label>
                  <p className="text-gray-900">
                    {reservation.check_out_date ? formatDate(reservation.check_out_date) : 'Not set'}
                  </p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Property</label>
                  <p className="text-gray-900">{reservation.property_name || 'Unknown'}</p>
                </div>
                
                <div>
                  <label className="font-medium text-gray-700">Status</label>
                  <Badge variant="outline">{reservation.status}</Badge>
                </div>
              </div>
            ) : selectedThread ? (
              <div className="text-gray-500">No reservation linked</div>
            ) : (
              <div className="text-gray-500">Select a conversation to view details</div>
            )}
          </div>
        </div>

        {/* Schedule Message Modal */}
        {scheduleModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
              <h3 className="text-lg font-semibold mb-4">Schedule Message</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template
                  </label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Send Date & Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={scheduleDateTime}
                    onChange={(e) => setScheduleDateTime(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setScheduleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleScheduleMessage}
                  disabled={!selectedTemplateId || !scheduleDateTime}
                >
                  Schedule
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
