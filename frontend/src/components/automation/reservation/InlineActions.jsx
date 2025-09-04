import React, { useState } from 'react';

export default function InlineActions({ reservationId, messageCount, onAction }) {
  const [actionLoading, setActionLoading] = useState(null);

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      await onAction(action);
    } finally {
      setActionLoading(null);
    }
  };

  const actions = [
    {
      key: 'preview',
      label: 'Preview',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
      description: 'Preview what messages would be generated'
    },
    {
      key: 'regenerate',
      label: 'Regenerate',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
      description: 'Cancel existing and generate new messages'
    }
  ];

  if (messageCount > 0) {
    actions.push({
      key: 'cancel_all',
      label: 'Cancel All',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      color: 'text-red-600 bg-red-50 hover:bg-red-100',
      description: 'Cancel all pending messages'
    });
  }

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={() => handleAction(action.key)}
          disabled={actionLoading === action.key}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-lg transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-1.5
            ${action.color}
          `}
          title={action.description}
        >
          {actionLoading === action.key ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            action.icon
          )}
          {action.label}
        </button>
      ))}
      
      {/* More Actions Dropdown */}
      <div className="relative">
        <button 
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="More options"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
