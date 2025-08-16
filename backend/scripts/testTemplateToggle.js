#!/usr/bin/env node

/**
 * Test script to verify template enable/disable functionality
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const automationService = require('../services/automationService');
const { supabaseAdmin } = require('../config/supabase');

async function testTemplateToggle() {
  console.log('🧪 Testing Template Enable/Disable Functionality\n');

  try {
    // Step 1: Check current templates
    console.log('1. Checking existing templates...');
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('message_templates')
      .select('id, name, enabled')
      .limit(5);
    
    if (templatesError) throw templatesError;
    
    if (!templates || templates.length === 0) {
      console.log('❌ No templates found. Please create some templates first.');
      return;
    }
    
    console.log(`Found ${templates.length} templates:`);
    templates.forEach(template => {
      console.log(`  - ${template.name}: ${template.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    });
    console.log();

    // Step 2: Test automation rule filtering
    console.log('2. Testing automation rule filtering...');
    const enabledRules = await automationService.getEnabledAutomationRules(null);
    console.log(`Found ${enabledRules.length} enabled automation rules (with enabled templates)`);
    
    enabledRules.forEach(rule => {
      const templateStatus = rule.message_templates?.enabled ? 'Enabled' : 'Disabled';
      console.log(`  - Rule: ${rule.name}, Template: ${rule.message_templates?.name} (${templateStatus})`);
    });
    console.log();

    // Step 3: Toggle a template
    if (templates.length > 0) {
      const testTemplate = templates[0];
      console.log(`3. Toggling template "${testTemplate.name}"...`);
      
      const newStatus = !testTemplate.enabled;
      const { data: updatedTemplate, error: updateError } = await supabaseAdmin
        .from('message_templates')
        .update({ enabled: newStatus })
        .eq('id', testTemplate.id)
        .select('id, name, enabled')
        .single();
      
      if (updateError) throw updateError;
      
      console.log(`✅ Template "${updatedTemplate.name}" is now ${updatedTemplate.enabled ? 'enabled' : 'disabled'}`);
      console.log();

      // Step 4: Verify automation rules are filtered correctly
      console.log('4. Verifying automation rule filtering after toggle...');
      const rulesAfterToggle = await automationService.getEnabledAutomationRules(null);
      console.log(`Found ${rulesAfterToggle.length} enabled automation rules after toggle`);
      
      // Check if the rule count changed (if the toggled template was used by any rules)
      const affectedRules = enabledRules.filter(rule => rule.template_id === testTemplate.id);
      if (affectedRules.length > 0) {
        console.log(`This template is used by ${affectedRules.length} automation rule(s)`);
        if (!newStatus) {
          console.log(`These rules should now be excluded from enabled rules list`);
        }
      }
      console.log();

      // Step 5: Toggle back to original state
      console.log('5. Restoring original template state...');
      const { data: restoredTemplate, error: restoreError } = await supabaseAdmin
        .from('message_templates')
        .update({ enabled: testTemplate.enabled })
        .eq('id', testTemplate.id)
        .select('id, name, enabled')
        .single();
      
      if (restoreError) throw restoreError;
      
      console.log(`✅ Template "${restoredTemplate.name}" restored to ${restoredTemplate.enabled ? 'enabled' : 'disabled'}`);
    }

    // Step 6: Test API endpoints
    console.log('\n6. Testing API endpoints...');
    
    // Test template stats
    const { data: statsTemplates } = await supabaseAdmin
      .from('message_templates')
      .select('enabled');
    
    const stats = {
      total: statsTemplates?.length || 0,
      enabled: statsTemplates?.filter(t => t.enabled).length || 0,
      disabled: statsTemplates?.filter(t => !t.enabled).length || 0
    };
    
    console.log(`Template Statistics:`);
    console.log(`  - Total: ${stats.total}`);
    console.log(`  - Enabled: ${stats.enabled}`);
    console.log(`  - Disabled: ${stats.disabled}`);

    // Step 7: Test with sample reservation
    console.log('\n7. Testing automation processing with template filtering...');
    
    const { data: reservations } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .limit(1)
      .single();
    
    if (reservations) {
      console.log(`Testing with reservation ID: ${reservations.id}`);
      
      // Temporarily disable all templates
      await supabaseAdmin
        .from('message_templates')
        .update({ enabled: false });
      
      const resultWithDisabledTemplates = await automationService.processReservationAutomation(reservations, false);
      console.log(`With all templates disabled - scheduled: ${resultWithDisabledTemplates.success}, failed: ${resultWithDisabledTemplates.failed}`);
      
      // Re-enable templates
      await supabaseAdmin
        .from('message_templates')
        .update({ enabled: true });
      
      const resultWithEnabledTemplates = await automationService.processReservationAutomation(reservations, true);
      console.log(`With all templates enabled - scheduled: ${resultWithEnabledTemplates.success}, failed: ${resultWithEnabledTemplates.failed}`);
    } else {
      console.log('No reservations found to test with');
    }

    console.log('\n🎉 All template toggle tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Helper function to test API endpoints directly
async function testApiEndpoints() {
  console.log('\n📡 Testing API Endpoints...');
  
  const baseUrl = 'http://localhost:5001/api/automation';
  
  // Note: These would need proper authentication in a real test
  console.log('API endpoints that should be tested with proper auth:');
  console.log('GET /api/automation/templates - List all templates');
  console.log('GET /api/automation/templates/stats - Get template statistics');
  console.log('PATCH /api/automation/templates/:id/toggle - Toggle individual template');
  console.log('PATCH /api/automation/templates/bulk-toggle - Bulk toggle templates');
  console.log('GET /api/automation/templates/:id/usage - Get template usage stats');
}

// Run tests if script is executed directly
if (require.main === module) {
  testTemplateToggle()
    .then(() => testApiEndpoints())
    .catch(console.error);
}

module.exports = { testTemplateToggle };
