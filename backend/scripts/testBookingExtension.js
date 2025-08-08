const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const beds24Service = require('../services/beds24Service');
const databaseService = require('../services');

async function testBookingExtension() {
  console.log('🧪 Testing Booking Extension Scenario...\n');

  try {
    const beds24BookingId = `EXTENSION-TEST-${Date.now()}`;
    
    // Step 1: Create initial booking
    console.log('1️⃣ Creating initial booking...');
    const initialBookingPayload = {
      "event": "booking_new",
      "eventId": `initial-${Date.now()}`,
      "booking": {
        "id": beds24BookingId,
        "propertyId": "285552",
        "roomId": "595552",
        "unitId": "1",
        "firstName": "Alice",
        "lastName": "Johnson", 
        "email": "alice.johnson@example.com",
        "phone": "+1234567890",
        "arrival": "2024-03-01",
        "departure": "2024-03-05", // Original 4-night stay
        "numAdult": 2,
        "numChild": 0,
        "price": 400.00,
        "currency": "USD",
        "status": "confirmed",
        "referer": "Booking.com"
      }
    };

    const initialBookingInfo = await beds24Service.processWebhookData(initialBookingPayload);
    const initialReservation = await databaseService.createReservation(initialBookingInfo);
    
    console.log('✅ Initial reservation created:', {
      id: initialReservation.id,
      beds24_booking_id: initialReservation.beds24_booking_id,
      check_in_date: initialReservation.check_in_date,
      check_out_date: initialReservation.check_out_date,
      total_amount: initialReservation.total_amount
    });

    // Step 2: Simulate booking extension (same booking ID, new departure date)
    console.log('\n2️⃣ Processing booking extension...');
    const extensionBookingPayload = {
      "event": "booking_new", // Beds24 might send this as "new" even for extensions
      "eventId": `extension-${Date.now()}`,
      "booking": {
        "id": beds24BookingId, // Same booking ID
        "propertyId": "285552",
        "roomId": "595552",
        "unitId": "1",
        "firstName": "Alice",
        "lastName": "Johnson", 
        "email": "alice.johnson@example.com",
        "phone": "+1234567890",
        "arrival": "2024-03-01", // Same check-in
        "departure": "2024-03-08", // Extended checkout (3 extra nights)
        "numAdult": 2,
        "numChild": 0,
        "price": 700.00, // Updated price for 7 nights
        "currency": "USD",
        "status": "confirmed",
        "referer": "Booking.com"
      }
    };

    const extensionBookingInfo = await beds24Service.processWebhookData(extensionBookingPayload);
    
    // Check if reservation exists (it should)
    const existingReservation = await databaseService.getReservationByBeds24Id(beds24BookingId);
    
    if (existingReservation) {
      console.log('✅ Found existing reservation, updating...');
      const updatedReservation = await databaseService.updateReservation(
        existingReservation.id, 
        extensionBookingInfo
      );
      
      console.log('✅ Reservation updated for extension:', {
        id: updatedReservation.id,
        beds24_booking_id: updatedReservation.beds24_booking_id,
        check_in_date: updatedReservation.check_in_date,
        check_out_date: updatedReservation.check_out_date, // Should be updated
        total_amount: updatedReservation.total_amount // Should be updated
      });

      // Verify the changes
      if (updatedReservation.check_out_date === '2024-03-08' && updatedReservation.total_amount === 700) {
        console.log('✅ Extension handled correctly!');
        console.log(`   - Checkout extended from 2024-03-05 to ${updatedReservation.check_out_date}`);
        console.log(`   - Price updated from $400 to $${updatedReservation.total_amount}`);
      } else {
        console.error('❌ Extension not handled correctly');
        console.error('Expected checkout: 2024-03-08, got:', updatedReservation.check_out_date);
        console.error('Expected amount: 700, got:', updatedReservation.total_amount);
      }
    } else {
      console.error('❌ No existing reservation found for extension');
    }

    // Step 3: Verify we still have only one reservation for this booking ID
    console.log('\n3️⃣ Verifying no duplicate reservations...');
    const { supabaseAdmin } = require('../config/supabase');
    const allReservationsForBooking = await supabaseAdmin
      .from('reservations')
      .select('*')
      .eq('beds24_booking_id', beds24BookingId);

    if (allReservationsForBooking.data.length === 1) {
      console.log('✅ Only one reservation exists (no duplicates)');
    } else {
      console.error(`❌ Found ${allReservationsForBooking.data.length} reservations (should be 1)`);
    }

    // Cleanup
    console.log('\n4️⃣ Cleaning up test data...');
    await databaseService.updateReservationStatus(existingReservation.id, 'cancelled');
    console.log('✅ Test reservation marked as cancelled');

    console.log('\n🎉 Booking extension test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testBookingExtension().then(() => {
    console.log('Test completed.');
    process.exit(0);
  }).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testBookingExtension };
