const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { supabaseAdmin } = require('../config/supabase');

async function cleanupTestRoomUnits() {
  try {
    console.log('Starting cleanup of test room units...');
    
    // Find all room units with beds24_unit_id = '3' or unit_number = 'Unit 3'
    const { data: testRoomUnits, error: fetchError } = await supabaseAdmin
      .from('room_units')
      .select('*')
      .or('beds24_unit_id.eq.3,unit_number.eq.Unit 3');
    
    if (fetchError) {
      console.error('Error fetching test room units:', fetchError);
      return;
    }
    
    if (!testRoomUnits || testRoomUnits.length === 0) {
      console.log('No test room units found.');
      return;
    }
    
    console.log('Found test room units:', testRoomUnits.map(unit => ({
      id: unit.id,
      unit_number: unit.unit_number,
      beds24_unit_id: unit.beds24_unit_id,
      room_type_id: unit.room_type_id
    })));
    
    // Delete all test room units
    for (const unit of testRoomUnits) {
      console.log(`Deleting room unit: ${unit.id} (${unit.unit_number})`);
      
      const { error: deleteError } = await supabaseAdmin
        .from('room_units')
        .delete()
        .eq('id', unit.id);
      
      if (deleteError) {
        console.error(`Error deleting room unit ${unit.id}:`, deleteError);
      } else {
        console.log(`Successfully deleted room unit ${unit.id}`);
      }
    }
    
    console.log('Cleanup completed successfully.');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
cleanupTestRoomUnits().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
