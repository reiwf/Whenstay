require('dotenv').config();

const { supabaseAdmin } = require('../config/supabase');

async function checkWebhookStructure() {
  console.log('🔍 Analyzing Recent Webhook Message Structure');
  console.log('============================================\n');

  try {
    // Get the most recent webhook logs to understand the message structure
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: webhookLogs, error } = await supabaseAdmin
      .from('reservation_webhook_logs')
      .select('*')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.log('Error fetching webhook logs:', error);
      return;
    }

    if (webhookLogs.length === 0) {
      console.log('❌ No recent webhook logs found');
      console.log('This might explain why echo detection isn\'t working - no webhooks are being processed');
      return;
    }

    console.log(`📋 Found ${webhookLogs.length} recent webhook logs:`);

    webhookLogs.forEach((log, index) => {
      console.log(`\n--- Webhook #${index + 1} ---`);
      console.log(`Time: ${new Date(log.created_at).toLocaleString()}`);
      console.log(`Booking ID: ${log.beds24_booking_id}`);
      console.log(`Processed: ${log.processed ? '✅ Yes' : '❌ No'}`);

      try {
        const payload = typeof log.webhook_payload === 'string' 
          ? JSON.parse(log.webhook_payload) 
          : log.webhook_payload;

        if (payload.messages && Array.isArray(payload.messages)) {
          console.log(`Messages: ${payload.messages.length} found`);
          
          payload.messages.forEach((msg, msgIndex) => {
            console.log(`  Message ${msgIndex + 1}:`);
            console.log(`    ID: ${msg.id}`);
            console.log(`    Source: "${msg.source}" ${msg.source === 'host' ? '👑 HOST' : '👤 GUEST'}`);
            console.log(`    Time: ${msg.time}`);
            console.log(`    Read: ${msg.read}`);
            console.log(`    Content: "${msg.message?.substring(0, 50)}${msg.message?.length > 50 ? '...' : ''}"`);
          });
        } else {
          console.log('Messages: None found in payload');
        }

        console.log('Full payload structure:');
        console.log(`  Keys: [${Object.keys(payload).join(', ')}]`);
        
      } catch (parseError) {
        console.log('❌ Error parsing webhook payload:', parseError.message);
      }
    });

    // Check if any recent webhook logs were processed but still created duplicates
    const processedLogs = webhookLogs.filter(log => log.processed);
    if (processedLogs.length > 0) {
      console.log('\n⚠️  CRITICAL FINDING:');
      console.log(`${processedLogs.length} webhooks were marked as "processed" but duplicates still occurred`);
      console.log('This suggests the echo detection logic is not working in the webhook processing');
    }

    // Also check if there are any unprocessed webhook logs
    const unprocessedLogs = webhookLogs.filter(log => !log.processed);
    if (unprocessedLogs.length > 0) {
      console.log('\n📌 NOTE:');
      console.log(`${unprocessedLogs.length} webhooks are marked as "unprocessed"`);
      console.log('These might be pending or failed webhook processing attempts');
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  }
}

// Run the analysis
if (require.main === module) {
  checkWebhookStructure()
    .then(() => {
      console.log('\n🎯 Webhook structure analysis complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { checkWebhookStructure };
