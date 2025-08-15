/**
 * Test script for Airbnb outbound message sending
 * Tests Phase 2 - outbound message functionality
 */

// Load environment variables
require('dotenv').config();

const communicationService = require('../services/communicationService');
const reservationService = require('../services/reservationService');

async function testAirbnbOutboundMessage() {
  try {
    console.log('🧪 Testing Airbnb outbound message sending...');
    
    // Step 1: Find existing reservation and thread
    console.log('\n1. Finding existing reservation and thread...');
    
    // Use the reservation from the logs: 73962089
    const reservation = await reservationService.getReservationByBeds24Id('73962089');
    
    if (!reservation) {
      console.log('❌ No reservation found for Beds24 booking ID: 73962089');
      return;
    }

    console.log('✅ Found reservation:', {
      id: reservation.id,
      guestName: reservation.guest_name || reservation.booking_name,
      beds24BookingId: reservation.beds24_booking_id
    });

    // Find existing thread
    const thread = await communicationService.findOrCreateThreadByReservation(
      reservation.id,
      {
        subject: `Airbnb - ${reservation.booking_name || reservation.guest_name || 'Guest'}`,
        channels: [{ channel: 'airbnb', external_thread_id: reservation.beds24_booking_id }]
      }
    );

    console.log('✅ Thread found:', {
      id: thread.id,
      subject: thread.subject
    });

    // Step 2: Send test message via Airbnb channel
    console.log('\n2. Sending test message via Airbnb channel...');
    
    const testMessage = `Hello! This is a test message from the WhensStay communication system. Time: ${new Date().toISOString()}`;
    
    try {
      const outgoingMessage = await communicationService.sendMessage({
        thread_id: thread.id,
        channel: 'airbnb',
        content: testMessage,
        origin_role: 'host'
      });

      console.log('✅ Message queued successfully:', {
        messageId: outgoingMessage.id,
        threadId: outgoingMessage.thread_id,
        channel: 'airbnb',
        content: testMessage.substring(0, 50) + '...'
      });

      // Wait for processing
      console.log('\n3. Waiting for message processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check delivery status
      const { data: delivery, error } = await require('../config/supabase').supabaseAdmin
        .from('message_deliveries')
        .select('*')
        .eq('message_id', outgoingMessage.id)
        .eq('channel', 'airbnb')
        .single();

      if (error) {
        console.log('❌ Could not fetch delivery status:', error.message);
      } else {
        console.log('✅ Delivery status:', {
          status: delivery.status,
          queuedAt: delivery.queued_at,
          sentAt: delivery.sent_at,
          errorMessage: delivery.error_message || 'None'
        });

        if (delivery.status === 'sent') {
          console.log('🎉 Message sent successfully to Airbnb via Beds24!');
        } else if (delivery.status === 'failed') {
          console.log('⚠️  Message failed to send:', delivery.error_message);
          console.log('   This might be expected if Beds24 API endpoint is not available or configured');
        } else {
          console.log(`ℹ️  Message status: ${delivery.status}`);
        }
      }

    } catch (sendError) {
      console.log('❌ Failed to send message:', sendError.message);
    }

    // Step 3: Check complete thread state
    console.log('\n4. Checking thread messages...');
    const allMessages = await communicationService.getMessages(thread.id, { limit: 10 });
    
    console.log(`✅ Thread contains ${allMessages.length} recent messages:`);
    allMessages.slice(-5).forEach((msg, idx) => {
      const timestamp = new Date(msg.created_at).toLocaleTimeString();
      console.log(`   ${idx + 1}. [${msg.origin_role}] ${msg.direction} via ${msg.channel} (${timestamp})`);
      console.log(`      "${msg.content.substring(0, 60)}..."`);
    });

    console.log('\n📋 Test Summary:');
    console.log(`   📤 Outbound message: ${outgoingMessage ? 'Created' : 'Failed'}`);
    console.log(`   🔗 Thread ID: ${thread.id}`);
    console.log(`   🏨 Reservation: ${reservation.beds24_booking_id}`);
    console.log(`   📧 Channel: airbnb`);

  } catch (error) {
    console.error('❌ Outbound message test failed:', error);
  }
}

// Run the test
if (require.main === module) {
  testAirbnbOutboundMessage()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test script error:', error);
      process.exit(1);
    });
}

module.exports = { testAirbnbOutboundMessage };


