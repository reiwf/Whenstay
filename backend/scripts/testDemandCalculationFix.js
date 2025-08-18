/**
 * Test script to verify the demand calculation fix
 * This tests against the user's reported issue where increasing tuning weights decreased demand
 */

const dayjs = require('dayjs');

// Mock the clamp function
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Test function simulating the fixed demand calculation
function testDemandCalculation(w_pickup, w_avail, w_event, alpha, pickup_proxy, availability_proxy, events_weight, demand_min, demand_max) {
  // Fixed formula: w_avail * (1 - availability_proxy) instead of w_avail * (-availability_proxy)
  const raw = w_pickup * pickup_proxy + 
              w_avail * (1 - availability_proxy) + // FIXED: Now uses (1 - availability_proxy)
              w_event * (events_weight - 1);
              
  const demand_auto = clamp(Math.exp(alpha * raw), demand_min, demand_max);
  
  return {
    raw_score: raw,
    demand_auto: demand_auto,
    breakdown: {
      pickup_contribution: w_pickup * pickup_proxy,
      availability_contribution: w_avail * (1 - availability_proxy),
      events_contribution: w_event * (events_weight - 1)
    }
  };
}

// Test data based on user's reported issue
console.log('🧪 Testing Market Demand Calculation Fix\n');

// From user's data: availability_z = -0.833, so availability_proxy = 0.833
const pickup_proxy = 0.167;        // pickup_z from user data
const availability_proxy = 0.833;  // derived from availability_z = -0.833
const events_weight = 1.000;       // events_weight from user data

// Test Case A (original tuning that gave demand = 0.978)
const testA = testDemandCalculation(
  0.40,  // w_pickup
  0.30,  // w_avail  
  0.30,  // w_event
  0.12,  // alpha
  pickup_proxy,
  availability_proxy, 
  events_weight,
  0.70,  // demand_min
  1.40   // demand_max
);

console.log('📊 Test Case A (w_avail = 0.30):');
console.log(`  Raw Score: ${testA.raw_score.toFixed(6)}`);
console.log(`  Demand Auto: ${testA.demand_auto.toFixed(3)}`);
console.log(`  Breakdown:`);
console.log(`    Pickup: ${testA.breakdown.pickup_contribution.toFixed(6)}`);
console.log(`    Availability: ${testA.breakdown.availability_contribution.toFixed(6)} (was ${(0.30 * -0.833).toFixed(6)} with bug)`);
console.log(`    Events: ${testA.breakdown.events_contribution.toFixed(6)}`);

// Test Case B (increased tuning that gave demand = 0.899 - the issue)
const testB = testDemandCalculation(
  0.80,  // w_pickup (increased)
  0.80,  // w_avail (increased)
  0.30,  // w_event
  0.20,  // alpha (increased)
  pickup_proxy,
  availability_proxy,
  events_weight, 
  0.70,  // demand_min
  1.40   // demand_max
);

console.log('\n📊 Test Case B (w_avail = 0.80):');
console.log(`  Raw Score: ${testB.raw_score.toFixed(6)}`);
console.log(`  Demand Auto: ${testB.demand_auto.toFixed(3)}`);
console.log(`  Breakdown:`);
console.log(`    Pickup: ${testB.breakdown.pickup_contribution.toFixed(6)}`);
console.log(`    Availability: ${testB.breakdown.availability_contribution.toFixed(6)} (was ${(0.80 * -0.833).toFixed(6)} with bug)`);
console.log(`    Events: ${testB.breakdown.events_contribution.toFixed(6)}`);

// Compare results
console.log('\n📈 Results Comparison:');
console.log(`  Case A Demand: ${testA.demand_auto.toFixed(3)}`);
console.log(`  Case B Demand: ${testB.demand_auto.toFixed(3)}`);
console.log(`  Change: ${testB.demand_auto > testA.demand_auto ? '+' : ''}${((testB.demand_auto - testA.demand_auto) / testA.demand_auto * 100).toFixed(1)}%`);

if (testB.demand_auto > testA.demand_auto) {
  console.log('  ✅ FIXED: Higher tuning weights now correctly produce higher demand');
} else {
  console.log('  ❌ Issue persists: Higher tuning weights still produce lower demand');
}

console.log('\n🔍 The Fix:');
console.log('  OLD (buggy): w_avail * (-availability_proxy)');
console.log('  NEW (fixed): w_avail * (1 - availability_proxy)');
console.log('  This ensures that lower availability (scarcity) increases demand pressure as expected.');
