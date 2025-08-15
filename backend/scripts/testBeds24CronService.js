#!/usr/bin/env node
/**
 * Test script for Beds24 Cron Service
 * This script tests the automated token refresh functionality
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cronService = require('../services/cronService');

async function testCronService() {
  console.log('🧪 Testing Beds24 Cron Service...\n');

  try {
    // Test 1: Initialize cron service
    console.log('📋 Test 1: Initialize cron service');
    cronService.init();
    console.log('✅ Cron service initialized successfully\n');

    // Test 2: Check job status
    console.log('📋 Test 2: Check cron jobs status');
    const status = cronService.getJobsStatus();
    console.log('📊 Job status:', JSON.stringify(status, null, 2));
    console.log('✅ Status check completed\n');

    // Test 3: Manual token refresh trigger
    console.log('📋 Test 3: Manual token refresh');
    console.log('🔄 Triggering manual Beds24 token refresh...');
    await cronService.triggerBeds24Refresh();
    console.log('✅ Manual refresh completed\n');

    // Test 4: Test job management
    console.log('📋 Test 4: Test job management');
    console.log('⏸️  Stopping token refresh job...');
    const stopResult = cronService.stopJob('beds24TokenRefresh');
    console.log(`Stop result: ${stopResult}`);
    
    console.log('▶️  Starting token refresh job...');
    const startResult = cronService.startJob('beds24TokenRefresh');
    console.log(`Start result: ${startResult}`);
    console.log('✅ Job management test completed\n');

    // Test 5: Graceful shutdown
    console.log('📋 Test 5: Graceful shutdown');
    await cronService.shutdown();
    console.log('✅ Graceful shutdown completed\n');

    console.log('🎉 All tests passed! Cron service is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('📋 Error details:', error);
    
    // Cleanup on error
    try {
      await cronService.shutdown();
    } catch (shutdownError) {
      console.error('❌ Shutdown error:', shutdownError.message);
    }
    
    process.exit(1);
  }
}

// Handle script interruption
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted. Cleaning up...');
  try {
    await cronService.shutdown();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
  process.exit(0);
});

// Run the test if this script is executed directly
if (require.main === module) {
  testCronService()
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testCronService };
