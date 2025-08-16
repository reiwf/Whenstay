import React, { useState, useEffect } from 'react';
import { 
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
  Bot
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../../services/api';

export default function ScheduledMessagesPanel({ 
  reservationId, 
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

  // Load messages when reservation changes
  useEffect(() => {
    fetchScheduledMessages();
  }, [reservationId]);

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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />;
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

  const formatRunAt = (runAt) => {
    if (!runAt) return 'Not scheduled';
    
    const date = new Date(runAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    // Show relative time if within 48 hours
    if (Math.abs(diffHours) < 48) {
      if (diffHours > 0) {
        if (diffHours < 1) {
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          return `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
        } else {
          return `in ${Math.round(diffHours)} hour${Math.round(diffHours) !== 1 ? 's' : ''}`;
        }
      } else {
        return 'overdue';
      }
    }
    
    // Show full date/time for distant dates
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleExpanded = (messageId) => {
    setExpandedMessage(expandedMessage === messageId ? null : messageId);
  };

  if (!reservationId) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Select a reservation to view scheduled messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-medium text-gray-900">Scheduled Messages</h3>
            {scheduledMessages.length > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {scheduledMessages.length}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={handleTriggerAutomation}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100"
            >
              <Play className="w-3 h-3 mr-1" />
              Trigger
            </button>
            
            {scheduledMessages.some(msg => msg.status === 'queued') && (
              <button
                onClick={handleCancelAllMessages}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Cancel All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && scheduledMessages.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading scheduled messages...</p>
          </div>
        ) : scheduledMessages.length === 0 ? (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600 mb-2">No scheduled messages found</p>
            <p className="text-xs text-gray-500">
              Messages will appear here after automation is triggered for this reservation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledMessages.map((message) => (
              <div key={message.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => toggleExpanded(message.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {expandedMessage === message.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      
                      {getStatusIcon(message.status)}
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {message.message_templates?.name || message.automation_rules?.name || 'Unknown Template'}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(message.status)}`}>
                            {message.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            {formatRunAt(message.run_at)}
                          </span>
                          {message.channel && (
                            <span className="text-xs text-gray-500">
                              via {message.channel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {message.status === 'queued' && (
                      <button
                        onClick={() => {
                          // Individual message cancellation could be implemented here
                          console.log('Cancel individual message:', message.id);
                        }}
                        className="text-gray-400 hover:text-red-500"
                        title="Cancel this message"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {expandedMessage === message.id && (
                  <div className="p-3 border-t border-gray-200 bg-white">
                    <div className="space-y-2">
                      {message.message_templates?.content && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-1">Template Content:</h5>
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                            {message.message_templates.content}
                          </div>
                        </div>
                      )}
                      
                      {message.rendered_content && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-700 mb-1">Rendered Content:</h5>
                          <div className="text-sm text-gray-900 bg-blue-50 p-2 rounded border border-blue-200">
                            {message.rendered_content}
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div>
                          <span className="font-medium">Created:</span><br />
                          {new Date(message.created_at).toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Message ID:</span><br />
                          {message.id.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
