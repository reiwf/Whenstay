const { supabaseAdmin } = require('../config/supabase');
const imageProcessingService = require('../services/imageProcessingService');

async function fixExpiredImageUrls() {
  try {
    console.log('🔧 Starting to fix expired image URLs in existing messages...');

    // Find messages that contain potential signed URLs
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, content, created_at')
      .ilike('content', '%amazonaws.com%')
      .order('created_at', { ascending: false })
      .limit(100); // Process recent messages first

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    console.log(`Found ${messages.length} messages with potential AWS URLs`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const message of messages) {
      try {
        console.log(`\nProcessing message ${message.id}...`);
        
        // Extract image URLs to check if any are signed URLs
        const imageUrls = imageProcessingService.extractImageUrls(message.content);
        const signedUrls = imageUrls.filter(url => imageProcessingService.isSignedUrl(url));

        if (signedUrls.length === 0) {
          console.log(`  ⏭️  No signed URLs found, skipping`);
          skippedCount++;
          continue;
        }

        console.log(`  📸 Found ${signedUrls.length} signed URLs to process`);

        // Process the message content
        const processedContent = await imageProcessingService.processMessageImages(
          message.content, 
          message.id
        );

        if (processedContent !== message.content) {
          // Update the message with permanent URLs
          await imageProcessingService.updateMessageContent(message.id, processedContent);
          console.log(`  ✅ Updated message ${message.id} with permanent URLs`);
          processedCount++;
        } else {
          console.log(`  ⏭️  No changes needed for message ${message.id}`);
          skippedCount++;
        }

      } catch (messageError) {
        console.error(`  ❌ Error processing message ${message.id}:`, messageError);
        errorCount++;
        // Continue with next message
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  ✅ Processed: ${processedCount} messages`);
    console.log(`  ⏭️  Skipped: ${skippedCount} messages`);
    console.log(`  ❌ Errors: ${errorCount} messages`);
    console.log('🎉 Fix expired image URLs completed!');

  } catch (error) {
    console.error('❌ Error in fixExpiredImageUrls:', error);
  }
}

// Run the script if called directly
if (require.main === module) {
  fixExpiredImageUrls()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = fixExpiredImageUrls;
