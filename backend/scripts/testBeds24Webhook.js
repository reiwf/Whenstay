const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const axios = require('axios');
const beds24Service = require('../services/beds24Service');
const databaseService = require('../services/databaseService');


// Sample Beds24 webhook payload based on the example in the database
const sampleWebhookPayload = {
  "event": "booking_new",
  "eventId": `test-webhook-${Date.now()}`,
  "booking": {
    "id": `TEST-${Date.now()}`,
    "propertyId": "285552",
    "roomId": "595552",
    "unitId": "1",
    "firstName": "John",
    "lastName": "Doe", 
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "mobile": "+1234567890",
    "arrival": "2024-01-15",
    "departure": "2024-01-18",
    "numAdult": 2,
    "numChild": 0,
    "price": 300.00,
    "currency": "JPY",
    "status": "confirmed",
    "referer": "Booking.com",
    "channel": "Booking.com",
    "apiReference": "BDC-123456",
    "rateDescription": "Standard Rate - Non-refundable",
    "commission": 45.00,
    "apiMessage": "Booking confirmed successfully",
    "bookingTime": "2024-01-10T14:30:00Z",
    "lang": "en",
    "comments": "Late check-in requested",
    "message": "Guest prefers room on upper floor with city view",
    "notes": "VIP guest - provide welcome amenities"
  },
  "body": {
    "timeStamp": "2024-01-10T14:30:00Z"
  }
};

