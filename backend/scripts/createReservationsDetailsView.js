require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function createReservationsDetailsView() {
  try {
    console.log('Creating reservations_details view...');
    
    const viewSQL = `
-- Updated View with Full Hierarchy
CREATE OR REPLACE VIEW public.reservations_details AS
SELECT 
  r.id,
  r.beds24_booking_id,
  r.property_id,
  r.room_type_id,
  r.room_unit_id,
  r.booking_name,
  r.booking_email,
  r.booking_phone,
  r.check_in_date,
  r.check_out_date,
  r.num_guests,
  r.total_amount,
  r.currency,
  r.status,
  r.booking_source,
  r.num_adults,
  r.num_children,
  r.special_requests,
  r.check_in_token,
  r.guest_lastname,
  r.guest_firstname,
  r.guest_contact,
  r.guest_mail,
  r.passport_url,
  r.guest_address,
  r.estimated_checkin_time,
  r.travel_purpose,
  r.emergency_contact_name,
  r.emergency_contact_phone,
  r.agreement_accepted,
  r.checkin_submitted_at,
  r.admin_verified,
  r.verified_at,
  r.verified_by,
  r.created_at,
  r.updated_at,
  -- Property details
  p.name as property_name,
  p.address as property_address,
  p.wifi_name as property_wifi_name,
  p.wifi_password as property_wifi_password,
  p.house_rules,
  p.check_in_instructions,
  p.emergency_contact as property_emergency_contact,
  p.property_amenities,
  p.location_info,
  -- Room type details
  rt.name as room_type_name,
  rt.description as room_type_description,
  rt.max_guests as room_type_max_guests,
  rt.base_price,
  rt.room_amenities as room_type_amenities,
  rt.bed_configuration,
  rt.room_size_sqm,
  rt.has_balcony as room_type_has_balcony,
  rt.has_kitchen as room_type_has_kitchen,
  rt.is_accessible as room_type_is_accessible,
  -- Room unit details
  ru.unit_number,
  ru.floor_number,
  ru.access_code,
  ru.access_instructions,
  ru.wifi_name as unit_wifi_name,
  ru.wifi_password as unit_wifi_password,
  ru.unit_amenities,
  ru.maintenance_notes,
  -- Verified by details
  up.first_name as verified_by_name,
  up.last_name as verified_by_lastname
FROM reservations r
LEFT JOIN properties p ON r.property_id = p.id
LEFT JOIN room_types rt ON r.room_type_id = rt.id
LEFT JOIN room_units ru ON r.room_unit_id = ru.id
LEFT JOIN user_profiles up ON r.verified_by = up.id;
    `;

    const { error } = await supabaseAdmin.rpc('exec_sql', { sql: viewSQL });
    
    if (error) {
      console.error('Error creating view:', error);
      
      // If exec_sql doesn't exist, try direct query
      const { error: directError } = await supabaseAdmin
        .from('reservations_details')
        .select('*', { count: 'exact', head: true });
        
      if (directError && directError.code === '42P01') {
        console.log('View does not exist, trying alternative approach...');
        
        // Try creating the view using a simple query approach
        const { error: createError } = await supabaseAdmin.rpc('exec', { 
          sql: viewSQL 
        });
        
        if (createError) {
          console.error('Alternative approach failed:', createError);
          console.log('View creation failed. The view might need to be created manually in the database.');
        } else {
          console.log('View created successfully using alternative approach!');
        }
      } else {
        console.log('View already exists or accessible!');
      }
    } else {
      console.log('View created successfully!');
    }
    
    // Test the view
    console.log('Testing view access...');
    const { data, error: testError } = await supabaseAdmin
      .from('reservations_details')
      .select('*')
      .limit(1);
      
    if (testError) {
      console.error('Error testing view:', testError);
    } else {
      console.log('View test successful! Found', data?.length || 0, 'records');
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

createReservationsDetailsView();
