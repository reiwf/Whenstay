import React from 'react';
import DashboardLayout from '../components/layout/DashboardLayout';
import CombinedAutomationManager from '../components/automation/AutomationPanel';

export default function AutomationPage() {
  return (
    <DashboardLayout 
      activeSection="automation"
      pageTitle="Automation"
      pageSubtitle="Manage message templates, rules, and scheduled communications"
    >
      <CombinedAutomationManager />
    </DashboardLayout>
  );
}
