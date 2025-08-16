const automationService = require('../services/automationService');

// Test the shouldBackfillMessage fix for confirmation messages
function testConfirmationMessageLogic() {
  console.log('Testing shouldBackfillMessage logic for confirmation messages...\n');

  // Mock reservation with check-in date in the past
  const pastReservation = {
    id: 'test-1',
    check_in_date: '2025-08-15', // Yesterday
    check_out_date: '2025-08-20',
    created_at: '2025-08-14T10:00:00Z'
  };

  // Mock reservation with check-in date in the future
  const futureReservation = {
    id: 'test-2', 
    check_in_date: '2025-08-25', // Future date
    check_out_date: '2025-08-30',
    created_at: '2025-08-16T10:00:00Z'
  };

  // Mock confirmation rule
  const confirmationRule = {
    name: 'New Reservation Confirmation',
    event: 'booking_created'
  };

  // Mock welcome rule
  const welcomeRule = {
    name: 'Welcome Message',
    event: 'booking_created'
  };

  const now = new Date();
  const pastRunAt = new Date('2025-08-15T10:00:00Z');

  console.log('Current time:', now.toISOString());
  console.log('Past run time:', pastRunAt.toISOString());
  console.log('');

  // Test 1: Confirmation message with past check-in (should return true)
  console.log('Test 1: Confirmation message with past check-in');
  const result1 = automationService.shouldBackfillMessage(pastReservation, confirmationRule, pastRunAt, now);
  console.log(`Result: ${result1} (Expected: true)`);
  console.log(`✓ ${result1 === true ? 'PASS' : 'FAIL'}`);
  console.log('');

  // Test 2: Confirmation message with future check-in (should return true)
  console.log('Test 2: Confirmation message with future check-in');
  const result2 = automationService.shouldBackfillMessage(futureReservation, confirmationRule, pastRunAt, now);
  console.log(`Result: ${result2} (Expected: true)`);
  console.log(`✓ ${result2 === true ? 'PASS' : 'FAIL'}`);
  console.log('');

  // Test 3: Welcome message with past check-in (should return false)
  console.log('Test 3: Welcome message with past check-in');
  const result3 = automationService.shouldBackfillMessage(pastReservation, welcomeRule, pastRunAt, now);
  console.log(`Result: ${result3} (Expected: false)`);
  console.log(`✓ ${result3 === false ? 'PASS' : 'FAIL'}`);
  console.log('');

  // Test 4: Welcome message with future check-in (should return true)
  console.log('Test 4: Welcome message with future check-in');
  const result4 = automationService.shouldBackfillMessage(futureReservation, welcomeRule, pastRunAt, now);
  console.log(`Result: ${result4} (Expected: true)`);
  console.log(`✓ ${result4 === true ? 'PASS' : 'FAIL'}`);
  console.log('');

  // Summary
  const allTestsPassed = result1 === true && result2 === true && result3 === false && result4 === true;
  console.log('=== SUMMARY ===');
  console.log(`All tests passed: ${allTestsPassed ? 'YES' : 'NO'}`);
  
  if (allTestsPassed) {
    console.log('✅ Fix verified: Confirmation messages will no longer be skipped!');
  } else {
    console.log('❌ Some tests failed. Please check the logic.');
  }
}

// Run the test
try {
  testConfirmationMessageLogic();
} catch (error) {
  console.error('Error running test:', error);
}
