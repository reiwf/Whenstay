require('dotenv').config();

const communicationService = require('../services/communicationService');
const { supabaseAdmin } = require('../config/supabase');

async function testMessageDeduplication() {
  console.log('🧪 Testing Message Deduplication Fix');
  console.log('=====================================\n');

  try {
    // Step 1: Create a test thread
    console.log('1. Creating test thread...');
    const testThread = await communicationService.createThread({
      subject: 'Test Deduplication Thread'
    });
    console.log(`✅ Created test thread: ${testThread.id}\n`);

    // Step 2: Send an outbound message (simulating user sending message via app)
    console.log('2. Sending outbound message...');
    const outboundMessage = await communicationService.sendMessage({
      thread_id: testThread.id,
      channel: 'inapp',
      content: 'Hello, thank you for booking with us!',
      origin_role: 'host'
    });
    console.log(`✅ Sent outbound message: ${outboundMessage.id}\n`);

    // Step 3: Check the delivery record (should have no provider_message_id yet)
    const { data: deliveryBefore } = await supabaseAdmin
      .from('message_deliveries')
      .select('*')
      .eq('message_id', outboundMessage.id)
      .eq('channel', 'inapp')
      .single();

    console.log('3. Delivery record before webhook:');
    console.log(`   provider_message_id: ${deliveryBefore.provider_message_id || 'null'}`);
    console.log(`   status: ${deliveryBefore.status}\n`);

    // Step 4: Simulate webhook echo (Beds24 echoing back the same message)
    console.log('4. Simulating webhook echo processing...');
    
    // First, simulate the processIndividualMessage function manually
    const webhookMessage = {
      id: 999999, // Simulated Beds24 message ID
      source: 'host', // This indicates it's echoing our outbound message
      message: 'Hello, thank you for booking with us!', // Same content
      time: new Date().toISOString(),
      read: false
    };

    // Test the echo detection
    const recentOutbound = await communicationService.findRecentOutboundMessage(
      testThread.id,
      webhookMessage.message,
      webhookMessage.time
    );

    if (recentOutbound) {
      console.log(`✅ Echo detected! Found matching outbound message: ${recentOutbound.id}`);
      
      // Backfill the provider_message_id
      await communicationService.updateDeliveryProviderMessageId(
        recentOutbound.id,
        'inapp',
        webhookMessage.id.toString()
      );
      console.log(`✅ Backfilled provider_message_id: ${webhookMessage.id}\n`);
    } else {
      console.log('❌ Echo detection failed - this would create a duplicate!\n');
      throw new Error('Echo detection failed');
    }

    // Step 5: Verify the provider_message_id was backfilled
    const { data: deliveryAfter } = await supabaseAdmin
      .from('message_deliveries')
      .select('*')
      .eq('message_id', outboundMessage.id)
      .eq('channel', 'inapp')
      .single();

    console.log('5. Delivery record after backfill:');
    console.log(`   provider_message_id: ${deliveryAfter.provider_message_id}`);
    console.log(`   status: ${deliveryAfter.status}\n`);

    // Step 6: Test duplicate detection (simulate webhook trying to create the same message again)
    console.log('6. Testing duplicate detection...');
    const duplicateResult = await communicationService.receiveMessage({
      thread_id: testThread.id,
      channel: 'inapp',
      content: 'Hello, thank you for booking with us!',
      origin_role: 'host',
      provider_message_id: webhookMessage.id.toString()
    });

    if (duplicateResult.duplicate) {
      console.log('✅ Duplicate detection working! Message was correctly identified as duplicate\n');
    } else {
      console.log('❌ Duplicate detection failed! A duplicate message would be created\n');
      throw new Error('Duplicate detection failed');
    }

    // Step 7: Verify message count
    const messages = await communicationService.getMessages(testThread.id);
    console.log('7. Final verification:');
    console.log(`   Total messages in thread: ${messages.length}`);
    console.log(`   Expected: 1 (no duplicates)\n`);

    if (messages.length === 1) {
      console.log('✅ SUCCESS: Message deduplication is working correctly!');
      console.log('   - Outbound messages can be sent');
      console.log('   - Webhook echoes are detected and provider IDs are backfilled');
      console.log('   - Future duplicates are prevented');
    } else {
      throw new Error(`Expected 1 message, found ${messages.length}`);
    }

    // Cleanup
    console.log('\n8. Cleaning up test data...');
    await supabaseAdmin.from('messages').delete().eq('thread_id', testThread.id);
    await supabaseAdmin.from('message_threads').delete().eq('id', testThread.id);
    console.log('✅ Test cleanup completed\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testMessageDeduplication()
    .then(() => {
      console.log('🎉 All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testMessageDeduplication };
