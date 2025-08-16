import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/badge';
import { adminAPI } from '../../services/api';

export default function TemplateManagementPanel() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, enabled: 0, disabled: 0 });
  const [error, setError] = useState(null);
  const [toggling, setToggling] = useState(new Set());

  useEffect(() => {
    loadTemplates();
    loadStats();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getAutomationTemplates();
      setTemplates(response.data.templates || []);
      setError(null);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await adminAPI.getAutomationTemplateStats();
      setStats(response.data.stats || { total: 0, enabled: 0, disabled: 0 });
    } catch (err) {
      console.error('Error loading template stats:', err);
    }
  };

  const toggleTemplate = async (templateId, currentStatus) => {
    const newStatus = !currentStatus;
    
    try {
      setToggling(prev => new Set(prev).add(templateId));
      
      await adminAPI.toggleAutomationTemplate(templateId, newStatus);
      
      // Update the template in the list
      setTemplates(prev => prev.map(template => 
        template.id === templateId 
          ? { ...template, enabled: newStatus }
          : template
      ));
      
      // Update stats
      setStats(prev => ({
        ...prev,
        enabled: newStatus ? prev.enabled + 1 : prev.enabled - 1,
        disabled: newStatus ? prev.disabled - 1 : prev.disabled + 1
      }));

    } catch (err) {
      console.error('Error toggling template:', err);
      setError(err.message);
    } finally {
      setToggling(prev => {
        const newSet = new Set(prev);
        newSet.delete(templateId);
        return newSet;
      });
    }
  };

  const bulkToggle = async (enabled) => {
    const templateIds = templates.map(t => t.id);
    
    try {
      setLoading(true);
      
      await adminAPI.bulkToggleAutomationTemplates(templateIds, enabled);

      // Reload templates to get updated state
      await loadTemplates();
      await loadStats();
      
    } catch (err) {
      console.error('Error bulk toggling templates:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && templates.length === 0) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
                <div className="w-12 h-6 bg-gray-200 rounded-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Message Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Control which templates are active for automated messaging
            </p>
          </div>
          <button
            onClick={loadTemplates}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh templates"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Statistics */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Total: {stats.total}
            </Badge>
            <Badge variant="default" className="bg-green-100 text-green-800 text-sm">
              Enabled: {stats.enabled}
            </Badge>
            <Badge variant="destructive" className="bg-red-100 text-red-800 text-sm">
              Disabled: {stats.disabled}
            </Badge>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => bulkToggle(true)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-md hover:bg-green-200 disabled:opacity-50 transition-colors"
          >
            Enable All
          </button>
          <button
            onClick={() => bulkToggle(false)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50 transition-colors"
          >
            Disable All
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Template List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">No message templates found</p>
              <p className="text-xs text-gray-400 mt-1">Templates will appear here once created</p>
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`p-4 border rounded-lg transition-all ${
                  template.enabled 
                    ? 'border-green-200 bg-green-50' 
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {template.name}
                      </h3>
                      <Badge 
                        variant={template.enabled ? "default" : "destructive"}
                        className={`text-xs ${
                          template.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {template.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {template.content ? 
                        (template.content.length > 100 ? 
                          template.content.substring(0, 100) + '...' : 
                          template.content
                        ) : 
                        'No content'
                      }
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Channel: {template.channel}</span>
                      {template.language && <span>Language: {template.language}</span>}
                      <span>Created: {new Date(template.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  
                  {/* Toggle Switch */}
                  <div className="ml-4">
                    <label className="inline-flex items-center">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={template.enabled}
                        disabled={toggling.has(template.id)}
                        onChange={() => toggleTemplate(template.id, template.enabled)}
                      />
                      <div className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 ${
                        template.enabled ? 'bg-green-500' : 'bg-gray-300'
                      } ${toggling.has(template.id) ? 'opacity-50' : ''}`}>
                        <span className={`inline-block w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                          template.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </div>
                    </label>
                    {toggling.has(template.id) && (
                      <div className="flex items-center justify-center ml-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
