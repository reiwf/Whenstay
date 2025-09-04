import React from 'react';

export default function TemplateFilters({ filters, onFiltersChange, templates }) {
  // Get unique values from templates for filter options
  const channels = [...new Set(templates.map(t => t.channel))].filter(Boolean);
  const languages = [...new Set(templates.map(t => t.language))].filter(Boolean);

  const updateFilter = (key, value) => {
    onFiltersChange(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Search */}
      <div className="flex-1 min-w-64">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Channel Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Channel:</label>
        <select
          value={filters.channel}
          onChange={(e) => updateFilter('channel', e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="all">All Channels</option>
          {channels.map(channel => (
            <option key={channel} value={channel}>
              {channel.charAt(0).toUpperCase() + channel.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Language Filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Language:</label>
        <select
          value={filters.language}
          onChange={(e) => updateFilter('language', e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        >
          <option value="all">All Languages</option>
          {languages.map(language => (
            <option key={language} value={language}>
              {language.toUpperCase()}
            </option>
          ))}
        </select>
      </div>


      {/* Clear Filters */}
      {(filters.search || filters.channel !== 'all' || filters.language !== 'all') && (
        <button
          onClick={() => onFiltersChange({
            channel: 'all',
            language: 'all',
            search: ''
          })}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
