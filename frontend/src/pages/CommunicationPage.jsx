import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import InboxPanel from '../components/communication/InboxPanel';
import MessagePanel from '../components/communication/MessagePanel';
import ReservationPanel from '../components/communication/ReservationPanel';
import { useRealtimeCommunication } from '../hooks/useRealtimeCommunication';
import { useAuth } from '../contexts/AuthContext';

export default function CommunicationPage() {
  const { user } = useAuth();
  const {
    threads,
    selectedThread,
    messages,
    loading,
    sendMessage,
    loadThreads,
    updateThreadStatus,
    selectThread,
    markMessageAsRead,
    reservation,
    messageListRef,
    connectionStatus
  } = useRealtimeCommunication();

  const [selectedChannel, setSelectedChannel] = useState('inapp');

  // Load threads on component mount
  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const handleSendMessage = async (content, channel = selectedChannel) => {
    if (!selectedThread) return;
    
    try {
      await sendMessage(selectedThread.id, {
        channel,
        content,
        origin_role: 'host'
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleThreadSelect = async (thread) => {
    await selectThread(thread);
    // Auto-select best available channel for this thread
    if (thread.thread_channels?.length > 0) {
      setSelectedChannel(thread.thread_channels[0].channel);
    }
  };

  const handleThreadAction = async (action, threadId) => {
    try {
      switch (action) {
        case 'archive':
          await updateThreadStatus(threadId, 'archived');
          break;
        case 'close':
          await updateThreadStatus(threadId, 'closed');
          break;
        default:
          console.warn('Unknown thread action:', action);
      }
    } catch (error) {
      console.error('Thread action failed:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col bg-primary-25">
        {/* Header */}
        <div className="bg-white border-b border-primary-200 px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-900">Communication</h1>
              <p className="text-sm text-primary-600 mt-1">
                Manage guest conversations across all channels
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                connectionStatus === 'SUBSCRIBED' ? 'bg-leaf-100 text-leaf-700' : 
                connectionStatus === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700' : 
                'bg-gray-100 text-gray-600'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'SUBSCRIBED' ? 'bg-leaf-500' : 
                  connectionStatus === 'CONNECTING' ? 'bg-yellow-500' : 'bg-gray-400'
                }`}></div>
                {connectionStatus === 'SUBSCRIBED' ? 'Connected' : 
                 connectionStatus === 'CONNECTING' ? 'Connecting' : 'Disconnected'}
              </div>
              <button
                onClick={loadThreads}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-lg hover:bg-primary-50 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Communication Interface */}
        <div className="flex-1 flex overflow-hidden bg-primary-25">
          {/* Left Panel - Inbox */}
          <div className="w-80 border-r border-primary-200 bg-white flex flex-col shadow-sm">
            <InboxPanel
              threads={threads}
              selectedThread={selectedThread}
              onThreadSelect={handleThreadSelect}
              loading={loading}
            />
          </div>

          {/* Center Panel - Messages */}
          <div className="flex-1 flex flex-col min-w-0 bg-primary-50">
            <MessagePanel
              thread={selectedThread}
              messages={messages}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              onSendMessage={handleSendMessage}
              onThreadAction={handleThreadAction}
              onMarkAsRead={markMessageAsRead}
              loading={loading}
            />
          </div>

          {/* Right Panel - Reservation Details */}
          <div className="w-80 border-l border-primary-200 bg-white shadow-sm">
            <ReservationPanel
              thread={selectedThread}
              reservation={reservation}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