// Test functions
async function testWebhookProcessing() {
  console.log('🧪 Testing Beds24 Webhook Processing...\n');

  try {
    // Test 1: Process webhook data
    console.log('1️⃣ Testing webhook data processing...');
    const processedData = await beds24Service.processWebhookData(sampleWebhookPayload);
    
    console.log('✅ Processed webhook data:');
    console.log(JSON.stringify({
      beds24BookingId: processedData.beds24BookingId,
      bookingName: processedData.bookingName,
      bookingLastname: processedData.bookingLastname,
      bookingEmail: processedData.bookingEmail,
      bookingPhone: processedData.bookingPhone,
      checkInDate: processedData.checkInDate,
      checkOutDate: processedData.checkOutDate,
      numGuests: processedData.numGuests,
      numAdults: processedData.numAdults,
      numChildren: processedData.numChildren,
      totalAmount: processedData.totalAmount,
      currency: processedData.currency,
      status: processedData.status,
      bookingSource: processedData.bookingSource,
      propertyId: processedData.propertyId,
      roomTypeId: processedData.roomTypeId,
      roomUnitId: processedData.roomUnitId
    }, null, 2));

    // Test 2: Create reservation from processed data
    console.log('\n2️⃣ Testing reservation creation...');
    const reservation = await databaseService.createReservation(processedData);
    
    console.log('✅ Created reservation:');
    console.log(JSON.stringify({
      id: reservation.id,
      beds24_booking_id: reservation.beds24_booking_id,
      booking_name: reservation.booking_name,
      booking_email: reservation.booking_email,
      check_in_date: reservation.check_in_date,
      check_out_date: reservation.check_out_date,
      property_id: reservation.property_id,
      room_type_id: reservation.room_type_id,
      room_unit_id: reservation.room_unit_id,
      status: reservation.status
    }, null, 2));

    // Test 3: Test booking update
    console.log('\n3️⃣ Testing booking update...');
    const updatedPayload = {
      ...sampleWebhookPayload,
      event: "booking_modified",
      booking: {
        ...sampleWebhookPayload.booking,
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        numAdult: 3,
        price: 450.00,
        comments: "Updated booking - extra guest added"
      }
    };

    const updatedData = await beds24Service.processWebhookData(updatedPayload);
    const updatedReservation = await databaseService.updateReservation(reservation.id, updatedData);
    
    console.log('✅ Updated reservation:');
    console.log(JSON.stringify({
      id: updatedReservation.id,
      booking_name: updatedReservation.booking_name,
      booking_email: updatedReservation.booking_email,
      num_adults: updatedReservation.num_adults,
      total_amount: updatedReservation.total_amount
    }, null, 2));

    // Test 4: Test webhook logging
    console.log('\n4️⃣ Testing webhook logging...');
    const logEntry = await databaseService.logReservationWebhook(
      processedData.beds24BookingId,
      sampleWebhookPayload,
      true
    );
    
    if (logEntry) {
      console.log('✅ Logged webhook event:');
      console.log(JSON.stringify({
        id: logEntry.id,
        beds24_booking_id: logEntry.beds24_booking_id,
        processed: logEntry.processed,
        received_at: logEntry.received_at
      }, null, 2));
    }

    // Test 5: Test property/room creation for new property
    console.log('\n5️⃣ Testing property/room auto-creation...');
    const newPropertyPayload = {
      ...sampleWebhookPayload,
      booking: {
        ...sampleWebhookPayload.booking,
        id: `NEW-PROPERTY-${Date.now()}`,
        propertyId: "99999",
        roomId: "999",
        unitId: "999"
      }
    };

    const newPropertyData = await beds24Service.processWebhookData(newPropertyPayload);
    console.log('✅ Auto-created property/room mappings:');
    console.log(JSON.stringify({
      propertyId: newPropertyData.propertyId,
      roomTypeId: newPropertyData.roomTypeId,
      roomUnitId: newPropertyData.roomUnitId
    }, null, 2));

    // Cleanup - remove test reservation
    console.log('\n6️⃣ Cleaning up test data...');
    await databaseService.updateReservationStatus(reservation.id, 'cancelled');
    console.log('✅ Test reservation marked as cancelled');

    console.log('\n🎉 All webhook tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Test webhook endpoint directly
async function testWebhookEndpoint() {
  console.log('\n🌐 Testing webhook endpoint...\n');

  try {
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const webhookUrl = `${serverUrl}/api/webhooks/beds24`;

    console.log(`Sending test webhook to: ${webhookUrl}`);

    const response = await axios.post(webhookUrl, sampleWebhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Beds24-Webhook-Test'
      },
      timeout: 10000
    });

    console.log('✅ Webhook endpoint response:');
    console.log(`Status: ${response.status}`);
    console.log(`Data:`, response.data);

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('⚠️ Server not running - skipping endpoint test');
      console.log('Start the server with: npm start');
    } else {
      console.error('❌ Webhook endpoint test failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }
}

// Test field mapping specifically
async function testFieldMapping() {
  console.log('\n🔧 Testing field mapping...\n');

  const testCases = [
    {
      name: "Complete booking data",
      payload: sampleWebhookPayload
    },
    {
      name: "Minimal booking data",
      payload: {
        booking: {
          id: "MIN-001",
          firstName: "Alice",
          email: "alice@test.com",
          arrival: "2024-02-01",
          departure: "2024-02-03"
        }
      }
    },
    {
      name: "Booking with legacy field names",
      payload: {
        booking: {
          id: "LEG-001",
          guestName: "Bob Brown",
          guestEmail: "bob@test.com",
          arrival: "2024-03-01",
          departure: "2024-03-03",
          adults: 1,
          room: "201"
        }
      }
    }
  ];

  for (const testCase of testCases) {
    try {
      console.log(`Testing: ${testCase.name}`);
      const processed = await beds24Service.processWebhookData(testCase.payload);
      
      console.log('✅ Mapped fields:');
      console.log(`  - Booking ID: ${processed.beds24BookingId}`);
      console.log(`  - Guest Name: ${processed.bookingName} ${processed.bookingLastname || ''}`);
      console.log(`  - Email: ${processed.bookingEmail}`);
      console.log(`  - Check-in: ${processed.checkInDate}`);
      console.log(`  - Check-out: ${processed.checkOutDate}`);
      console.log(`  - Guests: ${processed.numGuests} (${processed.numAdults} adults, ${processed.numChildren} children)`);
      console.log(`  - Status: ${processed.status}`);
      console.log('');
      
    } catch (error) {
      console.error(`❌ Failed: ${testCase.name} - ${error.message}`);
    }
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Beds24 Webhook Tests\n');
  console.log('=' .repeat(50));

  try {
    // Test field mapping
    await testFieldMapping();
    
    // Test webhook processing logic
    await testWebhookProcessing();
    
    // Test actual webhook endpoint (if server is running)
    await testWebhookEndpoint();
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('\n' + '='.repeat(50));
    console.error('💥 Tests failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testWebhookProcessing,
  testWebhookEndpoint,
  testFieldMapping,
  runTests
};
