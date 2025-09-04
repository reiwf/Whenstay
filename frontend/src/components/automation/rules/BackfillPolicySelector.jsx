import React from 'react';

const backfillPolicies = [
  {
    value: 'none',
    label: 'No Backfill',
    description: 'Only create messages for future scheduled times. If the scheduled time has passed, no message will be created.',
    icon: '🚫'
  },
  {
    value: 'skip_if_past',
    label: 'Skip if Past',
    description: 'Create message only if scheduled time is in the future. If past, mark as skipped without sending.',
    icon: '⏭️'
  },
  {
    value: 'until_checkin',
    label: 'Until Check-in',
    description: 'Allow backfill as long as guest hasn\'t checked in yet. Send immediately if scheduled time has passed but check-in is still in the future.',
    icon: '🏨'
  }
];

export default function BackfillPolicySelector({ selected, onChange }) {
  return (
    <div className="space-y-3">
      {backfillPolicies.map((policy) => (
        <label
          key={policy.value}
          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
            selected === policy.value
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <input
            type="radio"
            name="backfill-policy"
            value={policy.value}
            checked={selected === policy.value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{policy.icon}</span>
              <span className="font-medium text-gray-900">{policy.label}</span>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {policy.description}
            </p>
          </div>
        </label>
      ))}
      
      {/* Additional explanation */}
      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-amber-800">
            <div className="font-medium mb-1">Backfill Policy Explanation</div>
            <p>
              Backfill policies determine what happens when a rule's scheduled time has already passed 
              when the system tries to create the message. This is common for existing reservations 
              when rules are enabled or modified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
