/**
 * Test script for Beds24 webhook message processing
 * This simulates the webhook payload with messages to test our implementation
 */

// Load environment variables
require('dotenv').config();

const communicationService = require('../services/communicationService');
const reservationService = require('../services/reservationService');

// Sample webhook data with messages (based on the example in the MD file)
const sampleWebhookData = {
  timeStamp: '2025-08-14T09:39:35Z',
  booking: {
    id: 73041783,
    propertyId: 285552,
    roomId: 595552,
    unitId: 3,
    status: 'new',
    arrival: '2025-08-14',
    departure: '2025-08-17',
    numAdult: 3,
    numChild: 0,
    firstName: '思程',
    lastName: '景',
    phone: '8617688945734',
    country: 'zh',
    lang: 'zh',
    referer: 'Airbnb',
    apiSource: 'Airbnb',
    apiReference: 'HMKWPBTX88',
    price: 49500,
    commission: 7425
  },
  messages: [
    {
      id: 109324538,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-07-20T13:36:36Z',
      read: true,
      message: '好的bro 已预订',
      source: 'guest'
    },
    {
      id: 109324661,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-07-20T13:37:32Z',
      read: true,
      message: '到时候的入住流程是怎样的？',
      source: 'guest'
    },
    {
      id: 109326863,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-07-20T13:56:09Z',
      read: true,
      message: 'Hi.thank you. It is self check in. 4-digit code to unlock keybox next to the room.',
      source: 'host'
    },
    {
      id: 109328486,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-07-20T14:07:16Z',
      read: true,
      message: 'ok',
      source: 'guest'
    },
    {
      id: 112954085,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-08-14T09:32:28Z',
      read: false,
      message: '你好',
      source: 'guest'
    },
    {
      id: 112954092,
      authorOwnerId: null,
      bookingId: 73041783,
      time: '2025-08-14T09:32:32Z',
      read: false,
      message: '下面的门打不开',
      source: 'guest'
    }
  ]
};

// Import the webhook processing functions
async function testWebhookMessageProcessing() {
  try {
    console.log('🧪 Testing Beds24 webhook message processing...');
    
    // First, let's see if we can find the reservation
    console.log('\n1. Checking for existing reservation...');
    const reservation = await reservationService.getReservationByBeds24Id('73041783');
    
    if (!reservation) {
      console.log('❌ No reservation found for Beds24 booking ID: 73041783');
      console.log('💡 You need to create this reservation first or use an existing booking ID');
      return;
    }
    
    console.log('✅ Found reservation:', {
      id: reservation.id,
      guestName: reservation.guest_name || reservation.booking_name,
      checkIn: reservation.check_in_date,
      beds24BookingId: reservation.beds24_booking_id
    });
    
    // Test finding or creating thread
    console.log('\n2. Testing thread creation/finding...');
    const thread = await communicationService.findOrCreateThreadByReservation(
      reservation.id,
      {
        subject: `Airbnb - ${reservation.booking_name || reservation.guest_name || 'Guest'}`,
        channels: [{ channel: 'airbnb', external_thread_id: '73041783' }]
      }
    );
    
    console.log('✅ Thread:', {
      id: thread.id,
      subject: thread.subject,
      reservationId: thread.reservation_id
    });
    
    // Test message processing
    console.log('\n3. Testing message processing...');
    
    for (const [index, message] of sampleWebhookData.messages.entries()) {
      console.log(`\n   Processing message ${index + 1}/${sampleWebhookData.messages.length}:`);
      console.log(`   ID: ${message.id}, Source: ${message.source}, Read: ${message.read}`);
      console.log(`   Content: ${message.message.substring(0, 50)}...`);
      
      try {
        // Map message source to origin role
        const originRole = message.source === 'guest' ? 'guest' : 'host';
        
        // Prepare message data
        const messageData = {
          thread_id: thread.id,
          channel: 'airbnb',
          content: message.message || '',
          origin_role: originRole,
          provider_message_id: message.id.toString(),
          read: message.read || false,
          sent_at: message.time
        };
        
        // Receive the message through communication service
        const result = await communicationService.receiveMessage(messageData);
        
        if (result.duplicate) {
          console.log(`   ⚠️  Message ${message.id} already exists, skipping`);
          continue;
        }
        
        console.log(`   ✅ Created message ${result.id}`);
        
        // If message is marked as read, update delivery status
        if (message.read) {
          try {
            await communicationService.updateDeliveryStatus(
              result.id,
              'airbnb',
              'read'
            );
            console.log(`   ✅ Marked as read`);
          } catch (readError) {
            console.log(`   ⚠️  Could not mark as read: ${readError.message}`);
          }
        }
        
      } catch (messageError) {
        console.log(`   ❌ Error processing message: ${messageError.message}`);
      }
    }
    
    // Check final thread state
    console.log('\n4. Checking final thread state...');
    const messages = await communicationService.getMessages(thread.id);
    console.log(`✅ Thread now has ${messages.length} messages`);
    
    messages.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. [${msg.origin_role}] ${msg.content.substring(0, 50)}... (${msg.channel})`);
    });
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testWebhookMessageProcessing()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

module.exports = { testWebhookMessageProcessing, sampleWebhookData };
