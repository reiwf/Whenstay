import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../../services/api';

export default function TemplateEditorDrawer({ template, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    channel: 'inapp',
    language: 'en',
    enabled: false,
    variables: []
  });
  const [loading, setLoading] = useState(false);
  const [availableVariables, setAvailableVariables] = useState([]);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name || '',
        content: template.content || '',
        channel: template.channel || 'inapp',
        language: template.language || 'en',
        enabled: template.enabled || false,
        variables: template.variables || []
      });
    }
    
    if (isOpen) {
      loadAvailableVariables();
    }
  }, [template, isOpen]);

  const loadAvailableVariables = async () => {
    try {
      const response = await adminAPI.getAvailableTemplateVariables();
      setAvailableVariables(response.data.variables || {});
    } catch (err) {
      console.error('Error loading variables:', err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear preview when content changes
    if (field === 'content') {
      setPreviewData(null);
    }
  };

  const insertVariable = (variableKey) => {
    const variable = `{{${variableKey}}}`;
    const textarea = document.getElementById('template-content');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentContent = formData.content;
    
    const newContent = currentContent.substring(0, start) + variable + currentContent.substring(end);
    handleInputChange('content', newContent);
    
    // Focus back to textarea and position cursor after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 10);
  };

  const generatePreview = () => {
    // Simple preview with sample data
    const sampleData = {
      guestName: 'John Smith',
      checkInDate: '2024-03-15',
      checkInTime: '15:00',
      checkOutDate: '2024-03-18',
      checkOutTime: '11:00',
      propertyName: 'Sample Property',
      room: 'Room 201',
      wifiName: 'PropertyWiFi',
      wifiPassword: 'password123'
    };

    let preview = formData.content;
    Object.entries(sampleData).forEach(([key, value]) => {
      preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    setPreviewData(preview);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const templateData = {
        ...template,
        ...formData
      };
      
      await onSave(templateData);
    } catch (err) {
      console.error('Error saving template:', err);
    } finally {
      setLoading(false);
    }
  };

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
                {template?.id ? 'Edit Template' : 'Create Template'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure message template content and settings
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
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => handleInputChange('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="en">English</option>
                    <option value="ja">Japanese</option>
                    <option value="ko">Korean</option>
                    <option value="zh-CN">Chinese (Simplified)</option>
                    <option value="zh-TW">Chinese (Traditional)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Channel is automatically determined by booking source (Airbnb, Booking.com, etc.)
                  </p>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) => handleInputChange('enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="ml-2 block text-sm text-gray-700">
                  Enable this template
                </label>
              </div>
            </div>

            {/* Content Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Template Content
                </label>
                <button
                  type="button"
                  onClick={generatePreview}
                  className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                >
                  Preview
                </button>
              </div>
              <textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                placeholder="Enter your message template..."
                rows="8"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
              />
            </div>

            {/* Available Variables */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Available Variables</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {Object.entries(availableVariables).map(([category, data]) => (
                  <div key={category}>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {data.label}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {data.variables.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => insertVariable(variable.key)}
                          className="text-left p-2 text-xs bg-gray-50 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                          title={variable.description}
                        >
                          <div className="font-mono text-blue-600 group-hover:text-blue-800">
                            {`{{${variable.key}}}`}
                          </div>
                          <div className="text-gray-500 truncate">
                            {variable.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {previewData && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Preview</h3>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                    {previewData}
                  </pre>
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
              {loading ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
