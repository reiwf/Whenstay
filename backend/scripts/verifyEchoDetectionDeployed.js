require('dotenv').config();

function verifyEchoDetectionDeployed() {
  console.log('🔍 Verifying Echo Detection Code Deployment');
  console.log('==========================================\n');

  try {
    // Check if the new echo detection code is available
    const communicationService = require('../services/communicationService');
    const webhooks = require('../routes/webhooks');

    // Test if the new methods exist
    const hasEchoDetection = typeof communicationService.findRecentOutboundMessage === 'function';
    const hasProviderIdUpdate = typeof communicationService.updateDeliveryProviderMessageId === 'function';

    console.log('📋 Code Deployment Status:');
    console.log(`✅ findRecentOutboundMessage method: ${hasEchoDetection ? 'DEPLOYED' : 'MISSING'}`);
    console.log(`✅ updateDeliveryProviderMessageId method: ${hasProviderIdUpdate ? 'DEPLOYED' : 'MISSING'}`);

    // Read the current webhook file to check for echo detection logic
    const fs = require('fs');
    const webhookFilePath = require.resolve('../routes/webhooks');
    const webhookContent = fs.readFileSync(webhookFilePath, 'utf8');
    
    const hasEchoLogic = webhookContent.includes('Checking for outbound message echo') || 
                        webhookContent.includes('message.source === \'host\'');

    console.log(`✅ Webhook echo detection logic: ${hasEchoLogic ? 'DEPLOYED' : 'MISSING'}`);

    if (hasEchoDetection && hasProviderIdUpdate && hasEchoLogic) {
      console.log('\n🎉 SUCCESS: All echo detection code is deployed!');
      console.log('\n⚠️  HOWEVER: If duplicates are still occurring, you need to:');
      console.log('1. Restart your application server');
      console.log('2. OR redeploy to production');
      console.log('3. The running server is using cached/old code');
      
      console.log('\n🔄 To verify the fix is working after restart:');
      console.log('- Send a test message via app');
      console.log('- Watch for "Checking for outbound message echo" in logs');
      console.log('- Check if duplicate is prevented');
    } else {
      console.log('\n❌ ISSUE: Some echo detection code is missing');
      console.log('Please ensure all changes were saved and try again.');
    }

    console.log('\n📝 Expected Log Messages After Restart:');
    console.log('  "Checking for outbound message echo: [messageId]"');
    console.log('  "Found matching outbound message [id] for webhook echo [webhookId]"');
    console.log('  "Successfully backfilled provider_message_id [id] for outbound message [id], skipping duplicate creation"');

  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the verification
if (require.main === module) {
  verifyEchoDetectionDeployed();
  process.exit(0);
}

module.exports = { verifyEchoDetectionDeployed };
