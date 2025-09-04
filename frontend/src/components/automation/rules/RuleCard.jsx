import React, { useState } from 'react';
import GlassCard from '../shared/GlassCard';
import StatusChip from '../shared/StatusChip';

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

const backfillLabels = {
  'none': 'No backfill',
  'skip_if_past': 'Skip if past',
  'until_checkin': 'Until check-in'
};

const channelIcons = {
  inapp: '💬',
  email: '📧', 
  sms: '📱',
  whatsapp: '📞'
};

export default function RuleCard({ rule, onEdit, onToggle }) {
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

  const getChannelIcon = () => {
    const channel = rule.message_templates?.channel || 'inapp';
    return channelIcons[channel] || '💬';
  };

  return (
    <GlassCard className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-blue-600">
                {rule.code}
              </span>
              <h3 className="font-semibold text-gray-900 truncate">
                {rule.name}
              </h3>
            </div>
            <StatusChip status={rule.enabled ? 'enabled' : 'disabled'} />
          </div>
          
          {/* Property Scope */}
          {rule.property_id && (
            <div className="mb-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Property Specific
              </span>
            </div>
          )}
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

      {/* Rule Details */}
      <div className="space-y-3 mb-4">
        {/* Timing */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            TIMING
          </div>
          <div className="text-sm text-gray-700">
            {getTimingDescription()}
          </div>
        </div>

        {/* Template & Channel */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            TEMPLATE
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>{getChannelIcon()}</span>
            <span>{rule.message_templates?.name || 'No template'}</span>
            {rule.message_templates?.channel && (
              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                {rule.message_templates.channel}
              </span>
            )}
          </div>
        </div>

        {/* Backfill Policy */}
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            BACKFILL
          </div>
          <div className="text-sm text-gray-700">
            {backfillLabels[rule.backfill] || rule.backfill}
          </div>
        </div>

        {/* Timezone */}
        {rule.timezone && rule.timezone !== 'Asia/Tokyo' && (
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              TIMEZONE
            </div>
            <div className="text-sm text-gray-700">
              {rule.timezone}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={() => onEdit(rule)}
          className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Configure
        </button>

        <button 
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          title="Rule options"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </GlassCard>
  );
}
