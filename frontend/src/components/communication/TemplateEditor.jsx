import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { adminAPI } from '../../services/api';
import toast from 'react-hot-toast';

export default function TemplateEditor({ template, isOpen, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    language: '',
    variables: {}
  });
  const [availableVariables, setAvailableVariables] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (template && isOpen) {
      setFormData({
        name: template.name || '',
        content: template.content || '',
        language: template.language || '',
        variables: template.variables || {}
      });
    }
  }, [template, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadAvailableVariables();
    }
  }, [isOpen]);

  useEffect(() => {
    if (previewMode) {
      generatePreview();
    }
  }, [formData.content, previewMode]);

  const loadAvailableVariables = async () => {
    try {
      const response = await adminAPI.getAvailableTemplateVariables();
      setAvailableVariables(response.data.variables);
    } catch (error) {
      console.error('Error loading available variables:', error);
      toast.error('Failed to load available variables');
    }
  };

  const generatePreview = () => {
    let preview = formData.content;
    
    // Replace variables with sample data for preview
    const sampleData = {
      guest_name: 'John Smith',
      guest_firstname: 'John',
      guest_lastname: 'Smith',
      guest_email: 'john.smith@example.com',
      guest_phone: '+1-555-0123',
      num_guests: '2',
      num_adults: '2',
      num_children: '0',
      check_in_date: '2024-03-15',
      check_out_date: '2024-03-18',
      booking_id: 'BK123456',
      nights_count: '3',
      total_amount: '¥45,000',
      currency: 'JPY',
      booking_source: 'Airbnb',
      special_requests: 'Late check-in requested',
      check_in_token: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234yz',
      guest_app_link: `${window.location.origin}/guest/abc123def456ghi789jkl012mno345pqr678stu901vwx234yz`,
      property_name: 'Tokyo Central Apartment',
      property_address: '1-1-1 Shibuya, Tokyo',
      wifi_name: 'TokyoWiFi_Guest',
      wifi_password: 'Welcome2024',
      check_in_instructions: 'Use the key code at the main entrance',
      house_rules: 'No smoking, No pets',
      emergency_contact: '+81-3-1234-5678',
      access_time: '15:00',
      departure_time: '11:00',
      room_type_name: 'Deluxe Studio',
      room_number: '302',
      access_code: '4521',
      access_instructions: 'Enter the code on the door keypad',
      room_amenities: 'Air conditioning, WiFi, Kitchenette',
      bed_configuration: '1 Queen Bed',
      max_guests: '2',
      current_date: new Date().toLocaleDateString(),
      current_time: new Date().toLocaleTimeString(),
      company_name: 'Your Company',
      support_email: 'support@yourcompany.com',
      support_phone: '+81-3-1234-5678'
    };

    // Replace all variables in the content
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      preview = preview.replace(regex, value);
    });

    setPreviewContent(preview);
  };

  const insertVariable = (variableKey) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = formData.content;
    const variableTag = `{{ ${variableKey} }}`;
    
    const newContent = content.substring(0, start) + variableTag + content.substring(end);
    
    setFormData(prev => ({ ...prev, content: newContent }));
    
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableTag.length, start + variableTag.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    
    if (!formData.content.trim()) {
      toast.error('Template content is required');
      return;
    }

    setIsLoading(true);
    try {
      const response = await adminAPI.updateAutomationTemplate(template.id, {
        name: formData.name.trim(),
        content: formData.content.trim(),
        language: formData.language || null,
        variables: formData.variables
      });

      toast.success('Template updated successfully');
      onSave(response.data.template);
      onClose();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextareaKeyDown = (e) => {
    // Handle Tab key for indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = formData.content;
      
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setFormData(prev => ({ ...prev, content: newContent }));
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Template</h2>
            <p className="text-sm text-gray-600 mt-1">
              Modify template content and insert dynamic variables
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={previewMode ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Variables */}
          <div className="w-80 border-r border-gray-200 bg-gray-50 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-medium text-gray-900 mb-3">Available Variables</h3>
              <p className="text-xs text-gray-600 mb-4">
                Click any variable to insert it at cursor position
              </p>
              
              {Object.entries(availableVariables).map(([categoryKey, category]) => (
                <div key={categoryKey} className="mb-6">
                  <h4 className="font-medium text-sm text-gray-800 mb-2">
                    {category.label}
                  </h4>
                  <div className="space-y-2">
                    {category.variables.map((variable) => (
                      <div
                        key={variable.key}
                        className="group cursor-pointer"
                        onClick={() => !previewMode && insertVariable(variable.key)}
                      >
                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-white hover:shadow-sm transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs font-mono bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {`{{ ${variable.key} }}`}
                              </Badge>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {variable.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Editor/Preview */}
          <div className="flex-1 flex flex-col">
            {/* Template Details */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter template name"
                    disabled={previewMode}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language (Optional)
                  </label>
                  <Input
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    placeholder="e.g., en, ja, ko"
                    disabled={previewMode}
                  />
                </div>
              </div>
            </div>

            {/* Content Editor/Preview */}
            <div className="flex-1 p-4">
              {previewMode ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Preview</h3>
                    <Badge variant="outline" className="text-xs">
                      Sample data used for preview
                    </Badge>
                  </div>
                  <Card className="p-4 bg-gray-50">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {previewContent}
                    </div>
                  </Card>
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Template Content</h3>
                    <div className="text-xs text-gray-500">
                      Use Tab for indentation, insert variables from the left panel
                    </div>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    onKeyDown={handleTextareaKeyDown}
                    className="flex-1 w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm leading-relaxed"
                    placeholder="Enter your template content here... Use {{ variable_name }} for dynamic values."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
