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
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Communication</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage guest conversations across all channels
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadThreads}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Communication Interface */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Inbox */}
          <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
            <InboxPanel
              threads={threads}
              selectedThread={selectedThread}
              onThreadSelect={handleThreadSelect}
              loading={loading}
            />
          </div>

          {/* Center Panel - Messages */}
          <div className="flex-1 flex flex-col min-w-0">
            <MessagePanel
              thread={selectedThread}
              messages={messages}
              selectedChannel={selectedChannel}
              onChannelChange={setSelectedChannel}
              onSendMessage={handleSendMessage}
              onThreadAction={handleThreadAction}
              loading={loading}
            />
          </div>

          {/* Right Panel - Reservation Details */}
          <div className="w-80 border-l border-gray-200 bg-white">
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
