const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTriggers() {
  try {
    console.log('Checking triggers on reservations table...');
    const { data: triggers, error } = await supabase.rpc('execute', { 
      query: `
        SELECT trigger_name, action_statement 
        FROM information_schema.triggers 
        WHERE event_object_table = 'reservations'
        AND event_object_schema = 'public';
      `
    });
    
    if (error) {
      console.error('Error checking triggers:', error);
    } else {
      console.log('Active triggers on reservations table:', triggers);
    }
    
    console.log('Checking the update_verified_at function...');
    const { data: funcResult, error: funcError } = await supabase.rpc('execute', { 
      query: `
        SELECT routine_definition 
        FROM information_schema.routines 
        WHERE routine_name = 'update_verified_at' 
        AND routine_schema = 'public';
      `
    });
    
    if (funcError) {
      console.error('Error checking function:', funcError);
    } else {
      console.log('update_verified_at function definition:', funcResult);
    }
    
    // Check for any remaining problematic triggers
    console.log('Dropping the update_verified_at trigger if it exists...');
    const { error: dropError } = await supabase.rpc('execute', { 
      query: `DROP TRIGGER IF EXISTS update_reservations_verified_at ON public.reservations;`
    });
    
    if (dropError) {
      console.error('Error dropping trigger:', dropError);
    } else {
      console.log('Successfully dropped update_reservations_verified_at trigger');
    }
    
    // Drop the function as well since it references removed columns
    console.log('Dropping the update_verified_at function...');
    const { error: dropFuncError } = await supabase.rpc('execute', { 
      query: `DROP FUNCTION IF EXISTS public.update_verified_at();`
    });
    
    if (dropFuncError) {
      console.error('Error dropping function:', dropFuncError);
    } else {
      console.log('Successfully dropped update_verified_at function');
    }
    
  } catch (err) {
    console.error('Error:', err);
  }
}

checkTriggers();
