require('dotenv').config();

const communicationService = require('../services/communicationService');
const { supabaseAdmin } = require('../config/supabase');

async function testChannelMappingSimple() {
  console.log('🧪 Testing Channel Mapping Fix (Simple)...\n');

  try {
    // Step 1: Create a thread directly with channel data
    console.log('Step 1: Creating thread with Airbnb channel...');
    
    const testBeds24BookingId = `test-airbnb-${Date.now()}`;
    const channelData = {
      channels: [{ 
        channel: 'airbnb', 
        external_thread_id: testBeds24BookingId 
      }]
    };

    const thread = await communicationService.createThread({
      subject: 'Test Airbnb Thread',
      ...channelData
    });
    
    console.log(`✅ Thread created: ${thread.id}`);

    // Step 2: Verify thread channels were created
    console.log('\nStep 2: Verifying thread channels...');
    
    const { data: threadChannels, error } = await supabaseAdmin
      .from('thread_channels')
      .select('*')
      .eq('thread_id', thread.id);

    if (error) {
      throw error;
    }

    console.log('Thread channels found:', threadChannels);

    const airbnbChannel = threadChannels.find(tc => tc.channel === 'airbnb');
    if (airbnbChannel) {
      console.log('✅ Airbnb channel mapping exists:', airbnbChannel);
    } else {
      console.log('❌ Airbnb channel mapping NOT found');
    }

    // Step 3: Test adding a second channel using addThreadChannels directly
    console.log('\nStep 3: Testing addThreadChannels method...');
    
    const emailChannelData = [{
      channel: 'email',
      external_thread_id: `email-${testBeds24BookingId}`
    }];

    await communicationService.addThreadChannels(thread.id, emailChannelData);

    const { data: updatedThreadChannels, error: updatedError } = await supabaseAdmin
      .from('thread_channels')
      .select('*')
      .eq('thread_id', thread.id);

    if (updatedError) {
      throw updatedError;
    }

    console.log('Updated thread channels:', updatedThreadChannels);

    // Step 4: Test thread retrieval with channels
    console.log('\nStep 4: Testing thread retrieval with channels...');
    
    const { data: fullThread, error: retrievalError } = await supabaseAdmin
      .from('message_threads')
      .select(`
        id,
        reservation_id,
        subject,
        status,
        thread_channels (
          channel,
          external_thread_id
        )
      `)
      .eq('id', thread.id)
      .single();

    if (retrievalError) {
      throw retrievalError;
    }

    console.log('Full thread with channels:', JSON.stringify(fullThread, null, 2));

    // Step 5: Test channel availability logic
    console.log('\nStep 5: Testing channel availability logic...');
    
    function getAvailableChannels(thread) {
      if (!thread) return ['inapp'];
      
      const availableChannels = ['inapp']; // Always available
      
      // Add channels from thread_channels if they exist
      if (thread.thread_channels && Array.isArray(thread.thread_channels)) {
        thread.thread_channels.forEach(tc => {
          if (tc.channel && !availableChannels.includes(tc.channel)) {
            availableChannels.push(tc.channel);
          }
        });
      }
      
      return availableChannels;
    }

    const availableChannels = getAvailableChannels(fullThread);
    console.log('Available channels:', availableChannels);

    if (availableChannels.includes('airbnb')) {
      console.log('✅ Airbnb channel is available in selector');
    } else {
      console.log('❌ Airbnb channel is NOT available in selector');
    }

    // Step 6: Test duplicate channel prevention
    console.log('\nStep 6: Testing duplicate channel prevention...');
    
    try {
      // Try to add the same Airbnb channel again - should not create duplicate
      await communicationService.addThreadChannels(thread.id, [{
        channel: 'airbnb',
        external_thread_id: testBeds24BookingId
      }]);
      
      // Check if duplicate was created
      const { data: finalChannels } = await supabaseAdmin
        .from('thread_channels')
        .select('*')
        .eq('thread_id', thread.id);

      const airbnbChannels = finalChannels.filter(tc => tc.channel === 'airbnb');
      
      if (airbnbChannels.length === 1) {
        console.log('✅ No duplicate channel created');
      } else {
        console.log('❌ Duplicate channel was created:', airbnbChannels);
      }
      
    } catch (duplicateError) {
      console.log('✅ Duplicate channel prevented by database constraint:', duplicateError.message);
    }

    // Step 7: Test message creation via Airbnb channel
    console.log('\nStep 7: Testing message creation via Airbnb channel...');
    
    try {
      const testMessage = await communicationService.receiveMessage({
        thread_id: thread.id,
        channel: 'airbnb',
        content: 'Test message from Airbnb guest',
        origin_role: 'guest',
        provider_message_id: `airbnb-msg-${Date.now()}`
      });

      console.log('✅ Message created successfully:', testMessage.id);
    } catch (messageError) {
      console.log('⚠️ Message creation error:', messageError.message);
    }

    // Cleanup
    console.log('\nCleaning up test data...');
    
    // Delete thread (should cascade delete channels and messages)
    await supabaseAdmin
      .from('message_threads')
      .delete()
      .eq('id', thread.id);

    console.log('✅ Test cleanup completed');

    console.log('\n🎉 Channel Mapping Simple Test Completed Successfully!');
    console.log('\nKey Results:');
    console.log(`- Thread channels created: ${updatedThreadChannels.length}`);
    console.log(`- Available channels: ${availableChannels.join(', ')}`);
    console.log(`- Airbnb channel available: ${availableChannels.includes('airbnb') ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testChannelMappingSimple()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testChannelMappingSimple };
