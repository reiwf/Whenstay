import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../services/api';
import TemplateCard from './templates/TemplateCard';
import TemplateEditorDrawer from './templates/TemplateEditorDrawer';

export default function TemplateLibrary() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  useEffect(() => {
    loadTemplates();
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

  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      // Update existing template
      await adminAPI.updateAutomationTemplate(templateData.id, templateData);
      setTemplates(prev => prev.map(t => 
        t.id === templateData.id ? { ...t, ...templateData } : t
      ));
      
      setIsEditorOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message);
    }
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedTemplate(null);
  };

  if (loading && templates.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100">
      {/* Error Message */}
      {error && (
        <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-8">
        {templates.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-500 mb-4">
              Templates will appear here when created through message rules
            </p>
          </div>
        ) : (
          <div className="timeline-container max-w-5xl mx-auto relative">
            {/* Desktop Timeline Layout */}
            <div className="hidden md:block">
              {/* Timeline spine */}
              <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-200 via-purple-200 to-green-200"></div>
              
              {/* Timeline items */}
              <div className="space-y-6 py-4">
                {templates
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((template, index) => (
                  <div key={template.id} className={`timeline-item flex items-center ${
                    index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                  } relative`}>
                    {/* Timeline marker */}
                    <div className="timeline-marker absolute left-1/2 transform -translate-x-1/2 z-10">
                      <div className={`w-6 h-6 rounded-full border-3 border-white shadow-lg ${
                        template.channel === 'inapp' ? 'bg-gray-500' :
                        template.channel === 'email' ? 'bg-green-500' :
                        template.channel === 'sms' ? 'bg-purple-500' :
                        template.channel === 'whatsapp' ? 'bg-emerald-500' :
                        'bg-gray-500'
                      } flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${
                          template.channel === 'inapp' ? 'bg-gray-200' :
                          template.channel === 'email' ? 'bg-green-200' :
                          template.channel === 'sms' ? 'bg-purple-200' :
                          template.channel === 'whatsapp' ? 'bg-emerald-200' :
                          'bg-gray-200'
                        }`}></div>
                      </div>
                    </div>
                    
                    {/* Template card container */}
                    <div className={`timeline-card-container ${
                      index % 2 === 0 ? 'pr-12 pl-0' : 'pl-12 pr-0'
                    } w-1/2`}>
                      <TemplateCard
                        template={template}
                        onEdit={() => handleEditTemplate(template)}
                        timelineMode={true}
                        position={index % 2 === 0 ? 'left' : 'right'}
                      />
                    </div>
                    
                    {/* Spacer for the other side */}
                    <div className="w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Mobile Timeline Layout */}
            <div className="md:hidden relative">
              <div className="absolute left-8 top-0 w-0.5 h-full bg-gradient-to-b from-blue-200 via-purple-200 to-green-200"></div>
              <div className="space-y-4 py-4">
                {templates
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((template, index) => (
                  <div key={`mobile-${template.id}`} className="relative pl-20">
                    {/* Mobile timeline marker */}
                    <div className="absolute left-6 top-6 transform -translate-x-1/2">
                      <div className={`w-6 h-6 rounded-full border-3 border-white shadow-lg ${
                        template.channel === 'inapp' ? 'bg-blue-500' :
                        template.channel === 'email' ? 'bg-green-500' :
                        template.channel === 'sms' ? 'bg-purple-500' :
                        template.channel === 'whatsapp' ? 'bg-emerald-500' :
                        'bg-gray-500'
                      } flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${
                          template.channel === 'inapp' ? 'bg-blue-200' :
                          template.channel === 'email' ? 'bg-green-200' :
                          template.channel === 'sms' ? 'bg-purple-200' :
                          template.channel === 'whatsapp' ? 'bg-emerald-200' :
                          'bg-gray-200'
                        }`}></div>
                      </div>
                    </div>
                    
                    <TemplateCard
                      template={template}
                      onEdit={() => handleEditTemplate(template)}
                      timelineMode={true}
                      position="mobile"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Template Editor Drawer */}
      {isEditorOpen && selectedTemplate && (
        <TemplateEditorDrawer
          template={selectedTemplate}
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          onSave={handleSaveTemplate}
        />
      )}
    </div>
  );
}
