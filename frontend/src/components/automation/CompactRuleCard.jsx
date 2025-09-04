import React, { useState } from 'react';

const ruleTypeDescriptions = {
  'ON_CREATE_DELAY_MIN': (rule) => 
    `${rule.delay_minutes || 0} minutes after booking`,
  'BEFORE_ARRIVAL_DAYS_AT_TIME': (rule) => 
    `${rule.days || 0} day(s) before arrival at ${rule.at_time || '10:00'}`,
  'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN': (rule) => 
    `${rule.hours || 0} hour(s) before check-in`,
  'AFTER_CHECKIN_HOURS': (rule) => 
    `${rule.hours || 0} hour(s) after check-in`,
  'BEFORE_CHECKOUT_HOURS': (rule) => 
    `${rule.hours || 0} hour(s) before check-out`,
  'AFTER_DEPARTURE_DAYS': (rule) => 
    `${rule.days || 0} day(s) after departure`
};

const channelColors = {
  inapp: 'bg-gray-100 text-gray-700',
  email: 'bg-green-100 text-green-700', 
  sms: 'bg-purple-100 text-purple-700',
  whatsapp: 'bg-emerald-100 text-emerald-700'
};

export default function CompactRuleCard({ rule, onEdit, onToggle, connectedTemplate }) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (isToggling) return;
    
    setIsToggling(true);
    try {
      await onToggle(rule.id, { enabled: !rule.enabled });
    } finally {
      setIsToggling(false);
    }
  };

  const getTimingDescription = () => {
    const descriptionFn = ruleTypeDescriptions[rule.type];
    return descriptionFn ? descriptionFn(rule) : rule.type;
  };

  const getChannelColor = () => {
    const channel = rule.message_templates?.channel || 'inapp';
    return channelColors[channel] || channelColors.inapp;
  };

  return (
    <div className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${
      rule.enabled ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200'
    }`}>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Rule Code and Name */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold px-2 py-1 rounded ${
              rule.enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {rule.code}
            </span>
            <span className={`font-medium text-sm ${
              rule.enabled ? 'text-gray-900' : 'text-gray-500'
            }`}>
              {rule.name}
            </span>
          </div>
          
          {/* Status Badge */}
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            rule.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {rule.enabled ? 'enabled' : 'disabled'}
          </span>
        </div>

        {/* Toggle Switch */}
        <label className="inline-flex items-center">
          <input
            type="checkbox"
            className="sr-only"
            checked={rule.enabled}
            disabled={isToggling}
            onChange={handleToggle}
          />
          <div className={`relative inline-flex items-center h-5 w-9 rounded-full transition-colors duration-200 ${
            rule.enabled ? 'bg-blue-500' : 'bg-gray-300'
          } ${isToggling ? 'opacity-50' : ''}`}>
            <span className={`inline-block w-3 h-3 bg-white rounded-full transition-transform duration-200 ${
              rule.enabled ? 'translate-x-5' : 'translate-x-1'
            }`} />
          </div>
        </label>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 mb-3">
        {/* Timing */}
        <div>
          <div className="font-semibold uppercase tracking-wide text-gray-500 mb-1">
            TIMING
          </div>
          <div className="text-gray-700">
            {getTimingDescription()}
          </div>
        </div>

        {/* Template */}
        <div>
          <div className="font-semibold uppercase tracking-wide text-gray-500 mb-1">
            TEMPLATE
          </div>
          <div className="flex items-center gap-2">
            {rule.message_templates?.channel && (
              <span className={`px-2 py-1 rounded text-xs ${getChannelColor()}`}>
                {rule.message_templates.channel}
              </span>
            )}
            <span className="text-gray-700 truncate">
              {connectedTemplate || rule.message_templates?.name || 'No template'}
            </span>
          </div>
        </div>

        {/* Backfill */}
        <div>
          <div className="font-semibold uppercase tracking-wide text-gray-500 mb-1">
            BACKFILL
          </div>
          <div className="text-gray-700">
            {rule.backfill === 'none' ? 'No backfill' :
             rule.backfill === 'skip_if_past' ? 'Skip if past' :
             rule.backfill === 'until_checkin' ? 'Until check-in' :
             rule.backfill}
          </div>
        </div>
      </div>

      {/* Actions Row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onEdit(rule)}
          className="text-xs px-3 py-1.5 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Configure
        </button>

        {connectedTemplate && (
          <div className="text-xs text-gray-500">
            Connected to: <span className="font-medium">{connectedTemplate}</span>
          </div>
        )}
      </div>
    </div>
  );
}
