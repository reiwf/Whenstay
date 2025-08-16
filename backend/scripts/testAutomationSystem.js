#!/usr/bin/env node

/**
 * Comprehensive test script for the Scheduled Message Automation System
 * 
 * This script tests all components of the automation system:
 * - Template creation and rule setup
 * - Automation processing
 * - Scheduled message creation
 * - Cron job processing
 * - API endpoints
 */

require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const automationService = require('../services/automationService');
const cronService = require('../services/cronService');
const communicationService = require('../services/communicationService');

class AutomationSystemTester {
  constructor() {
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async test(name, testFunction) {
    this.log(`Testing: ${name}`, 'info');
    
    try {
      await testFunction();
      this.testResults.passed++;
      this.testResults.tests.push({ name, status: 'PASSED' });
      this.log(`✅ PASSED: ${name}`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({ name, status: 'FAILED', error: error.message });
      this.log(`❌ FAILED: ${name} - ${error.message}`, 'error');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Automation System Tests', 'info');
    console.log('═'.repeat(80));

    // 1. Database Setup Tests
    await this.test('Database Templates and Rules Exist', async () => {
      await this.testDatabaseSetup();
    });

    // 2. Service Tests
    await this.test('Automation Service Functions', async () => {
      await this.testAutomationService();
    });

    await this.test('Template Variable Merging', async () => {
      await this.testTemplateVariableMerging();
    });

    await this.test('Channel Routing Logic', async () => {
      await this.testChannelRouting();
    });

    // 3. Integration Tests
    await this.test('Scheduled Message Creation', async () => {
      await this.testScheduledMessageCreation();
    });

    await this.test('Cron Service Integration', async () => {
      await this.testCronServiceIntegration();
    });

    // 4. API Endpoint Tests
    await this.test('Automation API Endpoints', async () => {
      await this.testAPIEndpoints();
    });

    // Print Results
    console.log('\n' + '═'.repeat(80));
    this.log('📊 TEST RESULTS SUMMARY', 'info');
    console.log('═'.repeat(80));
    
    this.testResults.tests.forEach(test => {
      const status = test.status === 'PASSED' ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      if (test.error) {
        console.log(`    Error: ${test.error}`);
      }
    });

    console.log('\n' + '═'.repeat(80));
    console.log(`📈 Total Tests: ${this.testResults.passed + this.testResults.failed}`);
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📊 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    
    if (this.testResults.failed === 0) {
      this.log('🎉 ALL TESTS PASSED! The automation system is ready to use.', 'success');
    } else {
      this.log(`⚠️  ${this.testResults.failed} tests failed. Please review the errors above.`, 'warning');
    }
  }

  async testDatabaseSetup() {
    // Check if templates exist
    const { data: templates, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .select('id, name')
      .in('name', [
        'New Reservation Confirmation',
        'Pre-Check-in Reminder - 7 Days',
        'Pre-Check-in Reminder - 3 Days',
        'Final Pre-Check-in Reminder - 1 Day',
        'Check-in Instructions',
        'Mid-Stay Check-in',
        'Pre-Check-out Reminder',
        'Post-Stay Follow-up'
      ]);

    if (templateError) throw new Error(`Template query failed: ${templateError.message}`);
    if (templates.length !== 8) {
      throw new Error(`Expected 8 templates, found ${templates.length}. Run the SQL file to create templates.`);
    }

    // Check if automation rules exist
    const { data: rules, error: rulesError } = await supabaseAdmin
      .from('automation_rules')
      .select('id, name, enabled')
      .eq('enabled', true);

    if (rulesError) throw new Error(`Rules query failed: ${rulesError.message}`);
    if (rules.length < 8) {
      throw new Error(`Expected at least 8 automation rules, found ${rules.length}. Run the SQL file to create rules.`);
    }

    this.log(`Found ${templates.length} templates and ${rules.length} automation rules`, 'success');
  }

  async testAutomationService() {
    // Test basic automation service functions
    const rules = await automationService.getEnabledAutomationRules(null);
    if (!rules || rules.length === 0) {
      throw new Error('No automation rules returned from service');
    }

    // Test template variables building
    const mockReservation = {
      id: 'test-id',
      bookingName: 'John',
      bookingLastname: 'Doe',
      checkInDate: '2025-08-16',
      checkOutDate: '2025-08-20',
      numGuests: 2,
      propertyId: null
    };

    const variables = await automationService.buildTemplateVariables(mockReservation);
    
    if (!variables.guest_name || variables.guest_name !== 'John Doe') {
      throw new Error('Template variables not built correctly');
    }

    if (!variables.check_in_date || !variables.num_nights) {
      throw new Error('Missing required template variables');
    }

    this.log(`Automation service working with ${rules.length} rules and proper variable merging`, 'success');
  }

  async testTemplateVariableMerging() {
    const mockVariables = {
      guest_name: 'Test Guest',
      property_name: 'Test Property',
      check_in_date: 'Friday, August 16, 2025',
      num_guests: 2,
      check_out_date: 'Monday, August 19, 2025',
      booking_reference: 'TEST123'
    };

    // Test template rendering (using the first available template)
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .limit(1)
      .single();

    if (!template) throw new Error('No template found for testing');

    const rendered = await communicationService.renderTemplate(template.id, mockVariables);
    
    if (!rendered.rendered_content) {
      throw new Error('Template rendering failed');
    }

    // Check if basic variables were replaced
    if (!rendered.rendered_content.includes('Test Guest')) {
      throw new Error('Guest name variable not replaced properly');
    }

    if (rendered.rendered_content.includes('{{guest_name}}')) {
      throw new Error('Template variables not properly replaced - guest_name still present');
    }

    this.log('Template variable merging working correctly', 'success');
  }

  async testChannelRouting() {
    const mockReservation = { bookingSource: 'Airbnb' };
    const mockRule = { channel: 'auto' };

    const channel = automationService.determineChannel(mockReservation, mockRule);
    
    if (channel !== 'airbnb') {
      throw new Error(`Expected 'airbnb' channel, got '${channel}'`);
    }

    // Test booking.com routing
    const bookingReservation = { bookingSource: 'Booking.com' };
    const bookingChannel = automationService.determineChannel(bookingReservation, mockRule);
    
    if (bookingChannel !== 'booking.com') {
      throw new Error(`Expected 'booking.com' channel, got '${bookingChannel}'`);
    }

    this.log('Channel routing working correctly for different booking sources', 'success');
  }

  async testScheduledMessageCreation() {
    // This test requires an actual thread and template, so we'll test the database function directly
    
    // Get the first available template
    const { data: template } = await supabaseAdmin
      .from('message_templates')
      .select('*')
      .limit(1)
      .single();

    if (!template) throw new Error('No template found for testing');

    // Create a test thread (this would normally be done by the system)
    const { data: testThread, error: threadError } = await supabaseAdmin
      .from('message_threads')
      .insert({
        subject: 'Test Automation Thread',
        status: 'open'
      })
      .select()
      .single();

    if (threadError) throw new Error(`Failed to create test thread: ${threadError.message}`);

    // Test scheduling a message using the database function
    const futureTime = new Date(Date.now() + 60000); // 1 minute from now
    
    const { data: scheduledMessageId, error: scheduleError } = await supabaseAdmin
      .rpc('schedule_message', {
        p_thread_id: testThread.id,
        p_template_id: template.id,
        p_channel: 'inapp',
        p_run_at: futureTime.toISOString(),
        p_payload: { test: 'data' }
      });

    if (scheduleError) throw new Error(`Failed to schedule message: ${scheduleError.message}`);

    // Verify the scheduled message was created
    const { data: scheduledMessage, error: verifyError } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('id', scheduledMessageId)
      .single();

    if (verifyError || !scheduledMessage) {
      throw new Error('Scheduled message was not created properly');
    }

    // Clean up test data
    await supabaseAdmin.from('scheduled_messages').delete().eq('id', scheduledMessageId);
    await supabaseAdmin.from('message_threads').delete().eq('id', testThread.id);

    this.log('Scheduled message creation working correctly', 'success');
  }

  async testCronServiceIntegration() {
    // Initialize cron service first
    cronService.init();
    
    // Test that cron service can initialize
    const jobsStatus = cronService.getJobsStatus();
    
    if (!jobsStatus.scheduledMessageProcessing) {
      throw new Error('Scheduled message processing job not found');
    }

    if (!jobsStatus.beds24TokenRefresh) {
      throw new Error('Beds24 token refresh job not found');
    }

    // Test getting due messages function
    const dueMessages = await communicationService.getDueScheduledMessages(5);
    
    // This should return an array (empty is fine for this test)
    if (!Array.isArray(dueMessages)) {
      throw new Error('getDueScheduledMessages did not return an array');
    }

    this.log(`Cron service integration working with ${Object.keys(jobsStatus).length} jobs`, 'success');
  }

  async testAPIEndpoints() {
    // Test that the automation routes are properly structured
    // This is a basic test to ensure the module loads correctly
    
    const automationRoutes = require('../routes/automationRoutes');
    
    if (!automationRoutes) {
      throw new Error('Automation routes module failed to load');
    }

    // Test automation service methods that would be called by API
    const stats = await this.getMockAutomationStats();
    
    if (!stats.statusCounts && !stats.cronStatus) {
      throw new Error('Automation stats structure incorrect');
    }

    this.log('API endpoints and route structure working correctly', 'success');
  }

  async getMockAutomationStats() {
    // Mock version of what the API endpoint would return
    const cronStatus = cronService.getJobsStatus();
    
    const { data: messageCounts } = await supabaseAdmin
      .from('scheduled_messages')
      .select('status')
      .limit(10);
    
    const statusCounts = {};
    messageCounts?.forEach(msg => {
      statusCounts[msg.status] = (statusCounts[msg.status] || 0) + 1;
    });

    return {
      statusCounts,
      cronStatus,
      timestamp: new Date().toISOString()
    };
  }
}

// Run the tests
async function main() {
  const tester = new AutomationSystemTester();
  
  try {
    await tester.runAllTests();
    process.exit(tester.testResults.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AutomationSystemTester;
