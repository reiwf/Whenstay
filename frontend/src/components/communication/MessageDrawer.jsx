import React, { useState, useEffect } from 'react';
import { X, MessageCircle, Loader, Users, Calendar, MapPin, Crown } from 'lucide-react';
import { adminAPI } from '../../services/api';
import MessagePanel from './MessagePanel';
import useRealtimeCommunication from '../../hooks/useRealtimeCommunication';
import toast from 'react-hot-toast';

export default function MessageDrawer({ 
  reservation, 
  isOpen, 
  onClose 
}) {
  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('inapp');
  const [error, setError] = useState(null);

  const {
    messages,
    loadMessages,
    sendMessage,
    unsendMessage,
    updateThreadStatus,
    loadThreadChannels,
    markMessagesRead,
    markMessageAsRead,
    loadReservationDetails,
    groupBookingInfo,
    threadChannels,
    loading: messagesLoading
  } = useRealtimeCommunication();

  // Fetch thread when drawer opens
  useEffect(() => {
    if (isOpen && reservation) {
      fetchThread();
    } else {
      // Reset state when drawer closes
      setThread(null);
      setError(null);
      setSelectedChannel('inapp'); // Reset to default channel
    }
  }, [isOpen, reservation]);

  // Reset channel selection when thread changes
  useEffect(() => {
    if (thread) {
      setSelectedChannel('inapp'); // Always start with inapp as default
    }
  }, [thread?.id]);

  // Update selected channel when threadChannels are loaded
  useEffect(() => {
    if (threadChannels.length > 0 && selectedChannel === 'inapp') {
      // If we have loaded channels and we're still on default, 
      // keep 'inapp' but ensure it's valid, or switch to first available
      if (!threadChannels.includes('inapp') && threadChannels.length > 0) {
        console.log('MessageDrawer: inapp not available, switching to:', threadChannels[0]);
        setSelectedChannel(threadChannels[0]);
      }
    }
  }, [threadChannels, selectedChannel]);

  const fetchThread = async () => {
    if (!reservation?.id) {
      setError('Invalid reservation data');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('MessageDrawer: Fetching thread for reservation:', reservation.id);
      
      // Use the new API endpoint to get or create thread
      const response = await adminAPI.getThreadByReservation(reservation.id, true);
      const { thread: fetchedThread, created, reopened } = response.data;

      console.log('MessageDrawer: Thread fetched/created:', {
        threadId: fetchedThread.id,
        created,
        reopened,
        status: fetchedThread.status
      });

      setThread(fetchedThread);

      // Load messages for the thread
      await loadMessages(fetchedThread.id);

      // Load available channels
      await loadThreadChannels(fetchedThread.id);

      // Load reservation details for the messaging context
      if (fetchedThread.reservation_id) {
        await loadReservationDetails(fetchedThread.reservation_id);
      }

      // Show feedback messages
      if (created) {
        toast.success('New conversation created');
      } else if (reopened) {
        toast.success('Conversation reopened');
      }

    } catch (error) {
      console.error('MessageDrawer: Error fetching thread:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load conversation';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (content, channel) => {
    if (!thread) return;

    try {
      await sendMessage(thread.id, {
        content,
        channel: channel || selectedChannel
      });
    } catch (error) {
      console.error('MessageDrawer: Error sending message:', error);
      // Error handling is done in the hook
    }
  };

  const handleThreadAction = async (action, threadId) => {
    if (!threadId) return;

    try {
      await updateThreadStatus(threadId, action);
      
      // If thread is closed, close the drawer
      if (action === 'closed') {
        onClose();
      }
    } catch (error) {
      console.error('MessageDrawer: Error updating thread status:', error);
      // Error handling is done in the hook
    }
  };

  const handleMarkAsRead = async (messageId, channel = 'inapp') => {
    try {
      await markMessageAsRead(messageId, channel);
    } catch (error) {
      console.error('MessageDrawer: Error marking message as read:', error);
    }
  };

  const handleMessageUpdate = async (messageId, updates) => {
    // This is a placeholder for future message update functionality
    console.log('MessageDrawer: Message update requested:', messageId, updates);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-30"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-4xl bg-white shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Enhanced Header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-white to-gray-50">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {groupBookingInfo?.isGroupBooking ? (
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-2 text-amber-600" />
                          Group Conversation
                          {groupBookingInfo?.isMaster && (
                            <Crown className="w-4 h-4 ml-1 text-amber-500" />
                          )}
                        </span>
                      ) : (
                        'Messages'
                      )}
                    </h2>
                    {thread?.status && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        thread.status === 'open' 
                          ? 'bg-green-100 text-green-800'
                          : thread.status === 'closed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {thread.status}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="font-medium">{reservation?.booking_name || 'Guest'}</span>
                      {groupBookingInfo?.isGroupBooking && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                          {groupBookingInfo.totalRooms} rooms
                        </span>
                      )}
                    </div>
                    
                    {reservation?.check_in_date && (
                      <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{new Date(reservation.check_in_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    
                    {thread?.reservations?.properties?.name && (
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span className="truncate">{thread.reservations.properties.name}</span>
                      </div>
                    )}
                  </div>
                  
                  {thread && (
                    <div className="mt-1 text-xs text-gray-500">
                      {thread.reservations?.room_types?.name ? (
                        <span>{thread.reservations.room_types.name}</span>
                      ) : (
                        <span>Thread: {thread.id.slice(0, 8)}</span>
                      )}
                      {thread.reservations?.room_units?.unit_number ? (
                        <span className="ml-3">
                          {thread.reservations.room_units.unit_number}
                        </span>
                      ) : thread.reservation_id ? (
                        <span className="ml-3">
                          Res: #{thread.reservation_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* Group Booking Info Banner */}
            {groupBookingInfo?.isGroupBooking && (
              <div className="px-4 pb-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <Users className="w-4 h-4 text-amber-600 mr-2" />
                    <span className="text-sm font-medium text-amber-800">
                      {groupBookingInfo.isMaster ? 'Master Booking' : 'Group Member'} - 
                      {' '}{groupBookingInfo.totalRooms} rooms in this group
                    </span>
                  </div>
                  {groupBookingInfo.groupReservations && groupBookingInfo.groupReservations.length > 1 && (
                    <div className="mt-2 text-xs text-amber-700">
                      All messages are shared across {groupBookingInfo.groupReservations.length} reservations in this group
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {loading && !thread && (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <Loader className="w-8 h-8 animate-spin text-primary-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading conversation...</h3>
                  <p className="text-gray-600 max-w-sm">
                    {groupBookingInfo?.isGroupBooking 
                      ? 'Setting up your group booking conversation' 
                      : 'Preparing your message thread'
                    }
                  </p>
                  <div className="mt-4 flex justify-center space-x-1">
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            {error && !thread && (
              <div className="h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-gray-50">
                <div className="text-center max-w-md p-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                    <X className="w-10 h-10 text-red-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    Unable to Load Conversation
                  </h3>
                  <p className="text-gray-600 mb-6 leading-relaxed">{error}</p>
                  <div className="space-y-3">
                    <button
                      onClick={fetchThread}
                      className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 
                               transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={onClose}
                      className="w-full px-6 py-2 text-gray-600 hover:text-gray-800 transition-colors text-sm"
                    >
                      Close and Return
                    </button>
                  </div>
                </div>
              </div>
            )}

            {thread && (
              <MessagePanel
                thread={thread}
                messages={messages}
                selectedChannel={selectedChannel}
                onChannelChange={setSelectedChannel}
                onSendMessage={handleSendMessage}
                onThreadAction={handleThreadAction}
                onMarkAsRead={handleMarkAsRead}
                onUnsendMessage={unsendMessage}
                onMessageUpdate={handleMessageUpdate}
                loading={messagesLoading}
                reservation={reservation}
                groupBookingInfo={groupBookingInfo}
                threadChannels={threadChannels}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
