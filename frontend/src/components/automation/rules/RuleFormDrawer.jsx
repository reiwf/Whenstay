import React, { useState, useEffect } from 'react';
// import RuleTypeSelector from './RuleTypeSelector';
import BackfillPolicySelector from './BackfillPolicySelector';

export default function RuleFormDrawer({ rule, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    enabled: false,
    days: '',
    hours: '',
    at_time: '',
    delay_minutes: '',
    backfill: 'none',
    timezone: 'Asia/Tokyo'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (rule) {
      setFormData({
        enabled: rule.enabled || false,
        days: rule.days || '',
        hours: rule.hours || '',
        at_time: rule.at_time || '',
        delay_minutes: rule.delay_minutes || '',
        backfill: rule.backfill || 'none',
        timezone: rule.timezone || 'Asia/Tokyo'
      });
    }
  }, [rule]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const ruleData = {
        ...rule,
        ...formData
      };
      
      await onSave(ruleData);
    } catch (err) {
      console.error('Error saving rule:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRelevantFields = () => {
    switch (rule?.type) {
      case 'ON_CREATE_DELAY_MIN':
        return ['delay_minutes'];
      case 'BEFORE_ARRIVAL_DAYS_AT_TIME':
        return ['days', 'at_time'];
      case 'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN':
      case 'AFTER_CHECKIN_HOURS':
      case 'BEFORE_CHECKOUT_HOURS':
        return ['hours'];
      case 'AFTER_DEPARTURE_DAYS':
        return ['days'];
      default:
        return [];
    }
  };

  const relevantFields = getRelevantFields();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Configure Rule {rule?.code}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {rule?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Rule Type Info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-blue-600">{rule?.code}</span>
                <span className="text-sm text-blue-800">{rule?.type}</span>
              </div>
              <p className="text-sm text-blue-700">
                {rule?.description || 'Configure the timing and behavior for this rule.'}
              </p>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                Enable this rule
              </label>
            </div>

            {/* Dynamic Fields Based on Rule Type */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-gray-700">Timing Configuration</h3>
              
              {relevantFields.includes('delay_minutes') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Delay (minutes)
                  </label>
                  <input
                    type="number"
                    value={formData.delay_minutes}
                    onChange={(e) => handleInputChange('delay_minutes', e.target.value)}
                    placeholder="Enter delay in minutes..."
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Time to wait after booking creation before sending message
                  </p>
                </div>
              )}

              {relevantFields.includes('days') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Days
                  </label>
                  <input
                    type="number"
                    value={formData.days}
                    onChange={(e) => handleInputChange('days', e.target.value)}
                    placeholder="Enter number of days..."
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {rule?.type === 'BEFORE_ARRIVAL_DAYS_AT_TIME' 
                      ? 'Days before arrival'
                      : 'Days after departure'
                    }
                  </p>
                </div>
              )}

              {relevantFields.includes('hours') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hours
                  </label>
                  <input
                    type="number"
                    value={formData.hours}
                    onChange={(e) => handleInputChange('hours', e.target.value)}
                    placeholder="Enter number of hours..."
                    min="0"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Hours relative to check-in/out time
                  </p>
                </div>
              )}

              {relevantFields.includes('at_time') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Time of Day
                  </label>
                  <input
                    type="time"
                    value={formData.at_time}
                    onChange={(e) => handleInputChange('at_time', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    What time to send the message (property timezone)
                  </p>
                </div>
              )}
            </div>

            {/* Backfill Policy */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Backfill Policy</h3>
              <BackfillPolicySelector
                selected={formData.backfill}
                onChange={(value) => handleInputChange('backfill', value)}
              />
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timezone
              </label>
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Timezone for timing calculations
              </p>
            </div>

            {/* Template Info */}
            {rule?.message_templates && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Template</h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-900">
                    {rule.message_templates.name}
                  </span>
                  <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                    {rule.message_templates.channel}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
