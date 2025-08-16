const automationService = require('../services/automationService');
const reservationService = require('../services/reservationService');

async function testManualAutomation() {
  try {
    console.log('=== Testing Manual Automation Trigger ===');
    
    // Get the reservation that was just created
    const reservationId = 'ba3ad3be-76f3-448d-9577-2ecaf2d481da';
    const beds24BookingId = '74334825';
    
    console.log(`Testing automation for reservation: ${reservationId}`);
    console.log(`Beds24 Booking ID: ${beds24BookingId}`);
    
    // Get reservation details
    const reservation = await reservationService.getReservationById(reservationId);
    
    if (!reservation) {
      console.error('Reservation not found!');
      return;
    }
    
    console.log('Reservation details:', {
      id: reservation.id,
      beds24BookingId: reservation.beds24_booking_id,
      bookingName: reservation.booking_name,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      bookingSource: reservation.booking_source,
      propertyId: reservation.property_id
    });
    
    // Process automation (as new booking)
    console.log('\n=== Triggering Automation ===');
    const result = await automationService.processReservationAutomation(reservation, false);
    
    console.log('Automation result:', result);
    
    // Check what scheduled messages were created
    console.log('\n=== Checking Scheduled Messages ===');
    const { supabaseAdmin } = require('../config/supabase');
    
    const { data: scheduledMessages, error } = await supabaseAdmin
      .from('scheduled_messages')
      .select(`
        id,
        status,
        run_at,
        cancellation_reason,
        automation_rules!fk_scheduled_messages_rule_id(name),
        message_templates(name)
      `)
      .eq('reservation_id', reservationId)
      .order('created_at');
    
    if (error) {
      console.error('Error fetching scheduled messages:', error);
    } else {
      console.log(`Found ${scheduledMessages?.length || 0} scheduled messages:`);
      scheduledMessages?.forEach((msg, index) => {
        console.log(`${index + 1}. ${msg.automation_rules?.name || 'Unknown Rule'}`);
        console.log(`   Template: ${msg.message_templates?.name || 'Unknown Template'}`);
        console.log(`   Status: ${msg.status}`);
        console.log(`   Run at: ${msg.run_at}`);
        console.log(`   Cancellation reason: ${msg.cancellation_reason || 'N/A'}`);
        console.log('');
      });
    }
    
    console.log('=== Test Complete ===');
    
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testManualAutomation().then(() => {
  console.log('Manual automation test finished');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
