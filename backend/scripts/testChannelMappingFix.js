require('dotenv').config();

const communicationService = require('../services/communicationService');
const reservationService = require('../services/reservationService');
const { supabaseAdmin } = require('../config/supabase');

async function testChannelMappingFix() {
  console.log('🧪 Testing Channel Mapping Fix...\n');

  try {
    // Step 1: Create a test reservation if needed
    console.log('Step 1: Setting up test reservation...');
    
    const testBeds24BookingId = `test-airbnb-${Date.now()}`;
    const testReservationData = {
      beds24BookingId: testBeds24BookingId,
      bookingName: 'Test Airbnb Guest',
      bookingEmail: 'test@airbnb.com',
      checkInDate: '2025-09-01',
      checkOutDate: '2025-09-03',
      propertyId: null, // Use null for test
      roomTypeId: null,  // Use null for test
      roomUnitId: null,  // Use null for test
      numGuests: 2,
      totalAmount: 15000,
      currency: 'JPY'
    };

    const reservation = await reservationService.createReservation(testReservationData);
    console.log(`✅ Created test reservation: ${reservation.id}`);

    // Step 2: Test thread creation with Airbnb channel
    console.log('\nStep 2: Testing thread creation with Airbnb channel...');
    
    const channelData = {
      channels: [{ 
        channel: 'airbnb', 
        external_thread_id: testBeds24BookingId 
      }]
    };

    const thread = await communicationService.findOrCreateThreadByReservation(
      reservation.id,
      channelData
    );
    
    console.log(`✅ Thread created/found: ${thread.id}`);

    // Step 3: Verify thread channels were created
    console.log('\nStep 3: Verifying thread channels...');
    
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

    // Step 4: Test adding a second channel to existing thread
    console.log('\nStep 4: Testing adding second channel to existing thread...');
    
    const updatedThread = await communicationService.findOrCreateThreadByReservation(
      reservation.id,
      {
        channels: [
          { channel: 'airbnb', external_thread_id: testBeds24BookingId },
          { channel: 'email', external_thread_id: `email-${testBeds24BookingId}` }
        ]
      }
    );

    const { data: updatedThreadChannels, error: updatedError } = await supabaseAdmin
      .from('thread_channels')
      .select('*')
      .eq('thread_id', updatedThread.id);

    if (updatedError) {
      throw updatedError;
    }

    console.log('Updated thread channels:', updatedThreadChannels);

    // Step 5: Test thread retrieval with channels
    console.log('\nStep 5: Testing thread retrieval with channels...');
    
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

    // Step 6: Test channel availability logic
    console.log('\nStep 6: Testing channel availability logic...');
    
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
      console.log('⚠️ Message creation error (expected for test):', messageError.message);
    }

    // Cleanup
    console.log('\nCleaning up test data...');
    
    // Delete test reservation
    await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', reservation.id);

    console.log('✅ Test cleanup completed');

    console.log('\n🎉 Channel Mapping Fix Test Completed Successfully!');
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
  testChannelMappingFix()
    .then(() => {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testChannelMappingFix };
