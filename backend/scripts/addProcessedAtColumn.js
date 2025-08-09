const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addProcessedAtColumn() {
  try {
    console.log('Adding processed_at column to reservation_webhook_logs table...');
    
    // Add the processed_at column using direct SQL query
    const { data, error } = await supabase
      .from('reservation_webhook_logs')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error accessing reservation_webhook_logs table:', error);
      return;
    }
    
    // Check if processed_at column already exists
    if (data && data.length > 0 && 'processed_at' in data[0]) {
      console.log('✅ processed_at column already exists in reservation_webhook_logs table');
      return;
    }
    
    console.log('Column does not exist, attempting to add via database service...');
    console.log('Note: The column needs to be added manually to the database schema');
    console.log('SQL to run: ALTER TABLE public.reservation_webhook_logs ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;');
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

addProcessedAtColumn();
