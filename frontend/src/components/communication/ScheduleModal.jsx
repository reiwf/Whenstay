import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Send } from 'lucide-react';

export default function ScheduleModal({ thread, channel, onClose, onSchedule }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [loading, setLoading] = useState(false);

  // Load templates when modal opens
  useEffect(() => {
    loadTemplates();
  }, [channel]);

  const loadTemplates = async () => {
    // Mock templates for demo - in production this would call the API
    setTemplates([
      {
        id: '1',
        name: 'Welcome Message',
        content: 'Welcome to {{property_name}}! Your reservation is confirmed.',
        channel: 'inapp'
      },
      {
        id: '2',
        name: 'Check-in Reminder',
        content: 'Hi {{guest_name}}, your check-in is tomorrow at {{check_in_time}}.',
        channel: 'whatsapp'
      },
      {
        id: '3',
        name: 'Key Pickup Instructions',
        content: 'Please go to the front desk on the 1st floor with your ID.',
        channel: 'inapp'
      }
    ]);
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16);
  };

  const handleSchedule = async () => {
    if (!scheduleAt) return;

    setLoading(true);
    try {
      const scheduleData = {
        thread_id: thread.id,
        channel,
        run_at: new Date(scheduleAt).toISOString(),
        ...(useTemplate && selectedTemplate
          ? { template_id: selectedTemplate }
          : { content: customMessage })
      };

      await onSchedule(scheduleData);
    } catch (error) {
      console.error('Failed to schedule message:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Message</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Message Type Toggle */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Message Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={useTemplate}
                  onChange={() => setUseTemplate(true)}
                  className="mr-2"
                />
                <span className="text-sm">Use Template</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  checked={!useTemplate}
                  onChange={() => setUseTemplate(false)}
                  className="mr-2"
                />
                <span className="text-sm">Custom Message</span>
              </label>
            </div>
          </div>

          {/* Template Selection */}
          {useTemplate && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a template...</option>
                {templates
                  .filter(t => t.channel === channel || t.channel === 'inapp')
                  .map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
              
              {/* Template Preview */}
              {selectedTemplateData && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p className="text-xs text-gray-600 mb-1">Preview:</p>
                  <p className="text-sm text-gray-800">{selectedTemplateData.content}</p>
                </div>
              )}
            </div>
          )}

          {/* Custom Message */}
          {!useTemplate && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Custom Message
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Enter your custom message..."
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                rows="3"
              />
            </div>
          )}

          {/* Schedule Time */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Send At
            </label>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
              min={getMinDateTime()}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Channel Info */}
          <div className="bg-blue-50 p-3 rounded-md">
            <div className="flex items-center text-sm">
              <Send className="w-4 h-4 mr-2 text-blue-600" />
              <span className="text-blue-800">
                This message will be sent via <strong>{channel}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={
              loading || 
              !scheduleAt || 
              (useTemplate && !selectedTemplate) || 
              (!useTemplate && !customMessage.trim())
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Scheduling...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                Schedule Message
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
