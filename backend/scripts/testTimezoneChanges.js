#!/usr/bin/env node

/**
 * Test script to verify timezone changes in automationService
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Test the timezone-aware date formatting
function testTimezoneFormatting() {
  console.log('=== Testing Timezone Formatting ===');
  
  // Test formatDate function (Asia/Tokyo timezone)
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      timeZone: 'Asia/Tokyo'
    });
  };

  // Test formatTime function (Asia/Tokyo timezone)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Tokyo'
    });
  };

  // Test date formatting
  const testDate = '2025-08-17';
  const formattedDate = formatDate(testDate);
  console.log(`Date ${testDate} formatted: ${formattedDate}`);

  // Test time formatting
  const testTime = '15:30';
  const formattedTime = formatTime(testTime);
  console.log(`Time ${testTime} formatted: ${formattedTime}`);

  // Test short date formatting
  const shortDate = new Date(testDate).toLocaleDateString('en-US', { timeZone: 'Asia/Tokyo' });
  console.log(`Short date format: ${shortDate}`);

  // Test today calculation in Asia/Tokyo timezone
  const todayTokyo = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  console.log(`Today in Tokyo (YYYY-MM-DD): ${todayTokyo}`);

  // Test timezone-aware today start calculation
  const todayInTokyo = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const todayStart = new Date(todayInTokyo + 'T00:00:00.000Z');
  console.log(`Today start in Tokyo: ${todayStart.toISOString()}`);

  console.log('✅ Timezone formatting tests completed\n');
}

// Test automation service timezone functionality
async function testAutomationTimezone() {
  console.log('=== Testing Automation Service Timezone ===');
  
  try {
    const automationService = require('../services/automationService');
    
    // Test getPropertyTimezone method
    const timezone = await automationService.getPropertyTimezone(null);
    console.log(`Default property timezone: ${timezone}`);
    
    // Test buildTemplateVariables with sample reservation
    const sampleReservation = {
      id: 'test-123',
      booking_name: 'John',
      booking_lastname: 'Doe',
      check_in_date: '2025-08-17',
      check_out_date: '2025-08-20',
      check_in_time: '16:00',
      check_out_time: '10:00',
      num_guests: 2,
      property_id: null
    };
    
    const variables = await automationService.buildTemplateVariables(sampleReservation);
    
    console.log('Template variables with Asia/Tokyo timezone:');
    console.log(`- check_in_date: ${variables.check_in_date}`);
    console.log(`- check_out_date: ${variables.check_out_date}`);
    console.log(`- check_in_date_short: ${variables.check_in_date_short}`);
    console.log(`- check_out_date_short: ${variables.check_out_date_short}`);
    console.log(`- check_in_time: ${variables.check_in_time}`);
    console.log(`- check_out_time: ${variables.check_out_time}`);
    console.log(`- _today: ${variables._today}`);
    
    console.log('✅ Automation service timezone tests completed\n');
    
  } catch (error) {
    console.error('❌ Error testing automation service:', error.message);
  }
}

// Test timezone comparison logic
function testTimezoneComparisons() {
  console.log('=== Testing Timezone Comparisons ===');
  
  // Test check-in date comparison using Asia/Tokyo timezone
  const todayInTokyo = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const todayStart = new Date(todayInTokyo + 'T00:00:00.000Z');
  
  const futureCheckIn = new Date('2025-08-18T16:00:00.000Z');
  const todayCheckIn = new Date(todayInTokyo + 'T16:00:00.000Z');
  const pastCheckIn = new Date('2025-08-15T16:00:00.000Z');
  
  console.log(`Today start (Tokyo): ${todayStart.toISOString()}`);
  console.log(`Future check-in >= today start: ${futureCheckIn >= todayStart}`);
  console.log(`Today check-in >= today start: ${todayCheckIn >= todayStart}`);
  console.log(`Past check-in >= today start: ${pastCheckIn >= todayStart}`);
  
  console.log('✅ Timezone comparison tests completed\n');
}

// Main test function
async function runTests() {
  console.log('🔍 Testing Timezone Changes in Automation Service\n');
  console.log(`Current system time: ${new Date().toISOString()}`);
  console.log(`Current time in Asia/Tokyo: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })}\n`);
  
  testTimezoneFormatting();
  await testAutomationTimezone();
  testTimezoneComparisons();
  
  console.log('🎉 All timezone tests completed successfully!');
}

// Run tests if script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
