import React from 'react';
import GlassCard from '../shared/GlassCard';

const channelIcons = {
  inapp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  sms: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21l4-4 4 4M6 18V6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2z" />
    </svg>
  ),
  whatsapp: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
};

const channelColors = {
  inapp: 'text-blue-600 bg-blue-50',
  email: 'text-green-600 bg-green-50',
  sms: 'text-purple-600 bg-purple-50',
  whatsapp: 'text-emerald-600 bg-emerald-50'
};

export default function TemplateCard({ template, onEdit, timelineMode = false, position = 'left' }) {

  const truncateContent = (content, maxLength = 120) => {
    if (!content) return 'No content';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  // Timeline-specific styling
  const timelineCardClass = timelineMode ? 
    `relative transition-all duration-300` :
    '';

  const timelineConnector = timelineMode && position !== 'mobile' ? (
    <div className={`absolute top-1/2 ${
      position === 'left' ? 'right-0 transform translate-x-full' : 'left-0 transform -translate-x-full'
    } w-8 h-0.5 ${
      template.channel === 'inapp' ? 'bg-gray-300' :
      template.channel === 'email' ? 'bg-green-300' :
      template.channel === 'sms' ? 'bg-purple-300' :
      template.channel === 'whatsapp' ? 'bg-emerald-300' :
      'bg-gray-300'
    } -translate-y-1/2 z-0`}>
      <div className={`absolute ${
        position === 'left' ? 'right-0' : 'left-0'
      } top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full ${
        template.channel === 'inapp' ? 'bg-gray-400' :
        template.channel === 'email' ? 'bg-green-400' :
        template.channel === 'sms' ? 'bg-purple-400' :
        template.channel === 'whatsapp' ? 'bg-emerald-400' :
        'bg-gray-400'
      }`}></div>
    </div>
  ) : null;

  // Bar-style compact layout for timeline mode
  if (timelineMode) {
    return (
      <div className={`relative ${timelineCardClass}`}>
        {timelineConnector}
        <GlassCard className="p-3 shadow-md">
          <div className="flex items-center justify-between">
            {/* Left side - Main info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Channel indicator */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${channelColors[template.channel] || 'text-gray-600 bg-gray-50'}`}>
                {channelIcons[template.channel]}
                {template.channel}
              </div>
              
              {/* Template name */}
              <h3 className="font-medium text-gray-900 truncate text-sm">{template.name}</h3>
              
              {/* Language if available */}
              {template.language && (
                <div className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                  {template.language.toUpperCase()}
                </div>
              )}
            </div>

            {/* Right side - Variables count and actions */}
            <div className="flex items-center gap-2">
              {/* Variables count */}
              {template.variables && template.variables.length > 0 && (
                <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-200">
                  {template.variables.length} vars
                </span>
              )}
              
              {/* Edit button */}
              <button
                onClick={() => onEdit(template)}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
          
          {/* Content preview - compact */}
          <div className="mt-2">
            <p className="text-xs text-gray-600 line-clamp-1">
              {truncateContent(template.content, 80)}
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Regular card layout for non-timeline mode
  return (
    <GlassCard className="p-2.5 sm:p-3 shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={`px-1.5 py-0.5 rounded-full text-[11px] ${channelColors[template.channel] || 'text-gray-600 bg-gray-50'}`}>
            <span className="inline-flex items-center gap-1">
              {channelIcons[template.channel]}
              <span className="hidden sm:inline">{template.channel}</span>
            </span>
          </div>
          <h3 className="font-medium text-gray-900 truncate text-[13px]">{template.name}</h3>
          {template.language && (
            <span className="px-1 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
              {template.language.toUpperCase()}
            </span>
          )}
        </div>
        {template.variables?.length > 0 && (
          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] rounded border border-amber-200">
            {template.variables.length} vars
          </span>
        )}
        <button
          onClick={() => onEdit(template)}
          className="px-2 py-1 text-[11px] font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100"
        >
          Edit
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-gray-600 line-clamp-1">
        {truncateContent(template.content, 80)}
      </p>
    </GlassCard>

  );
}
