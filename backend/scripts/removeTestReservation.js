const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { supabaseAdmin } = require('../config/supabase');

async function removeTestReservation() {
  try {
    console.log('Starting removal of test reservation...');
    
    // First, check if the test reservation exists
    const { data: testReservation, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('booking_name', 'TEST')
      .eq('beds24_booking_id', 'MANUAL-1754145302617')
      .single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching test reservation:', fetchError);
      return;
    }
    
    if (!testReservation) {
      console.log('Test reservation not found.');
      return;
    }
    
    console.log('Found test reservation:', {
      id: testReservation.id,
      booking_name: testReservation.booking_name,
      beds24_booking_id: testReservation.beds24_booking_id,
      room_unit_id: testReservation.room_unit_id
    });
    
    // Delete the test reservation
    const { data, error } = await supabaseAdmin
      .from('reservations')
      .delete()
      .eq('id', testReservation.id)
      .select();
    
    if (error) {
      console.error('Error deleting test reservation:', error);
      return;
    }
    
    console.log('Test reservation deleted successfully:', data);
    console.log('Room unit operations should now work properly.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
removeTestReservation().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
