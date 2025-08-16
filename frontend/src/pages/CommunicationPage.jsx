import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import InboxPanel from '../components/communication/InboxPanel';
import MessagePanel from '../components/communication/MessagePanel';
import ReservationPanel from '../components/communication/ReservationPanel';
import TemplateManagementPanel from '../components/communication/TemplateManagementPanel';
import { useRealtimeCommunication } from '../hooks/useRealtimeCommunication';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../hooks/useNavigation';

export default function CommunicationPage() {
  const { user } = useAuth();
  const handleSectionChange = useNavigation('communication');
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
  const [activeTab, setActiveTab] = useState('messages'); // 'messages', 'templates'
  const [showInboxOverlay, setShowInboxOverlay] = useState(false);
  const [showReservationOverlay, setShowReservationOverlay] = useState(false);

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
    // Always default to 'inapp' when selecting a thread
    setSelectedChannel('inapp');
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
    <DashboardLayout
      activeSection="communication"
      onSectionChange={handleSectionChange}
    >
      <div className="h-full flex flex-col bg-primary-25">
        {/* Header */}
        <div className="bg-white border-b border-primary-200 px-4 lg:px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Buttons */}
              <div className="flex lg:hidden gap-2">
                {activeTab === 'messages' && (
                  <>
                    <button
                      onClick={() => setShowInboxOverlay(true)}
                      className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Show Inbox"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m4 0h2a2 2 0 012 2v4.01" />
                      </svg>
                    </button>
                    {selectedThread && (
                      <button
                        onClick={() => setShowReservationOverlay(true)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Show Reservation Details"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>

              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-primary-900">Communication</h1>
                <p className="text-sm text-primary-600 mt-1 hidden sm:block">
                  {activeTab === 'messages' 
                    ? 'Manage guest conversations across all channels'
                    : 'Control automated message templates'
                  }
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {activeTab === 'messages' && (
                <div className={`flex items-center gap-2 px-2 lg:px-3 py-1 rounded-full text-xs font-medium ${
                  connectionStatus === 'SUBSCRIBED' ? 'bg-leaf-100 text-leaf-700' : 
                  connectionStatus === 'CONNECTING' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-gray-100 text-gray-600'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'SUBSCRIBED' ? 'bg-leaf-500' : 
                    connectionStatus === 'CONNECTING' ? 'bg-yellow-500' : 'bg-gray-400'
                  }`}></div>
                  <span className="hidden sm:inline">
                    {connectionStatus === 'SUBSCRIBED' ? 'Connected' : 
                     connectionStatus === 'CONNECTING' ? 'Connecting' : 'Disconnected'}
                  </span>
                </div>
              )}
              <button
                onClick={activeTab === 'messages' ? loadThreads : () => window.location.reload()}
                disabled={loading}
                className="px-3 lg:px-4 py-2 text-sm font-medium text-primary-700 bg-white border border-primary-300 rounded-lg hover:bg-primary-50 disabled:opacity-50 transition-colors"
              >
                <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
                <svg className="w-4 h-4 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="mt-4 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('messages')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'messages'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Messages
                </div>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'templates'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Templates
                </div>
              </button>
            </nav>
          </div>
        </div>

        {/* Main Communication Interface */}
        <div className="flex-1 flex overflow-hidden bg-primary-25">
          {activeTab === 'messages' ? (
            <>
              {/* Desktop Layout */}
              <div className="hidden lg:flex flex-1">
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
                <div className="flex-1 flex flex-col bg-primary-50">
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

              {/* Mobile/Tablet Layout */}
              <div className="flex lg:hidden flex-1 flex-col">
                {/* Mobile Messages Panel */}
                <div className="flex-1 flex flex-col bg-primary-50">
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
              </div>
            </>
          ) : (
            /* Template Management Tab */
            <div className="flex-1 bg-white">
              <TemplateManagementPanel />
            </div>
          )}

          {/* Mobile Inbox Overlay */}
          {showInboxOverlay && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowInboxOverlay(false)}>
              <div className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Conversations</h2>
                  <button
                    onClick={() => setShowInboxOverlay(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <InboxPanel
                    threads={threads}
                    selectedThread={selectedThread}
                    onThreadSelect={(thread) => {
                      handleThreadSelect(thread);
                      setShowInboxOverlay(false);
                    }}
                    loading={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mobile Reservation Overlay */}
          {showReservationOverlay && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowReservationOverlay(false)}>
              <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Reservation Details</h2>
                  <button
                    onClick={() => setShowReservationOverlay(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ReservationPanel
                    thread={selectedThread}
                    reservation={reservation}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
