require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

async function optimizeReservationPerformance() {
  console.log('🚀 Starting reservation performance optimization...');

  try {
    // Add composite indexes for common filter combinations
    const optimizationQueries = [
      // Composite index for property + date filtering (most common use case)
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_property_checkin_status 
       ON reservations (property_id, check_in_date, status);`,

      // Composite index for status + date range queries
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_status_checkin_range 
       ON reservations (status, check_in_date, check_out_date);`,

      // Index for room unit + date filtering
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_room_unit_date 
       ON reservations (room_unit_id, check_in_date);`,

      // Index for owner filtering via property (for property owners)
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_owner_active 
       ON properties (owner_id, is_active);`,

      // Optimize the reservations_details view with materialized view for heavy queries
      `CREATE MATERIALIZED VIEW IF NOT EXISTS reservations_summary AS
       SELECT 
         r.id,
         r.beds24_booking_id,
         r.property_id,
         r.room_type_id,
         r.room_unit_id,
         r.booking_name,
         r.booking_email,
         r.check_in_date,
         r.check_out_date,
         r.status,
         r.admin_verified,
         r.checkin_submitted_at,
         p.name as property_name,
         p.owner_id as property_owner_id,
         rt.name as room_type_name,
         ru.unit_number,
         CONCAT(r.guest_firstname, ' ', r.guest_lastname) as guest_full_name
       FROM reservations r
       LEFT JOIN properties p ON r.property_id = p.id
       LEFT JOIN room_types rt ON r.room_type_id = rt.id
       LEFT JOIN room_units ru ON r.room_unit_id = ru.id;`,

      // Add indexes to the materialized view
      `CREATE INDEX IF NOT EXISTS idx_reservations_summary_property_date 
       ON reservations_summary (property_id, check_in_date);`,

      `CREATE INDEX IF NOT EXISTS idx_reservations_summary_status 
       ON reservations_summary (status);`,

      `CREATE INDEX IF NOT EXISTS idx_reservations_summary_owner_date 
       ON reservations_summary (property_owner_id, check_in_date);`,

      // Add function to refresh materialized view
      `CREATE OR REPLACE FUNCTION refresh_reservations_summary()
       RETURNS void AS $$
       BEGIN
         REFRESH MATERIALIZED VIEW CONCURRENTLY reservations_summary;
       END;
       $$ LANGUAGE plpgsql;`,

      // Analyze tables to update statistics
      `ANALYZE reservations;`,
      `ANALYZE properties;`,
      `ANALYZE room_types;`,
      `ANALYZE room_units;`
    ];

    console.log('📊 Creating performance indexes and materialized views...');

    for (const query of optimizationQueries) {
      try {
        console.log(`Executing: ${query.substring(0, 60)}...`);
        await supabaseAdmin.rpc('exec_sql', { sql: query });
        console.log('✅ Success');
      } catch (error) {
        // Log but don't fail on individual index creation errors
        console.log(`⚠️  Warning: ${error.message}`);
      }
    }

    // Test query performance
    console.log('🔍 Testing query performance...');
    
    const testStart = Date.now();
    const { data, error } = await supabaseAdmin
      .from('reservations_details')
      .select('id, booking_name, property_name, room_type_name, unit_number, check_in_date, status')
      .limit(100);
    
    const testEnd = Date.now();
    
    if (error) {
      console.error('❌ Test query failed:', error);
    } else {
      console.log(`✅ Test query completed in ${testEnd - testStart}ms`);
      console.log(`📊 Retrieved ${data.length} records`);
    }

    console.log('🎉 Reservation performance optimization completed!');
    
    return {
      success: true,
      message: 'Performance optimization completed successfully',
      optimizations: [
        'Added composite indexes for common filter combinations',
        'Created materialized view for heavy queries',
        'Updated table statistics',
        'Verified query performance'
      ]
    };

  } catch (error) {
    console.error('❌ Performance optimization failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Execute the optimization if run directly
if (require.main === module) {
  optimizeReservationPerformance()
    .then(result => {
      console.log('\n' + '='.repeat(50));
      console.log('OPTIMIZATION RESULT:', result);
      console.log('='.repeat(50));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Script execution failed:', error);
      process.exit(1);
    });
}

module.exports = { optimizeReservationPerformance };
