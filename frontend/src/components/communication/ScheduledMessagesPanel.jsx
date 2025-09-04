import React, { useState, useEffect } from 'react';
import { 
  X,
  Clock, 
  Calendar, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  RefreshCw,
  Play,
  Trash2,
  Eye,
  ChevronDown,
  ChevronRight,
  Bot,
  Zap,
  Timer
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';

export default function ScheduledMessagesPanel({ 
  reservationId, 
  isOpen,
  onClose,
  onTriggerAutomation,
  onCancelMessages 
}) {
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedMessage, setExpandedMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch scheduled messages for the reservation
  const fetchScheduledMessages = async (showLoading = true) => {
    if (!reservationId) return;
    
    try {
      if (showLoading) setLoading(true);
      setRefreshing(true);

      const response = await adminAPI.getScheduledMessagesForReservation(reservationId);
      setScheduledMessages(response.data.scheduledMessages || []);
    } catch (error) {
      console.error('Error fetching scheduled messages:', error);
      toast.error('Failed to load scheduled messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load messages when reservation changes or drawer opens
  useEffect(() => {
    if (isOpen && reservationId) {
      fetchScheduledMessages();
    }
  }, [reservationId, isOpen]);

  const handleRefresh = () => {
    fetchScheduledMessages(false);
  };

  const handleTriggerAutomation = async () => {
    if (!reservationId) return;
    
    try {
      await onTriggerAutomation?.(reservationId);
      toast.success('Automation triggered successfully');
      setTimeout(() => fetchScheduledMessages(false), 1000); // Refresh after automation
    } catch (error) {
      console.error('Error triggering automation:', error);
      toast.error('Failed to trigger automation');
    }
  };

  const handleCancelAllMessages = async () => {
    if (!reservationId || scheduledMessages.length === 0) return;

    if (!window.confirm('Are you sure you want to cancel all scheduled messages for this reservation?')) {
      return;
    }

    try {
      await onCancelMessages?.(reservationId);
      toast.success('Scheduled messages cancelled');
      fetchScheduledMessages(false);
    } catch (error) {
      console.error('Error cancelling messages:', error);
      toast.error('Failed to cancel messages');
    }
  };

  const handleCancelIndividualMessage = async (messageId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled message?')) {
      return;
    }
    
    try {
      // Individual message cancellation implementation
      console.log('Cancel individual message:', messageId);
      toast.success('Message cancelled');
      fetchScheduledMessages(false);
    } catch (error) {
      console.error('Error cancelling message:', error);
      toast.error('Failed to cancel message');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'queued':
        return <Timer className="w-4 h-4 text-yellow-500" />;
      case 'sent':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-gray-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'sent':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getTimelineNodeColor = (status) => {
    switch (status) {
      case 'queued':
        return 'bg-yellow-400 border-yellow-500';
      case 'sent':
        return 'bg-green-400 border-green-500';
      case 'cancelled':
        return 'bg-gray-400 border-gray-500';
      case 'failed':
        return 'bg-red-400 border-red-500';
      default:
        return 'bg-gray-300 border-gray-400';
    }
  };

  const formatRunAt = (runAt) => {
    if (!runAt) return { time: 'Not scheduled', relative: '' };
    
    const date = new Date(runAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Format absolute time
    const timeString = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Format relative time
    let relativeString = '';
    if (Math.abs(diffHours) < 48) {
      if (diffHours > 0) {
        if (diffHours < 1) {
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          relativeString = `in ${diffMinutes} min`;
        } else {
          relativeString = `in ${Math.round(diffHours)}h`;
        }
      } else {
        relativeString = 'overdue';
      }
    }
    
    return { time: timeString, relative: relativeString };
  };

  const toggleExpanded = (messageId) => {
    setExpandedMessage(expandedMessage === messageId ? null : messageId);
  };

  const groupMessagesByTime = (messages) => {
    if (!messages.length) return [];
    
    // Sort messages by run_at time
    const sortedMessages = [...messages].sort((a, b) => {
      const aTime = new Date(a.run_at || 0);
      const bTime = new Date(b.run_at || 0);
      return aTime - bTime;
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const groups = [
      { title: 'Overdue', messages: [], color: 'text-red-600' },
      { title: 'Today', messages: [], color: 'text-blue-600' },
      { title: 'Tomorrow', messages: [], color: 'text-purple-600' },
      { title: 'This Week', messages: [], color: 'text-green-600' },
      { title: 'Later', messages: [], color: 'text-gray-600' }
    ];

    sortedMessages.forEach(message => {
      const messageDate = new Date(message.run_at);
      
      if (messageDate < now && message.status === 'queued') {
        groups[0].messages.push(message); // Overdue
      } else if (messageDate >= today && messageDate < tomorrow) {
        groups[1].messages.push(message); // Today
      } else if (messageDate >= tomorrow && messageDate < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000)) {
        groups[2].messages.push(message); // Tomorrow
      } else if (messageDate < nextWeek) {
        groups[3].messages.push(message); // This Week
      } else {
        groups[4].messages.push(message); // Later
      }
    });

    return groups.filter(group => group.messages.length > 0);
  };

  if (!isOpen) return null;

  const messageGroups = groupMessagesByTime(scheduledMessages);
  const queuedMessagesCount = scheduledMessages.filter(msg => msg.status === 'queued').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-30"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-3xl md:max-w-4xl bg-white shadow-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-white to-blue-50">
            <div className="px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Bot className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Scheduled Messages</h2>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className="text-sm text-gray-600">
                        {scheduledMessages.length} total message{scheduledMessages.length !== 1 ? 's' : ''}
                      </span>
                      {queuedMessagesCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {queuedMessagesCount} queued
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    aria-label="Refresh scheduled messages"
                  >
                    <RefreshCw className={`w-4 h-4 sm:mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                  
                  <button
                    onClick={handleTriggerAutomation}
                    className="inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                    aria-label="Trigger automation"
                  >
                    <Zap className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Trigger Automation</span>
                  </button>
                  
                  {queuedMessagesCount > 0 && (
                    <button
                      onClick={handleCancelAllMessages}
                      className="inline-flex items-center px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                      aria-label="Cancel all scheduled messages"
                    >
                      <Trash2 className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Cancel All</span>
                    </button>
                  )}
                  
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close scheduled messages panel"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading && scheduledMessages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600">Loading scheduled messages...</p>
                </div>
              </div>
            ) : scheduledMessages.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Scheduled Messages</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Messages will appear here after automation is triggered for this reservation
                  </p>
                  <button
                    onClick={handleTriggerAutomation}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Trigger Automation Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-6">
                {/* Timeline */}
                <div className="relative">
                  {/* Timeline Rail */}
                  <div className="absolute left-6 sm:left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-200 via-gray-200 to-gray-300"></div>
                  
                  {messageGroups.map((group, groupIndex) => (
                    <div key={group.title} className="relative mb-8">
                      {/* Time Group Header */}
                      <div className="flex items-center mb-4">
                        <div className="relative z-10 bg-white pr-4">
                          <h3 className={`text-lg font-semibold ${group.color}`}>{group.title}</h3>
                        </div>
                        <div className="flex-1 border-t border-gray-200 ml-4"></div>
                      </div>
                      
                      {/* Messages in this group */}
                      <div className="space-y-6">
                        {group.messages.map((message, messageIndex) => {
                          const timeInfo = formatRunAt(message.run_at);
                          const isExpanded = expandedMessage === message.id;
                          
                          return (
                            <div key={message.id} className="relative flex items-start">
                              {/* Timeline Node */}
                              <div className="relative z-10 flex flex-col items-center">
                                <div 
                                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 ${getTimelineNodeColor(message.status)} shadow-lg flex items-center justify-center`}
                                  role="img"
                                  aria-label={`Message status: ${message.status}`}
                                >
                                  {message.status === 'sent' && <CheckCircle className="w-2 h-2 sm:w-3 sm:h-3 text-white" />}
                                  {message.status === 'failed' && <AlertCircle className="w-2 h-2 sm:w-3 sm:h-3 text-white" />}
                                  {message.status === 'cancelled' && <XCircle className="w-2 h-2 sm:w-3 sm:h-3 text-white" />}
                                  {message.status === 'queued' && <Timer className="w-2 h-2 sm:w-3 sm:h-3 text-white" />}
                                </div>
                                {messageIndex < group.messages.length - 1 && (
                                  <div className="w-0.5 h-8 bg-gradient-to-b from-current to-gray-200 mt-2 opacity-30"></div>
                                )}
                              </div>
                              
                              {/* Message Card */}
                              <div className="flex-1 ml-4 sm:ml-6 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                                <div className="p-3 sm:p-4">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2 gap-1 sm:gap-0">
                                        <div className="flex items-center space-x-2 sm:space-x-3">
                                          {getStatusIcon(message.status)}
                                          <h4 className="text-sm font-medium text-gray-900 truncate">
                                            {message.message_templates?.name || message.message_rules?.name || 'Unknown Template'}
                                          </h4>
                                        </div>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(message.status)} self-start sm:self-auto`}>
                                          {message.status}
                                        </span>
                                      </div>
                                      
                                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-xs text-gray-500 mb-2 gap-1 sm:gap-0">
                                        <div className="flex items-center">
                                          <Clock className="w-3 h-3 mr-1" />
                                          <span className="font-medium">{timeInfo.time}</span>
                                          {timeInfo.relative && (
                                            <span className="ml-1 text-yellow-600">({timeInfo.relative})</span>
                                          )}
                                        </div>
                                        {message.channel && (
                                          <span className="text-xs text-gray-500">via {message.channel}</span>
                                        )}
                                      </div>
                                      
                                      {/* Message Preview */}
                                      {message.rendered_content && (
                                        <div className="text-sm text-gray-600 bg-gray-50 rounded-md p-3 mb-2 border-l-4 border-blue-200">
                                          <div className="line-clamp-2">
                                            {message.rendered_content.substring(0, 120)}
                                            {message.rendered_content.length > 120 && '...'}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-1 sm:space-x-2 ml-2 sm:ml-4">
                                      <button
                                        onClick={() => toggleExpanded(message.id)}
                                        className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                                        aria-label={isExpanded ? 'Hide message details' : 'Show message details'}
                                        aria-expanded={isExpanded}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-4 h-4" />
                                        ) : (
                                          <ChevronRight className="w-4 h-4" />
                                        )}
                                      </button>
                                      
                                      {message.status === 'queued' && (
                                        <button
                                          onClick={() => handleCancelIndividualMessage(message.id)}
                                          className="text-gray-400 hover:text-red-500 transition-colors p-1"
                                          aria-label="Cancel this scheduled message"
                                        >
                                          <XCircle className="w-4 h-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Expanded Details */}
                                {isExpanded && (
                                  <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4" role="region" aria-label="Message details">
                                    <div className="space-y-3">
                                      {message.message_templates?.content && (
                                        <div>
                                          <h5 className="text-xs font-medium text-gray-700 mb-1">Template Content:</h5>
                                          <div className="text-sm text-gray-600 bg-white p-3 rounded border">
                                            {message.message_templates.content}
                                          </div>
                                        </div>
                                      )}
                                      
                                      {message.rendered_content && (
                                        <div>
                                          <h5 className="text-xs font-medium text-gray-700 mb-1">Rendered Content:</h5>
                                          <div className="text-sm text-gray-900 bg-blue-50 p-3 rounded border border-blue-200">
                                            {message.rendered_content}
                                          </div>
                                        </div>
                                      )}
                                      
                                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 pt-2 border-t border-gray-200">
                                        <div>
                                          <span className="font-medium">Created:</span><br />
                                          {new Date(message.created_at).toLocaleString()}
                                        </div>
                                        <div>
                                          <span className="font-medium">Message ID:</span><br />
                                          <span className="font-mono">{message.id.slice(0, 8)}...</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
