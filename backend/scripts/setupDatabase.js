// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { supabaseAdmin } = require('../config/supabase');
const { v4: uuidv4 } = require('../$node_modules/uuid/dist/index.js');

async function setupDatabase() {
  console.log('🚀 Setting up database...');
  
  try {
    // First, let's check if tables exist by trying to query them
    console.log('📋 Checking existing tables...');
    
    const { data: reservations, error: reservationsError } = await supabaseAdmin
      .from('reservations')
      .select('count', { count: 'exact', head: true });
    
    if (reservationsError) {
      console.log('❌ Tables might not exist. Error:', reservationsError.message);
      console.log('📝 Please ensure you have run the SQL schema in your Supabase dashboard.');
      return;
    }
    
    console.log('✅ Tables exist. Current reservations count:', reservations || 0);
    
    // Create dummy reservations
    console.log('🏨 Creating dummy reservations...');
    
    const dummyReservations = [
      {
        beds24_booking_id: 'DEMO-001',
        guest_name: 'John Smith',
        guest_email: 'john.smith@example.com',
        check_in_date: '2025-01-28',
        check_out_date: '2025-01-30',
        room_number: '101',
        num_guests: 2,
        total_amount: 250.00,
        currency: 'USD',
        status: 'invited',
        check_in_token: uuidv4()
      },
      {
        beds24_booking_id: 'DEMO-002',
        guest_name: 'Sarah Johnson',
        guest_email: 'sarah.johnson@example.com',
        check_in_date: '2025-01-29',
        check_out_date: '2025-02-01',
        room_number: '102',
        num_guests: 1,
        total_amount: 180.00,
        currency: 'USD',
        status: 'invited',
        check_in_token: uuidv4()
      },
      {
        beds24_booking_id: 'DEMO-003',
        guest_name: 'Michael Brown',
        guest_email: 'michael.brown@example.com',
        check_in_date: '2025-01-30',
        check_out_date: '2025-02-02',
        room_number: '201',
        num_guests: 3,
        total_amount: 320.00,
        currency: 'USD',
        status: 'invited',
        check_in_token: uuidv4()
      },
      {
        beds24_booking_id: 'DEMO-004',
        guest_name: 'Emma Wilson',
        guest_email: 'emma.wilson@example.com',
        check_in_date: '2025-01-25',
        check_out_date: '2025-01-27',
        room_number: '103',
        num_guests: 2,
        total_amount: 200.00,
        currency: 'USD',
        status: 'completed',
        check_in_token: uuidv4()
      },
      {
        beds24_booking_id: 'DEMO-005',
        guest_name: 'David Lee',
        guest_email: 'david.lee@example.com',
        check_in_date: '2025-01-26',
        check_out_date: '2025-01-28',
        room_number: '202',
        num_guests: 1,
        total_amount: 150.00,
        currency: 'USD',
        status: 'completed',
        check_in_token: uuidv4()
      }
    ];
    
    // Insert reservations one by one to handle any conflicts
    for (const reservation of dummyReservations) {
      try {
        // Check if reservation already exists
        const { data: existing } = await supabaseAdmin
          .from('reservations')
          .select('id')
          .eq('beds24_booking_id', reservation.beds24_booking_id)
          .single();
        
        if (existing) {
          console.log(`⏭️  Reservation ${reservation.beds24_booking_id} already exists, skipping...`);
          continue;
        }
        
        const { data, error } = await supabaseAdmin
          .from('reservations')
          .insert(reservation)
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Error creating reservation ${reservation.beds24_booking_id}:`, error);
        } else {
          console.log(`✅ Created reservation: ${reservation.guest_name} (${reservation.beds24_booking_id})`);
          console.log(`   Check-in token: ${reservation.check_in_token}`);
          console.log(`   Check-in URL: http://localhost:3000/checkin/${reservation.check_in_token}`);
        }
      } catch (err) {
        console.error(`❌ Error processing reservation ${reservation.beds24_booking_id}:`, err.message);
      }
    }
    
    // Create some dummy guest check-ins for completed reservations
    console.log('📝 Creating dummy guest check-ins for completed reservations...');
    
    const { data: completedReservations } = await supabaseAdmin
      .from('reservations')
      .select('id, guest_name')
      .eq('status', 'completed');
    
    if (completedReservations && completedReservations.length > 0) {
      for (const reservation of completedReservations) {
        try {
          // Check if check-in already exists
          const { data: existingCheckin } = await supabaseAdmin
            .from('guest_checkins')
            .select('id')
            .eq('reservation_id', reservation.id)
            .single();
          
          if (existingCheckin) {
            console.log(`⏭️  Check-in for ${reservation.guest_name} already exists, skipping...`);
            continue;
          }
          
          const { data, error } = await supabaseAdmin
            .from('guest_checkins')
            .insert({
              reservation_id: reservation.id,
              passport_url: 'https://example.com/passport.jpg',
              address: '123 Main St, City, Country',
              estimated_checkin_time: '15:00',
              travel_purpose: 'Tourism',
              admin_verified: Math.random() > 0.5 // Randomly verify some
            })
            .select()
            .single();
          
          if (error) {
            console.error(`❌ Error creating check-in for ${reservation.guest_name}:`, error);
          } else {
            console.log(`✅ Created check-in for: ${reservation.guest_name}`);
          }
        } catch (err) {
          console.error(`❌ Error processing check-in for ${reservation.guest_name}:`, err.message);
        }
      }
    }
    
    console.log('🎉 Database setup completed!');
    console.log('\n📋 Summary:');
    console.log('- Created 5 dummy reservations');
    console.log('- 3 reservations are in "invited" status (ready for check-in)');
    console.log('- 2 reservations are "completed" with guest check-ins');
    console.log('\n🔗 Test check-in URLs:');
    
    const { data: invitedReservations } = await supabaseAdmin
      .from('reservations')
      .select('guest_name, check_in_token')
      .eq('status', 'invited');
    
    if (invitedReservations) {
      invitedReservations.forEach(reservation => {
        console.log(`   ${reservation.guest_name}: http://localhost:3000/checkin/${reservation.check_in_token}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  }
}

// Run the setup
setupDatabase().then(() => {
  console.log('✅ Setup script completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Setup script failed:', error);
  process.exit(1);
});


