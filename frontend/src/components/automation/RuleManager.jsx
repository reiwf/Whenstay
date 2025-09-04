import React, { useState, useEffect } from 'react';
import { messageRulesAPI } from '../../services/api';
import { useProperty } from '../../contexts/PropertyContext';
import RuleCard from './rules/RuleCard';
import RuleFormDrawer from './rules/RuleFormDrawer';
import StatusChip from './shared/StatusChip';

export default function RuleManager() {
  const { selectedPropertyId } = useProperty();
  const [rules, setRules] = useState([]);
  const [filteredRules, setFilteredRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRule, setSelectedRule] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    loadRules();
  }, [selectedPropertyId]);

  useEffect(() => {
    applyFilters();
  }, [rules, selectedPropertyId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const params = selectedPropertyId ? { property_id: selectedPropertyId } : {};
      const response = await messageRulesAPI.getRules(params);
      setRules(response.data.rules || []);
      setError(null);
    } catch (err) {
      console.error('Error loading rules:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...rules];
    
    // Property filtering is handled at API level
    setFilteredRules(filtered);
  };

  const handleRuleUpdate = async (ruleId, updates) => {
    try {
      await messageRulesAPI.updateRule(ruleId, updates);
      
      // Update rule in local state
      setRules(prev => prev.map(rule => 
        rule.id === ruleId ? { ...rule, ...updates } : rule
      ));
      
    } catch (err) {
      console.error('Error updating rule:', err);
      setError(err.message);
    }
  };

  const handleEditRule = (rule) => {
    setSelectedRule(rule);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedRule(null);
  };

  const handleSaveRule = async (ruleData) => {
    try {
      await handleRuleUpdate(ruleData.id, ruleData);
      setIsFormOpen(false);
      setSelectedRule(null);
    } catch (err) {
      console.error('Error saving rule:', err);
    }
  };

  const getRuleStats = () => {
    return {
      total: rules.length,
      enabled: rules.filter(r => r.enabled).length,
      disabled: rules.filter(r => !r.enabled).length
    };
  };

  const stats = getRuleStats();

  if (loading && rules.length === 0) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-8 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Rule Manager</h2>
            <p className="text-gray-600 mt-1">
              Configure message rules and timing logic
            </p>
          </div>
          <button
            onClick={loadRules}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh rules"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Total:</span>
            <span className="px-2 py-1 bg-gray-100 rounded-full text-xs font-semibold">
              {stats.total}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Enabled:</span>
            <StatusChip status="enabled" />
            <span className="text-xs">{stats.enabled}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Disabled:</span>
            <StatusChip status="disabled" />
            <span className="text-xs">{stats.disabled}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-8">
        {filteredRules.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No rules found
            </h3>
            <p className="text-gray-500 mb-4">
              Message rules will appear here once the system is configured
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredRules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => handleEditRule(rule)}
                onToggle={handleRuleUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rule Form Drawer */}
      {isFormOpen && selectedRule && (
        <RuleFormDrawer
          rule={selectedRule}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveRule}
        />
      )}
    </div>
  );
}
