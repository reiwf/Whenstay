const { supabaseAdmin } = require('./config/supabase');
const communicationService = require('./services/communicationService');
const generatorService = require('./services/scheduler/generatorService');

async function testRuleADuplicatePrevention() {
  console.log('🧪 Testing Rule A duplicate prevention...');
  
  try {
    // Initialize services
    generatorService.init(supabaseAdmin, communicationService);
    
    // Find a recent reservation to test with
    const { data: testReservation, error } = await supabaseAdmin
      .from('reservations')
      .select(`
        *,
        properties(name, wifi_name, wifi_password),
        room_units(unit_number),
        message_threads(id)
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !testReservation) {
      console.log('❌ No test reservation found');
      return;
    }

    console.log(`📋 Testing with reservation: ${testReservation.id} (${testReservation.booking_name})`);

    // Set thread_id if available
    if (testReservation.message_threads) {
      testReservation.thread_id = testReservation.message_threads.id;
    }

    // Get Rule A
    const rules = await generatorService.getEnabledRules(testReservation.property_id);
    const ruleA = rules.find(r => r.code === 'A');
    
    if (!ruleA) {
      console.log('❌ Rule A not found or not enabled');
      return;
    }

    console.log(`📜 Found Rule A: ${ruleA.id} (${ruleA.name})`);

    // Check current status of Rule A for this reservation
    const { data: existingRuleA } = await supabaseAdmin
      .from('scheduled_messages')
      .select('id, status, created_at')
      .eq('reservation_id', testReservation.id)
      .eq('rule_id', ruleA.id)
      .order('created_at', { ascending: false });

    console.log(`📊 Existing Rule A records: ${existingRuleA?.length || 0}`);
    if (existingRuleA && existingRuleA.length > 0) {
      existingRuleA.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Status: ${record.status}, Created: ${record.created_at}`);
      });
    }

    // Test 1: First attempt to send Rule A
    console.log('\n🔬 Test 1: First attempt to send Rule A');
    const result1 = await generatorService.sendImmediateRuleAMessage(testReservation, ruleA);
    console.log('   Result 1:', {
      status: result1.status,
      reason: result1.reason,
      audit_record_id: result1.audit_record_id
    });

    // Test 2: Second attempt (should be prevented)
    console.log('\n🔬 Test 2: Second attempt (should be prevented)');
    const result2 = await generatorService.sendImmediateRuleAMessage(testReservation, ruleA);
    console.log('   Result 2:', {
      status: result2.status,
      reason: result2.reason,
      audit_record_id: result2.audit_record_id
    });

    // Test 3: Third attempt via generateForReservation
    console.log('\n🔬 Test 3: Third attempt via generateForReservation');
    const result3 = await generatorService.generateForReservation(testReservation, [ruleA]);
    const ruleAResult = result3.find(r => r.rule_code === 'A');
    console.log('   Result 3:', {
      status: ruleAResult?.status,
      reason: ruleAResult?.reason,
      audit_record_id: ruleAResult?.audit_record_id
    });

    // Test 4: Cron job filtering test
    console.log('\n🔬 Test 4: Cron job filtering test (generateForRecentReservations)');
    
    // Temporarily modify the reservation's created_at to make it "recent"
    const originalCreatedAt = testReservation.created_at;
    testReservation.created_at = new Date().toISOString();
    
    const result4 = await generatorService.generateForRecentReservations(1); // 1 minute back
    const processedReservation = result4.results?.find(r => r.reservation_id === testReservation.id);
    
    console.log('   Result 4:', {
      totalProcessed: result4.processed,
      thisReservationProcessed: !!processedReservation,
      skippedMessage: processedReservation ? 'No - was processed' : 'Yes - was skipped (good!)'
    });

    // Restore original created_at
    testReservation.created_at = originalCreatedAt;

    // Final verification
    console.log('\n📊 Final verification - checking scheduled_messages table');
    const { data: finalCheck } = await supabaseAdmin
      .from('scheduled_messages')
      .select('id, status, created_at, created_by')
      .eq('reservation_id', testReservation.id)
      .eq('rule_id', ruleA.id)
      .order('created_at', { ascending: false });

    console.log(`   Total Rule A records after test: ${finalCheck?.length || 0}`);
    if (finalCheck && finalCheck.length > 0) {
      finalCheck.forEach((record, index) => {
        console.log(`   ${index + 1}. ID: ${record.id}, Status: ${record.status}, Created By: ${record.created_by}, Time: ${record.created_at}`);
      });
    }

    // Summary
    console.log('\n✅ Test Summary:');
    console.log(`   - Duplicate prevention working: ${result2.status === 'already_sent' ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Cron job filtering working: ${!processedReservation ? 'YES ✅' : 'NO ❌'}`);
    console.log(`   - Total Rule A records: ${finalCheck?.length || 0} (should be 1 or 2 max)`);

    if (finalCheck && finalCheck.length <= 2 && result2.status === 'already_sent') {
      console.log('\n🎉 SUCCESS: Rule A duplicate prevention is working correctly!');
    } else {
      console.log('\n⚠️  WARNING: Some duplicate prevention may not be working as expected');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testRuleADuplicatePrevention().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
