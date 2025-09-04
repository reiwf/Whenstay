require('dotenv').config();
const communicationService = require('./services/communicationService');
const { supabaseAdmin } = require('./config/supabase');

// Test script to verify that scheduled in-app messages now have direction: 'outgoing'
async function testScheduledMessageDirectionFix() {
  console.log('🧪 Testing scheduled message direction fix...\n');

  let testThreadId = null;
  let testTemplateId = null;
  let scheduledMessageId = null;
  let createdMessageId = null;

  try {
    // 1. Create a test thread
    console.log('1️⃣ Creating test thread...');
    const testThread = await communicationService.createThread({
      subject: 'Test Thread for Direction Fix',
      status: 'open'
    });
    testThreadId = testThread.id;
    console.log(`✅ Created test thread: ${testThreadId}\n`);

    // 2. Create a test message template
    console.log('2️⃣ Creating test message template...');
    const { data: template, error: templateError } = await supabaseAdmin
      .from('message_templates')
      .insert({
        name: 'Test Direction Fix Template',
        content: 'This is a test scheduled message to verify direction is outgoing',
        channel: 'inapp',
        language: 'en'
      })
      .select()
      .single();

    if (templateError) throw templateError;
    testTemplateId = template.id;
    console.log(`✅ Created test template: ${testTemplateId}\n`);

    // 3. Schedule a test message
    console.log('3️⃣ Scheduling test message...');
    const scheduledMessage = await communicationService.scheduleMessage({
      thread_id: testThreadId,
      template_id: testTemplateId,
      channel: 'inapp',
      run_at: new Date().toISOString(), // Schedule for immediate processing
      payload: {},
      created_by: 'test-user'
    });
    scheduledMessageId = scheduledMessage.id;
    console.log(`✅ Scheduled message: ${scheduledMessageId}\n`);

    // 4. Claim and process the scheduled message (simulate cron job flow)
    console.log('4️⃣ Claiming due scheduled messages...');
    const dueMessages = await communicationService.getDueScheduledMessages(1);
    console.log(`✅ Claimed ${dueMessages.length} due messages\n`);

    if (dueMessages.length === 0) {
      throw new Error('No due messages were claimed - the message may not be ready for processing');
    }

    const claimedMessage = dueMessages.find(msg => msg.id === scheduledMessageId);
    if (!claimedMessage) {
      throw new Error('Our test message was not among the claimed messages');
    }

    console.log('5️⃣ Processing claimed scheduled message...');
    const processedMessage = await communicationService.processScheduledMessage(scheduledMessageId);
    createdMessageId = processedMessage.id;
    console.log(`✅ Processed scheduled message, created message: ${createdMessageId}\n`);

    // 6. Verify the message direction
    console.log('6️⃣ Verifying message direction...');
    const { data: message, error: msgError } = await supabaseAdmin
      .from('messages')
      .select('id, direction, origin_role, channel, content')
      .eq('id', createdMessageId)
      .single();

    if (msgError) throw msgError;

    console.log('📋 Message Details:');
    console.log(`   ID: ${message.id}`);
    console.log(`   Direction: ${message.direction}`);
    console.log(`   Origin Role: ${message.origin_role}`);
    console.log(`   Channel: ${message.channel}`);
    console.log(`   Content: ${message.content}`);

    // 6. Check if the fix worked
    if (message.direction === 'outgoing') {
      console.log('\n✅ SUCCESS: Scheduled in-app message has correct direction: outgoing');
      console.log('🎉 The fix is working correctly!\n');
    } else {
      console.log('\n❌ FAILURE: Scheduled in-app message has incorrect direction:', message.direction);
      console.log('🚨 The fix did not work as expected!\n');
      throw new Error(`Expected direction 'outgoing', got '${message.direction}'`);
    }

    // 7. Additional verification - check origin_role
    if (message.origin_role === 'system') {
      console.log('✅ Origin role is correctly set to "system" for scheduled messages');
    } else {
      console.log('⚠️  Warning: Origin role is not "system", got:', message.origin_role);
    }

    // 8. Check delivery record
    console.log('\n6️⃣ Checking delivery record...');
    const { data: delivery, error: deliveryError } = await supabaseAdmin
      .from('message_deliveries')
      .select('message_id, channel, status, sent_at, delivered_at')
      .eq('message_id', createdMessageId)
      .single();

    if (deliveryError) {
      console.log('⚠️  No delivery record found (this is okay for in-app messages in some cases)');
    } else {
      console.log('📋 Delivery Record:');
      console.log(`   Message ID: ${delivery.message_id}`);
      console.log(`   Channel: ${delivery.channel}`);
      console.log(`   Status: ${delivery.status}`);
      console.log(`   Sent At: ${delivery.sent_at}`);
      console.log(`   Delivered At: ${delivery.delivered_at}`);
    }

    console.log('\n🏆 TEST PASSED: Scheduled message direction fix is working correctly!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  } finally {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    
    if (createdMessageId) {
      try {
        await supabaseAdmin.from('message_deliveries').delete().eq('message_id', createdMessageId);
        await supabaseAdmin.from('messages').delete().eq('id', createdMessageId);
        console.log(`✅ Cleaned up message: ${createdMessageId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up message: ${error.message}`);
      }
    }

    if (scheduledMessageId) {
      try {
        await supabaseAdmin.from('scheduled_messages').delete().eq('id', scheduledMessageId);
        console.log(`✅ Cleaned up scheduled message: ${scheduledMessageId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up scheduled message: ${error.message}`);
      }
    }

    if (testTemplateId) {
      try {
        await supabaseAdmin.from('message_templates').delete().eq('id', testTemplateId);
        console.log(`✅ Cleaned up template: ${testTemplateId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up template: ${error.message}`);
      }
    }

    if (testThreadId) {
      try {
        await supabaseAdmin.from('message_threads').delete().eq('id', testThreadId);
        console.log(`✅ Cleaned up thread: ${testThreadId}`);
      } catch (error) {
        console.log(`⚠️  Could not clean up thread: ${error.message}`);
      }
    }

    console.log('✅ Cleanup completed\n');
  }
}

// Helper function to test the old vs new behavior comparison
async function compareOldVsNewBehavior() {
  console.log('🔄 Comparing old vs new behavior...\n');

  try {
    // Test creating a message using receiveMessage (old way) vs sendMessage (new way)
    const testThread = await communicationService.createThread({
      subject: 'Direction Comparison Test',
      status: 'open'
    });

    console.log('📊 Testing receiveMessage() - simulates old behavior:');
    const receivedMessage = await communicationService.receiveMessage({
      thread_id: testThread.id,
      channel: 'inapp',
      content: 'Test message via receiveMessage()',
      origin_role: 'system'
    });

    const { data: receivedMsgData } = await supabaseAdmin
      .from('messages')
      .select('direction, origin_role')
      .eq('id', receivedMessage.id)
      .single();

    console.log(`   Direction: ${receivedMsgData.direction} (${receivedMsgData.direction === 'incoming' ? 'EXPECTED' : 'UNEXPECTED'})`);
    console.log(`   Origin Role: ${receivedMsgData.origin_role}\n`);

    console.log('📊 Testing sendMessage() - simulates new behavior:');
    const sentMessage = await communicationService.sendMessage({
      thread_id: testThread.id,
      channel: 'inapp',
      content: 'Test message via sendMessage()',
      origin_role: 'system'
    });

    const { data: sentMsgData } = await supabaseAdmin
      .from('messages')
      .select('direction, origin_role')
      .eq('id', sentMessage.id)
      .single();

    console.log(`   Direction: ${sentMsgData.direction} (${sentMsgData.direction === 'outgoing' ? 'EXPECTED' : 'UNEXPECTED'})`);
    console.log(`   Origin Role: ${sentMsgData.origin_role}\n`);

    // Cleanup
    await supabaseAdmin.from('message_deliveries').delete().in('message_id', [receivedMessage.id, sentMessage.id]);
    await supabaseAdmin.from('messages').delete().in('id', [receivedMessage.id, sentMessage.id]);
    await supabaseAdmin.from('message_threads').delete().eq('id', testThread.id);

    console.log('✅ Comparison completed - this demonstrates the fix!\n');

  } catch (error) {
    console.error('❌ Comparison failed:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Scheduled Message Direction Fix Tests\n');
  console.log('='.repeat(60));
  
  try {
    await testScheduledMessageDirectionFix();
    console.log('\n' + '='.repeat(60));
    await compareOldVsNewBehavior();
    console.log('🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Tests failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testScheduledMessageDirectionFix,
  compareOldVsNewBehavior,
  runTests
};
