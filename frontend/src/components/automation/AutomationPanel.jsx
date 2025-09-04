import React, { useState, useEffect, useRef } from 'react';
import { adminAPI, messageRulesAPI } from '../../services/api';
import { useProperty } from '../../contexts/PropertyContext';
import TemplateEditorDrawer from './templates/TemplateEditorDrawer';
import CompactRuleCard from './CompactRuleCard';
import RuleFormDrawer from './rules/RuleFormDrawer';

export default function CombinedAutomationManager() {
  const { selectedPropertyId } = useProperty();
  const [templates, setTemplates] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [hoveredTemplate, setHoveredTemplate] = useState(null);
  const [hoveredRule, setHoveredRule] = useState(null);
  const [templatePositions, setTemplatePositions] = useState({});
  const [rulePositions, setRulePositions] = useState({});
  const containerRef = useRef(null);
  const templatesRef = useRef(null);
  const rulesRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [selectedPropertyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load templates and rules in parallel
      const [templatesResponse, rulesResponse] = await Promise.all([
        adminAPI.getAutomationTemplates(),
        messageRulesAPI.getRules(selectedPropertyId ? { property_id: selectedPropertyId } : {})
      ]);
      
      setTemplates(templatesResponse.data.templates || []);
      setRules(rulesResponse.data.rules || []);
    } catch (err) {
      console.error('Error loading automation data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Template handlers
  const handleEditTemplate = (template) => {
    setSelectedTemplate(template);
    setIsTemplateEditorOpen(true);
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      await adminAPI.updateAutomationTemplate(templateData.id, templateData);
      setTemplates(prev => prev.map(t => 
        t.id === templateData.id ? { ...t, ...templateData } : t
      ));
      setIsTemplateEditorOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      console.error('Error saving template:', err);
      setError(err.message);
    }
  };

  const handleCloseTemplateEditor = () => {
    setIsTemplateEditorOpen(false);
    setSelectedTemplate(null);
  };

  // Rule handlers
  const handleEditRule = (rule) => {
    setSelectedRule(rule);
    setIsRuleFormOpen(true);
  };

  const handleRuleUpdate = async (ruleId, updates) => {
    try {
      await messageRulesAPI.updateRule(ruleId, updates);
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ));
    } catch (err) {
      console.error('Error updating rule:', err);
      setError(err.message);
    }
  };

  const handleSaveRule = async (ruleData) => {
    try {
      await handleRuleUpdate(ruleData.id, ruleData);
      setIsRuleFormOpen(false);
      setSelectedRule(null);
    } catch (err) {
      console.error('Error saving rule:', err);
    }
  };

  const handleCloseRuleForm = () => {
    setIsRuleFormOpen(false);
    setSelectedRule(null);
  };

  // Get stats for header
  const getStats = () => {
    const ruleStats = {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length
    };
    
    return {
      templates: templates.length,
      rules: ruleStats.total,
      activeRules: ruleStats.enabled,
      totalAutomations: templates.length + ruleStats.enabled
    };
  };

  // Update element positions for connector lines
  const updatePositions = () => {
    if (!containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newTemplatePositions = {};
    const newRulePositions = {};

    // Get template positions
    templates.forEach(template => {
      const element = document.querySelector(`[data-template-id="${template.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        newTemplatePositions[template.id] = {
          x: rect.right - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        };
      }
    });

    // Get rule positions
    rules.forEach(rule => {
      const element = document.querySelector(`[data-rule-id="${rule.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        newRulePositions[rule.id] = {
          x: rect.left - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        };
      }
    });

    setTemplatePositions(newTemplatePositions);
    setRulePositions(newRulePositions);
  };

  // Update positions when templates or rules change
  useEffect(() => {
    const timer = setTimeout(updatePositions, 100);
    return () => clearTimeout(timer);
  }, [templates, rules]);

  // Handle scroll and resize events
  useEffect(() => {
    const handleUpdate = () => updatePositions();
    
    if (templatesRef.current) {
      templatesRef.current.addEventListener('scroll', handleUpdate);
    }
    if (rulesRef.current) {
      rulesRef.current.addEventListener('scroll', handleUpdate);
    }
    window.addEventListener('resize', handleUpdate);

    return () => {
      if (templatesRef.current) {
        templatesRef.current.removeEventListener('scroll', handleUpdate);
      }
      if (rulesRef.current) {
        rulesRef.current.removeEventListener('scroll', handleUpdate);
      }
      window.removeEventListener('resize', handleUpdate);
    };
  }, []);

  // Find template-rule relationships
  const getTemplateRuleConnections = () => {
    const connections = [];
    templates.forEach(template => {
      rules.forEach(rule => {
        // Enhanced connection logic
        if (rule.template_id === template.id || 
            (rule.message_templates?.name === template.name) ||
            (rule.channel === template.channel && rule.enabled)) {
          connections.push({
            templateId: template.id,
            ruleId: rule.id,
            channel: template.channel,
            templatePos: templatePositions[template.id],
            rulePos: rulePositions[rule.id]
          });
        }
      });
    });
    return connections.filter(c => c.templatePos && c.rulePos);
  };

  // Get subtle colors for connectors
  const getConnectorColor = (channel, isActive = false) => {
    const opacity = isActive ? 0.6 : 0.3;
    const colors = {
      email: `rgba(34, 197, 94, ${opacity})`,      // Muted green
      sms: `rgba(168, 85, 247, ${opacity})`,       // Muted purple  
      whatsapp: `rgba(5, 150, 105, ${opacity})`,   // Muted emerald
      inapp: `rgba(107, 114, 128, ${opacity})`     // Muted gray
    };
    return colors[channel] || colors.inapp;
  };

  const stats = getStats();
  const connections = getTemplateRuleConnections();

  if (loading && templates.length === 0 && rules.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-16 bg-gray-200 rounded-lg"></div>
          <div className="flex gap-6">
            <div className="w-2/5 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
            <div className="w-3/5 grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-40 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex bg-white" ref={containerRef}>
      {/* Error Message */}
      {error && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Split Panel Layout */}
      <div className="flex-1 flex relative">
        {/* Left Panel - Templates Timeline */}
        <div className="w-[40%] bg-gray-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
              <span className="text-sm text-gray-500">{templates.length} templates</span>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No templates found</h3>
                <p className="text-xs text-gray-500">
                  Templates will appear here when created
                </p>
              </div>
            ) : (
              <div className="timeline-container relative">
                {/* Vertical Timeline Spine */}
                <div className="absolute left-3 top-0 w-0.5 h-full bg-gradient-to-b from-blue-200 via-purple-200 to-green-200"></div>
                
                {/* Timeline Items */}
                <div className="space-y-6">
                  {templates
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((template, index) => (
                    <div 
                      key={template.id} 
                      className={`relative transition-all duration-200 ${
                        hoveredTemplate === template.id || connections.some(c => 
                          c.templateId === template.id && hoveredRule === c.ruleId
                        ) ? 'opacity-100' : 
                        (hoveredRule || hoveredTemplate) ? 'opacity-50' : 'opacity-100'
                      }`}
                      onMouseEnter={() => setHoveredTemplate(template.id)}
                      onMouseLeave={() => setHoveredTemplate(null)}
                      data-template-id={template.id}
                    >
                      <div className="flex items-start gap-4">
                        {/* Timeline marker */}
                        <div className="flex-shrink-0 mt-2">
                          <div className={`w-6 h-6 rounded-full border-2 border-white shadow-sm ${
                            template.channel === 'inapp' ? 'bg-gray-500' :
                            template.channel === 'email' ? 'bg-green-500' :
                            template.channel === 'sms' ? 'bg-purple-500' :
                            template.channel === 'whatsapp' ? 'bg-emerald-500' :
                            'bg-gray-500'
                          } flex items-center justify-center transition-all duration-200 ${
                            hoveredTemplate === template.id ? 'scale-110 shadow-md' : ''
                          } relative z-10`}>
                            <div className={`w-2 h-2 rounded-full ${
                              template.channel === 'inapp' ? 'bg-gray-200' :
                              template.channel === 'email' ? 'bg-green-200' :
                              template.channel === 'sms' ? 'bg-purple-200' :
                              template.channel === 'whatsapp' ? 'bg-emerald-200' :
                              'bg-gray-200'
                            }`}></div>
                        </div>
                      </div>
                      
                      {/* Template content */}
                      <div className="flex-1 min-w-0">
                        <div className={`bg-white rounded-lg border border-gray-200 p-4 transition-all duration-200 hover:shadow-sm ${
                          hoveredTemplate === template.id ? 'shadow-md border-blue-200' : ''
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">                              
                              <span className="text-sm font-medium text-gray-900">
                                {template.name}
                              </span>
                            </div>
                            <button
                              onClick={() => handleEditTemplate(template)}
                              className="text-xs px-2 py-1 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                            >
                              Edit
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {template.content || 'No description'}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              template.channel === 'inapp' ? 'bg-gray-100 text-gray-700' :
                              template.channel === 'email' ? 'bg-green-100 text-green-700' :
                              template.channel === 'sms' ? 'bg-purple-100 text-purple-700' :
                              template.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {template.channel}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Rules List */}
        <div className="w-[60%] px-8 bg-gray-50 overflow-y-auto" ref={rulesRef}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Rules</h2>
              <span className="text-sm text-gray-500">{rules.length} rules</span>
            </div>

            {rules.length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No rules found</h3>
                <p className="text-xs text-gray-500">
                  Rules will appear here once configured
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => {
                  const connectedTemplate = connections
                    .filter(c => c.ruleId === rule.id)
                    .map(c => templates.find(t => t.id === c.templateId)?.name)
                    .filter(Boolean)[0];

                  return (
                    <div
                      key={rule.id}
                      onMouseEnter={() => setHoveredRule(rule.id)}
                      onMouseLeave={() => setHoveredRule(null)}
                      className={`transition-all duration-200 ${
                        hoveredRule === rule.id || connections.some(c => 
                          c.ruleId === rule.id && hoveredTemplate === c.templateId
                        ) ? 'opacity-100' : 
                        (hoveredRule || hoveredTemplate) ? 'opacity-50' : 'opacity-100'
                      }`}
                      data-rule-id={rule.id}
                    >
                      <CompactRuleCard
                        rule={rule}
                        onEdit={() => handleEditRule(rule)}
                        onToggle={handleRuleUpdate}
                        connectedTemplate={connectedTemplate}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Connector Lines Overlay */}
        <svg className="absolute inset-0 pointer-events-none z-10" style={{ overflow: 'visible' }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="rgba(107, 114, 128, 0.4)" />
            </marker>
          </defs>
          
          {connections.map(connection => {
            const isActive = hoveredTemplate === connection.templateId || hoveredRule === connection.ruleId;
            const showConnection = isActive || (!hoveredTemplate && !hoveredRule);
            
            if (!showConnection || !connection.templatePos || !connection.rulePos) return null;

            const x1 = connection.templatePos.x;
            const y1 = connection.templatePos.y;
            const x2 = connection.rulePos.x;
            const y2 = connection.rulePos.y;
            
            // Create curved path for more elegant connection
            const midX = (x1 + x2) / 2;
            const curvature = Math.abs(x2 - x1) * 0.3;
            const pathData = `M ${x1} ${y1} Q ${midX + curvature} ${y1} ${midX} ${(y1 + y2) / 2} Q ${midX - curvature} ${y2} ${x2} ${y2}`;

            return (
              <g key={`${connection.templateId}-${connection.ruleId}`}>
                <path
                  d={pathData}
                  stroke={getConnectorColor(connection.channel, isActive)}
                  strokeWidth={isActive ? "2" : "1"}
                  fill="none"
                  strokeDasharray={isActive ? "6,3" : "4,6"}
                  markerEnd={isActive ? "url(#arrowhead)" : ""}
                  className={isActive ? "animate-pulse" : ""}
                  style={{
                    transition: 'all 0.2s ease-in-out'
                  }}
                />
                
                {/* Connection point indicators */}
                {isActive && (
                  <>
                    <circle
                      cx={x1}
                      cy={y1}
                      r="3"
                      fill={getConnectorColor(connection.channel, true)}
                      className="animate-pulse"
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="3"
                      fill={getConnectorColor(connection.channel, true)}
                      className="animate-pulse"
                    />
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Template Editor Drawer */}
      {isTemplateEditorOpen && selectedTemplate && (
        <TemplateEditorDrawer
          template={selectedTemplate}
          isOpen={isTemplateEditorOpen}
          onClose={handleCloseTemplateEditor}
          onSave={handleSaveTemplate}
        />
      )}

      {/* Rule Form Drawer */}
      {isRuleFormOpen && selectedRule && (
        <RuleFormDrawer
          rule={selectedRule}
          isOpen={isRuleFormOpen}
          onClose={handleCloseRuleForm}
          onSave={handleSaveRule}
        />
      )}
    </div>
  );
}
