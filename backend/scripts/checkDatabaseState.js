const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabaseState() {
  try {
    console.log('Checking reservations table structure...');
    const { data: columns, error } = await supabase.rpc('execute', { 
      query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'reservations'
        AND column_name IN ('guest_firstname', 'guest_lastname', 'guest_contact', 'guest_mail', 'checkin_submitted_at', 'admin_verified', 'verified_at', 'verified_by')
        ORDER BY column_name;
      `
    });
    
    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Found old guest columns still in reservations table:', columns);
    }
    
    console.log('Checking reservation_guests table...');
    const { data: guestTable, error: guestError } = await supabase.rpc('execute', { 
      query: `SELECT COUNT(*) as count FROM reservation_guests LIMIT 1;`
    });
    
    if (guestError) {
      console.error('Error checking reservation_guests:', guestError);
    } else {
      console.log('reservation_guests table exists and has data');
    }
    
    // Check current reservations_details view
    console.log('Checking reservations_details view...');
    const { data: viewResult, error: viewError } = await supabase.rpc('execute', { 
      query: `SELECT * FROM reservations_details LIMIT 1;`
    });
    
    if (viewError) {
      console.error('Error with reservations_details view:', viewError);
    } else {
      console.log('reservations_details view is working');
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDatabaseState();
