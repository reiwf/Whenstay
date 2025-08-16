const cronService = require('../services/cronService');

async function testEnvironmentFlag() {
  console.log('🧪 Testing environment flag for scheduled message processing...\n');

  // Display current environment variables
  console.log('📊 Current Environment Configuration:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   ENABLE_SCHEDULED_MESSAGES: ${process.env.ENABLE_SCHEDULED_MESSAGES}`);
  console.log('');

  // Test regular processing (should be disabled in development)
  console.log('🔍 Testing regular scheduled message processing...');
  await cronService.processScheduledMessages();
  console.log('');

  // Test forced processing (should work even in development)
  console.log('🔍 Testing forced scheduled message processing...');
  await cronService.triggerScheduledMessageProcessingForced();
  console.log('');

  console.log('✅ Environment flag test complete');
  console.log('💡 In development mode with ENABLE_SCHEDULED_MESSAGES=false:');
  console.log('   - Regular processing should be disabled');
  console.log('   - Forced processing should work for testing');
}

testEnvironmentFlag().catch(console.error);
