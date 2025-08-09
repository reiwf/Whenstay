const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addAccessReadField() {
  try {
    console.log('Adding access_read field to reservations table...');
    
    // Add access_read column to reservations table
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.reservations 
        ADD COLUMN IF NOT EXISTS access_read boolean DEFAULT false;
        
        -- Add index for access_read
        CREATE INDEX IF NOT EXISTS idx_reservations_access_read 
        ON public.reservations USING btree (access_read);
      `
    });

    if (error) {
      console.error('Error adding access_read field:', error);
      return;
    }

    console.log('Successfully added access_read field to reservations table');

  } catch (error) {
    console.error('Error:', error);
  }
}

addAccessReadField();
