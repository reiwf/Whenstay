import React from 'react';

const ruleTypes = [
  {
    value: 'ON_CREATE_DELAY_MIN',
    label: 'On Create + Delay',
    description: 'Send message X minutes after reservation is created',
    icon: '⏰',
    fields: ['delay_minutes'],
    example: 'Welcome message 5 minutes after booking'
  },
  {
    value: 'BEFORE_ARRIVAL_DAYS_AT_TIME',
    label: 'Before Arrival',
    description: 'Send message X days before arrival at specific time',
    icon: '📅',
    fields: ['days', 'at_time'],
    example: '3 days before arrival at 10:00 AM'
  },
  {
    value: 'ARRIVAL_DAY_HOURS_BEFORE_CHECKIN',
    label: 'Arrival Day Before Check-in',
    description: 'Send message X hours before check-in time',
    icon: '🏨',
    fields: ['hours'],
    example: '2 hours before 3 PM check-in = 1 PM'
  },
  {
    value: 'AFTER_CHECKIN_HOURS',
    label: 'After Check-in',
    description: 'Send message X hours after check-in time',
    icon: '✅',
    fields: ['hours'],
    example: '1 hour after check-in for WiFi info'
  },
  {
    value: 'BEFORE_CHECKOUT_HOURS',
    label: 'Before Check-out',
    description: 'Send message X hours before check-out time',
    icon: '🚪',
    fields: ['hours'],
    example: '2 hours before 11 AM checkout = 9 AM'
  },
  {
    value: 'AFTER_DEPARTURE_DAYS',
    label: 'After Departure',
    description: 'Send message X days after check-out',
    icon: '💌',
    fields: ['days'],
    example: 'Thank you message 1 day after checkout'
  }
];

export default function RuleTypeSelector({ selected, onChange, disabled = false }) {
  const selectedRule = ruleTypes.find(rule => rule.value === selected);

  return (
    <div className="space-y-6">
      {/* Current Selection Display */}
      {selectedRule && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{selectedRule.icon}</span>
            <div>
              <div className="font-semibold text-blue-900">{selectedRule.label}</div>
              <div className="text-sm text-blue-700">{selectedRule.description}</div>
            </div>
          </div>
          
          <div className="text-xs text-blue-600 mt-2">
            <span className="font-medium">Required Fields:</span> {selectedRule.fields.join(', ')}
          </div>
          <div className="text-xs text-blue-600">
            <span className="font-medium">Example:</span> {selectedRule.example}
          </div>
        </div>
      )}

      {/* Rule Type Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ruleTypes.map((ruleType) => (
          <label
            key={ruleType.value}
            className={`block p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
              selected === ruleType.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="rule-type"
              value={ruleType.value}
              checked={selected === ruleType.value}
              onChange={(e) => onChange && onChange(e.target.value)}
              disabled={disabled}
              className="sr-only"
            />
            
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-1 flex-shrink-0">
                {ruleType.icon}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 mb-1">
                  {ruleType.label}
                </div>
                <div className="text-sm text-gray-600 mb-2 leading-relaxed">
                  {ruleType.description}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">Example:</span> {ruleType.example}
                </div>
                
                {/* Field Requirements */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {ruleType.fields.map((field) => (
                    <span
                      key={field}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium"
                    >
                      {field.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </label>
        ))}
      </div>

      {/* Information Panel */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-amber-800">
            <div className="font-medium mb-1">Rule Type Guide</div>
            <p>
              Each rule type determines when messages are sent relative to reservation events. 
              Choose the timing pattern that matches your communication strategy, then configure 
              the specific timing parameters in the form below.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
