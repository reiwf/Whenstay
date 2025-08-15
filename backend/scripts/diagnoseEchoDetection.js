require('dotenv').config();

const communicationService = require('../services/communicationService');
const { supabaseAdmin } = require('../config/supabase');

async function diagnoseEchoDetection() {
  console.log('🔍 Diagnosing Echo Detection Issues');
  console.log('====================================\n');

  try {
    // Get recent messages from the last hour to analyze patterns
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentMessages, error } = await supabaseAdmin
      .from('messages')
      .select(`
        *,
        message_deliveries(*),
        message_threads(id, reservation_id)
      `)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log(`Found ${recentMessages.length} recent messages in the last hour\n`);

    // Group messages by thread and content to identify potential duplicates
    const contentGroups = {};
    const threadGroups = {};

    recentMessages.forEach(msg => {
      const key = `${msg.thread_id}:${msg.content}`;
      if (!contentGroups[key]) {
        contentGroups[key] = [];
      }
      contentGroups[key].push(msg);

      if (!threadGroups[msg.thread_id]) {
        threadGroups[msg.thread_id] = [];
      }
      threadGroups[msg.thread_id].push(msg);
    });

    // Identify potential duplicates
    console.log('🔍 Analyzing Potential Duplicates:');
    console.log('==================================');

    let duplicateCount = 0;
    for (const [key, messages] of Object.entries(contentGroups)) {
      if (messages.length > 1) {
        duplicateCount++;
        const [threadId, content] = key.split(':');
        console.log(`\n📋 Duplicate Group #${duplicateCount}:`);
        console.log(`Thread: ${threadId}`);
        console.log(`Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
        console.log(`Count: ${messages.length} messages`);
        
        messages.forEach((msg, index) => {
          const delivery = msg.message_deliveries?.[0];
          console.log(`  ${index + 1}. ID: ${msg.id.substring(0, 8)}... | Direction: ${msg.direction} | Role: ${msg.origin_role} | Provider ID: ${delivery?.provider_message_id || 'null'} | Created: ${new Date(msg.created_at).toLocaleTimeString()}`);
        });

        // Check if echo detection would have worked
        const outbound = messages.find(m => m.direction === 'outgoing' && m.origin_role === 'host');
        const inbound = messages.find(m => m.direction === 'incoming' && m.origin_role === 'host');

        if (outbound && inbound) {
          console.log(`  📊 Analysis:`);
          console.log(`    - Outbound message: ${outbound.id.substring(0, 8)}... at ${new Date(outbound.created_at).toLocaleTimeString()}`);
          console.log(`    - Inbound echo: ${inbound.id.substring(0, 8)}... at ${new Date(inbound.created_at).toLocaleTimeString()}`);
          
          const timeDiff = (new Date(inbound.created_at) - new Date(outbound.created_at)) / 1000;
          console.log(`    - Time difference: ${timeDiff.toFixed(1)} seconds`);
          
          const outboundDelivery = outbound.message_deliveries?.[0];
          console.log(`    - Outbound provider_message_id: ${outboundDelivery?.provider_message_id || 'null'}`);
          console.log(`    - Would echo detection work? ${!outboundDelivery?.provider_message_id && timeDiff < 600 ? '✅ YES' : '❌ NO'}`);
          
          if (outboundDelivery?.provider_message_id) {
            console.log(`    - ❌ Issue: Outbound already has provider_message_id`);
          }
          if (timeDiff >= 600) {
            console.log(`    - ❌ Issue: Time difference exceeds 10-minute window`);
          }
        }
      }
    }

    if (duplicateCount === 0) {
      console.log('✅ No duplicate content found in recent messages');
    }

    // Check webhook timing patterns
    console.log('\n\n🕒 Webhook Timing Analysis:');
    console.log('============================');

    // Get recent webhook logs
    const { data: webhookLogs, error: logError } = await supabaseAdmin
      .from('reservation_webhook_logs')
      .select('*')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!logError && webhookLogs.length > 0) {
      console.log(`Found ${webhookLogs.length} recent webhook events:`);
      webhookLogs.forEach(log => {
        const webhookData = typeof log.webhook_payload === 'string' 
          ? JSON.parse(log.webhook_payload) 
          : log.webhook_payload;
        const messageCount = webhookData.messages?.length || 0;
        console.log(`- ${new Date(log.created_at).toLocaleTimeString()}: Booking ${log.beds24_booking_id} - ${messageCount} messages`);
      });
    } else {
      console.log('No recent webhook logs found');
    }

    // Test current echo detection function
    console.log('\n\n🧪 Testing Echo Detection Function:');
    console.log('===================================');

    if (duplicateCount > 0) {
      // Test with a known duplicate scenario
      const duplicateGroup = Object.values(contentGroups).find(msgs => msgs.length > 1);
      if (duplicateGroup) {
        const outbound = duplicateGroup.find(m => m.direction === 'outgoing');
        const inbound = duplicateGroup.find(m => m.direction === 'incoming');
        
        if (outbound) {
          console.log(`Testing with outbound message: ${outbound.id.substring(0, 8)}...`);
          console.log(`Content: "${outbound.content.substring(0, 50)}..."`);
          
          const testResult = await communicationService.findRecentOutboundMessage(
            outbound.thread_id,
            outbound.content,
            new Date().toISOString(),
            60 // 60 minute window for testing
          );
          
          console.log(`Echo detection result: ${testResult ? '✅ Found' : '❌ Not Found'}`);
          if (testResult) {
            console.log(`Found message ID: ${testResult.id}`);
            const delivery = testResult.message_deliveries?.[0];
            console.log(`Provider message ID: ${delivery?.provider_message_id || 'null'}`);
          }
        }
      }
    }

    console.log('\n📋 Diagnostic Summary:');
    console.log('======================');
    console.log(`- Recent messages analyzed: ${recentMessages.length}`);
    console.log(`- Duplicate content groups found: ${duplicateCount}`);
    console.log(`- Current time window setting: 10 minutes`);
    console.log(`- Echo detection function: Available`);
    
    if (duplicateCount > 0) {
      console.log('\n⚠️  ISSUE DETECTED: Duplicates are still occurring');
      console.log('Possible causes:');
      console.log('1. Webhook processing happens before outbound message is committed');
      console.log('2. Time window is too short for webhook delay');
      console.log('3. Content matching issues (whitespace, formatting)');
      console.log('4. Channel mismatch in detection logic');
      console.log('5. Database transaction timing issues');
    } else {
      console.log('\n✅ No recent duplicates detected - system may be working correctly now');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run the diagnostic
if (require.main === module) {
  diagnoseEchoDetection()
    .then(() => {
      console.log('\n🎯 Diagnostic complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Diagnostic failed:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseEchoDetection };
