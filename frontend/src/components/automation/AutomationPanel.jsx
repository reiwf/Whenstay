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
  const [selectedLanguageTabs, setSelectedLanguageTabs] = useState({}); // Track selected language per rule
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

  const handleAddLanguage = (rule, existingTemplate = null) => {
    // Create a new template based on existing one or rule
    const baseTemplate = existingTemplate || {
      name: `${rule.name} (New Language)`,
      content: existingTemplate?.content || `Hello {{guest_name}},\n\nWelcome to {{property_name}}!\n\nCheck-in: {{check_in_date}}\nCheck-out: {{check_out_date}}\n\nBest regards`,
      language: 'ja', // Default to Japanese
      enabled: true,
      channel: 'email' // Will be auto-detected anyway
    };

    setSelectedTemplate({
      ...baseTemplate,
      id: null, // Ensure it's treated as new template
      isNewLanguageTemplate: true,
      associatedRuleId: rule.id,
      associatedRuleName: rule.name
    });
    setIsTemplateEditorOpen(true);
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      if (templateData.id) {
        // Update existing template
        await adminAPI.updateAutomationTemplate(templateData.id, templateData);
        setTemplates(prev => prev.map(t => 
          t.id === templateData.id ? { ...t, ...templateData } : t
        ));
      } else {
        // Create new template
        const response = await adminAPI.createAutomationTemplate(templateData);
        const newTemplate = response.data.template;
        
        // If this is a new language template for a rule, associate it with the rule
        if (templateData.isNewLanguageTemplate && templateData.associatedRuleId) {
          try {
            await adminAPI.associateTemplateWithRule(
              templateData.associatedRuleId, 
              newTemplate.id,
              { 
                isPrimary: false, // New language templates are not primary by default
                priority: 1 
              }
            );
            console.log(`✅ Associated template ${newTemplate.id} with rule ${templateData.associatedRuleId}`);
          } catch (associationError) {
            console.error('Error associating template with rule:', associationError);
            // Continue anyway - template was created successfully
          }
        }
        
        setTemplates(prev => [...prev, newTemplate]);
      }
      
      setIsTemplateEditorOpen(false);
      setSelectedTemplate(null);
      // Reload data to refresh the groups
      loadData();
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

    // Get template group positions (now on the right)
    Object.values(templateGroups).forEach(group => {
      const element = document.querySelector(`[data-template-id="group-${group.rule.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        newTemplatePositions[`group-${group.rule.id}`] = {
          x: rect.left - containerRect.left,
          y: rect.top + rect.height / 2 - containerRect.top
        };
      }
    });

    // Get rule positions (now on the left)
    rules.forEach(rule => {
      const element = document.querySelector(`[data-rule-id="${rule.id}"]`);
      if (element) {
        const rect = element.getBoundingClientRect();
        newRulePositions[rule.id] = {
          x: rect.right - containerRect.left,
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

  // Group templates by rule using proper relationships
  const getTemplateGroups = () => {
    const groups = {};
    
    // Group templates by rule using proper rule-template relationships
    rules.forEach(rule => {
      let ruleTemplates = [];
      
      // Method 1: Use rule.template_id if it exists (backward compatibility)
      if (rule.template_id) {
        const primaryTemplate = templates.find(template => template.id === rule.template_id);
        if (primaryTemplate) {
          ruleTemplates.push(primaryTemplate);
        }
      }
      
      // Method 2: Use rule.message_templates if it exists (embedded relation)
      if (rule.message_templates && !ruleTemplates.some(t => t.id === rule.message_templates.id)) {
        ruleTemplates.push(rule.message_templates);
      }
      
      // Method 3: Use rule.all_templates array if it exists (many-to-many relation)
      if (rule.all_templates && Array.isArray(rule.all_templates)) {
        rule.all_templates.forEach(template => {
          if (!ruleTemplates.some(t => t.id === template.id)) {
            ruleTemplates.push(template);
          }
        });
      }
      
      // Method 4: As fallback, use exact name matching for rule code (safer than includes)
      if (ruleTemplates.length === 0) {
        const exactMatch = templates.find(template => 
          template.name.toLowerCase().startsWith(`${rule.code?.toLowerCase()} -`) ||
          template.name.toLowerCase() === rule.code?.toLowerCase()
        );
        if (exactMatch) {
          ruleTemplates.push(exactMatch);
        }
      }
      
      if (ruleTemplates.length > 0) {
        groups[rule.id] = {
          rule,
          templates: ruleTemplates,
          languages: [...new Set(ruleTemplates.map(t => t.language || 'en'))]
        };
      }
    });
    
    return groups;
  };

  const getTemplateGroupConnections = () => {
    const connections = [];
    const templateGroups = getTemplateGroups();
    
    Object.values(templateGroups).forEach(group => {
      if (group.templates.length > 0) {
        connections.push({
          ruleId: group.rule.id,
          templateGroupId: group.rule.id,
          rulePos: rulePositions[group.rule.id],
          templatePos: templatePositions[`group-${group.rule.id}`]
        });
      }
    });
    
    return connections.filter(c => c.rulePos && c.templatePos);
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
  const templateGroups = getTemplateGroups();
  const connections = getTemplateGroupConnections();

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
        {/* Left Panel - Rules List */}
        <div className="w-[40%] bg-gray-50 overflow-y-auto" ref={rulesRef}>
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
                  const ruleTemplates = templateGroups[rule.id]?.templates || [];

                  return (
                    <div
                      key={rule.id}
                      onMouseEnter={() => setHoveredRule(rule.id)}
                      onMouseLeave={() => setHoveredRule(null)}
                      className={`transition-all duration-200 ${
                        hoveredRule === rule.id ? 'opacity-100' : 
                        (hoveredRule || hoveredTemplate) ? 'opacity-50' : 'opacity-100'
                      }`}
                      data-rule-id={rule.id}
                    >
                      <CompactRuleCard
                        rule={rule}
                        onEdit={() => handleEditRule(rule)}
                        onToggle={handleRuleUpdate}
                        connectedTemplateCount={ruleTemplates.length}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Template Groups */}
        <div className="w-[60%] px-6 bg-gray-50 overflow-y-auto" ref={templatesRef}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Template Groups</h2>
              <span className="text-sm text-gray-500">{Object.keys(templateGroups).length} groups</span>
            </div>

            {Object.keys(templateGroups).length === 0 ? (
              <div className="text-center py-16">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">No template groups found</h3>
                <p className="text-xs text-gray-500">
                  Template groups will appear here when templates are linked to rules
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.values(templateGroups).map((group) => (
                  <div 
                    key={group.rule.id}
                    className={`transition-all duration-200 ${
                      hoveredRule === group.rule.id ? 'opacity-100' : 
                      (hoveredRule || hoveredTemplate) ? 'opacity-50' : 'opacity-100'
                    }`}
                    onMouseEnter={() => setHoveredRule(group.rule.id)}
                    onMouseLeave={() => setHoveredRule(null)}
                    data-template-id={`group-${group.rule.id}`}
                  >
                    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-medium text-gray-900">
                          Rule {group.rule.code} - {group.rule.name}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {group.templates.length} template{group.templates.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      {/* Interactive Language Tabs */}
                      <div className="mb-3">
                        <div className="flex gap-1 mb-2">
                          {group.languages.map((language) => {
                            const isSelected = selectedLanguageTabs[group.rule.id] === language || 
                              (!selectedLanguageTabs[group.rule.id] && language === group.languages[0]);
                            
                            return (
                              <button
                                key={language}
                                onClick={() => setSelectedLanguageTabs(prev => ({
                                  ...prev,
                                  [group.rule.id]: language
                                }))}
                                className={`px-2 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                                  isSelected 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                {language.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Template Content Preview - Shows selected language */}
                      {(() => {
                        const selectedLanguage = selectedLanguageTabs[group.rule.id] || group.languages[0];
                        const selectedTemplate = group.templates.find(t => t.language === selectedLanguage) || group.templates[0];
                        
                        return selectedTemplate && (
                          <div className="mb-3">
                            <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-700">
                                  {selectedTemplate.name}
                                </span>
                                <span className="text-gray-500">
                                  {selectedTemplate.channel}
                                </span>
                              </div>
                              <div className="text-gray-600">
                                {selectedTemplate.content?.substring(0, 120)}
                                {selectedTemplate.content?.length > 120 ? '...' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const selectedLanguage = selectedLanguageTabs[group.rule.id] || group.languages[0];
                            const selectedTemplate = group.templates.find(t => t.language === selectedLanguage) || group.templates[0];
                            handleEditTemplate(selectedTemplate);
                          }}
                          className="text-xs px-2 py-1 text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                        >
                          Edit Template
                        </button>
                        <button 
                          onClick={() => handleAddLanguage(group.rule, group.templates[0])}
                          className="text-xs px-2 py-1 text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors"
                        >
                          + Add Language
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
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
            const isActive = hoveredRule === connection.ruleId;
            const showConnection = isActive || !hoveredRule;
            
            if (!showConnection || !connection.templatePos || !connection.rulePos) return null;

            const x1 = connection.rulePos.x;
            const y1 = connection.rulePos.y;
            const x2 = connection.templatePos.x;
            const y2 = connection.templatePos.y;
            
            // Create curved path for more elegant connection (left to right now)
            const midX = (x1 + x2) / 2;
            const curvature = Math.abs(x2 - x1) * 0.2;
            const pathData = `M ${x1} ${y1} Q ${midX + curvature} ${y1} ${midX} ${(y1 + y2) / 2} Q ${midX - curvature} ${y2} ${x2} ${y2}`;

            return (
              <g key={`rule-${connection.ruleId}-template-${connection.templateGroupId}`}>
                <path
                  d={pathData}
                  stroke={getConnectorColor('email', isActive)}
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
                      fill={getConnectorColor('email', true)}
                      className="animate-pulse"
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r="3"
                      fill={getConnectorColor('email', true)}
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
