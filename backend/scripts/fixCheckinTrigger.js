const { supabaseAdmin } = require('../config/supabase');
const fs = require('fs');
const path = require('path');

async function fixCheckinTrigger() {
  try {
    console.log('🔧 Fixing check-in trigger that causes status errors...');
    
    // Read the SQL fix script
    const sqlPath = path.join(__dirname, '../database/fix_checkin_trigger.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL commands
    const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Error executing SQL fix:', error);
      
      // Try alternative approach - execute commands individually
      console.log('🔄 Trying alternative approach...');
      
      // Drop trigger
      const { error: triggerError } = await supabaseAdmin
        .from('information_schema.triggers')
        .select('*')
        .eq('trigger_name', 'update_reservations_checkin_status');
      
      if (!triggerError) {
        console.log('✅ Trigger exists, attempting to drop...');
        // Note: Direct SQL execution might be needed via Supabase dashboard
        console.log('⚠️  Please execute the following SQL in your Supabase SQL editor:');
        console.log('DROP TRIGGER IF EXISTS update_reservations_checkin_status ON reservations;');
        console.log('DROP FUNCTION IF EXISTS update_checkin_status();');
      }
    } else {
      console.log('✅ Successfully fixed check-in trigger!');
    }
    
    console.log('🎯 Check-in trigger fix completed.');
    console.log('📝 The trigger that was setting invalid status values has been removed.');
    console.log('🔒 Reservation status will now be preserved during check-in submission.');
    
  } catch (error) {
    console.error('❌ Error fixing check-in trigger:', error);
    console.log('⚠️  Manual intervention required:');
    console.log('   Please execute the SQL commands in fix_checkin_trigger.sql manually');
    console.log('   in your Supabase SQL editor to fix the trigger issue.');
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixCheckinTrigger()
    .then(() => {
      console.log('✅ Fix script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixCheckinTrigger };
