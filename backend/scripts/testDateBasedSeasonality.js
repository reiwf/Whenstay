/**
 * Test script to verify the date-based seasonality calculation
 * This tests the new date range functionality and year wrap-around logic
 */

const dayjs = require('dayjs');

// Mock the date-based seasonality logic from SmartMarketDemandService
function isDateInSeason(checkDate, startDate, endDate, yearRecurring = true) {
  const checkMoment = dayjs(checkDate);
  const startMoment = dayjs(startDate);
  const endMoment = dayjs(endDate);

  if (!yearRecurring) {
    // Non-recurring: exact date range match
    return checkMoment.isSameOrAfter(startMoment, 'day') && checkMoment.isSameOrBefore(endMoment, 'day');
  }

  // Recurring: check if the date falls within the annual pattern
  const checkMonth = checkMoment.month() + 1; // 1-12
  const checkDay = checkMoment.date();
  const startMonth = startMoment.month() + 1;
  const startDay = startMoment.date();
  const endMonth = endMoment.month() + 1;
  const endDay = endMoment.date();

  // Create comparable date values (MMDD format)
  const checkValue = checkMonth * 100 + checkDay;
  const startValue = startMonth * 100 + startDay;
  const endValue = endMonth * 100 + endDay;

  if (startValue <= endValue) {
    // Normal range (e.g., Spring: Mar 1 - May 31)
    return checkValue >= startValue && checkValue <= endValue;
  } else {
    // Wrap-around range (e.g., Winter: Dec 1 - Feb 28)
    return checkValue >= startValue || checkValue <= endValue;
  }
}

function calculateSeasonalityForDate(date, seasonalSettings) {
  // Find matching season for this date
  let baseSeasonal = 1.0; // Default if no season matches
  
  for (const season of seasonalSettings) {
    if (isDateInSeason(date, season.start_date, season.end_date, season.year_recurring)) {
      baseSeasonal = parseFloat(season.multiplier);
      break;
    }
  }
  
  return baseSeasonal;
}

// Test data - default seasonality settings
const seasonalSettings = [
  { season_name: 'Winter', start_date: '2024-12-01', end_date: '2025-02-28', multiplier: 0.92, year_recurring: true },
  { season_name: 'Spring', start_date: '2024-03-01', end_date: '2024-05-31', multiplier: 0.97, year_recurring: true },
  { season_name: 'Summer', start_date: '2024-06-01', end_date: '2024-08-31', multiplier: 1.15, year_recurring: true },
  { season_name: 'Fall', start_date: '2024-09-01', end_date: '2024-11-30', multiplier: 1.05, year_recurring: true }
];

console.log('🧪 Testing Date-Based Seasonality Calculation\n');

// Test cases for different dates
const testDates = [
  '2024-01-15',  // Winter
  '2024-04-15',  // Spring
  '2024-07-15',  // Summer
  '2024-10-15',  // Fall
  '2024-12-25',  // Winter (year wrap start)
  '2025-01-15',  // Winter (year wrap middle)
  '2025-02-15',  // Winter (year wrap end)
  '2025-03-15',  // Spring (next year)
  '2026-07-04'   // Summer (multiple years ahead)
];

console.log('📅 Testing Recurring Seasonal Patterns:');
testDates.forEach(date => {
  const multiplier = calculateSeasonalityForDate(date, seasonalSettings);
  const matchedSeason = seasonalSettings.find(s => 
    isDateInSeason(date, s.start_date, s.end_date, s.year_recurring)
  );
  
  console.log(`  ${date}: ${multiplier.toFixed(3)}x (${matchedSeason?.season_name || 'No Match'})`);
});

// Test non-recurring seasons
console.log('\n📅 Testing Non-Recurring Specific Dates:');
const specificSeasons = [
  { season_name: 'Golden Week 2024', start_date: '2024-04-29', end_date: '2024-05-05', multiplier: 1.25, year_recurring: false },
  { season_name: 'Olympics 2024', start_date: '2024-07-26', end_date: '2024-08-11', multiplier: 1.40, year_recurring: false }
];

const specificTestDates = [
  '2024-05-01',  // Golden Week 2024
  '2024-08-01',  // Olympics 2024 
  '2025-05-01',  // Golden Week 2025 (should NOT match - not recurring)
  '2025-08-01'   // Olympics 2025 (should NOT match - not recurring)
];

specificTestDates.forEach(date => {
  const multiplier = calculateSeasonalityForDate(date, specificSeasons);
  const matchedSeason = specificSeasons.find(s => 
    isDateInSeason(date, s.start_date, s.end_date, s.year_recurring)
  );
  
  console.log(`  ${date}: ${multiplier.toFixed(3)}x (${matchedSeason?.season_name || 'No Match'})`);
});

// Test year wrap-around logic
console.log('\n🔄 Testing Year Wrap-Around Logic (Winter: Dec 1 - Feb 28):');
const wrapTestDates = [
  '2024-11-30',  // Before winter
  '2024-12-01',  // Winter start
  '2024-12-15',  // Winter middle
  '2025-01-01',  // Winter wrap
  '2025-02-15',  // Winter end period
  '2025-02-28',  // Winter end
  '2025-03-01'   // After winter
];

wrapTestDates.forEach(date => {
  const multiplier = calculateSeasonalityForDate(date, seasonalSettings);
  const matchedSeason = seasonalSettings.find(s => 
    isDateInSeason(date, s.start_date, s.end_date, s.year_recurring)
  );
  
  const isWinter = matchedSeason?.season_name === 'Winter';
  console.log(`  ${date}: ${multiplier.toFixed(3)}x (${matchedSeason?.season_name || 'No Match'}) ${isWinter ? '❄️' : ''}`);
});

// Test custom date ranges
console.log('\n📊 Testing Custom Date Range Examples:');
const customSeasons = [
  { season_name: 'Cherry Blossom', start_date: '2024-03-25', end_date: '2024-04-10', multiplier: 1.35, year_recurring: true },
  { season_name: 'New Year Week', start_date: '2024-12-28', end_date: '2025-01-05', multiplier: 1.30, year_recurring: true },
  { season_name: 'Mid-Summer Peak', start_date: '2024-07-15', end_date: '2024-08-15', multiplier: 1.45, year_recurring: true }
];

const customTestDates = [
  '2024-04-01',  // Cherry Blossom 2024
  '2025-04-01',  // Cherry Blossom 2025 (recurring)
  '2024-12-30',  // New Year Week 2024
  '2025-01-02',  // New Year Week 2025 (wrap-around)
  '2024-07-20',  // Mid-Summer Peak
  '2025-07-20'   // Mid-Summer Peak 2025 (recurring)
];

customTestDates.forEach(date => {
  const multiplier = calculateSeasonalityForDate(date, customSeasons);
  const matchedSeason = customSeasons.find(s => 
    isDateInSeason(date, s.start_date, s.end_date, s.year_recurring)
  );
  
  console.log(`  ${date}: ${multiplier.toFixed(3)}x (${matchedSeason?.season_name || 'No Match'})`);
});

console.log('\n✅ Date-Based Seasonality Test Complete');
console.log('\n📝 Key Features Demonstrated:');
console.log('  • Exact date range matching (vs. month-only)');
console.log('  • Year wrap-around seasons (Dec-Feb)');
console.log('  • Recurring vs. non-recurring patterns');
console.log('  • Custom date periods (Cherry Blossom, Golden Week, etc.)');
console.log('  • Multi-year recurring functionality');
